const express = require('express');
const crypto = require('crypto');
const { dbGet, dbAll, dbRun } = require('../config/database');
const { hasStoredResume, readStoredResume, storeResumeFile } = require('../utils/resumeStorage');

const router = express.Router();

function parseJsonField(value, fallback = []) {
  if (!value) return fallback;
  try { return JSON.parse(value); }
  catch { return fallback; }
}

function decodeBase64Payload(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(',');
  const payload = commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
  return payload ? Buffer.from(payload, 'base64') : null;
}

function getMimeTypeFromFilename(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function addResumeMetadata(candidate) {
  if (!candidate) return candidate;
  return {
    ...candidate,
    resume_file_available: Boolean(candidate.resume_file_name && (candidate.resume_file_data || hasStoredResume(candidate.id)))
  };
}

/**
 * GET /api/candidates
 * Query params: search, status, position, market, sort, order, page, limit
 */
router.get('/', (req, res) => {
  try {
    const {
      search = '', status = '', position = '', market = '',
      sort = 'overall_score', order = 'DESC',
      page = '1', limit = '20'
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    // Search across name, email, title, company, skills
    if (search.trim()) {
      whereClause += ` AND (
        full_name LIKE ? OR
        email LIKE ? OR
        current_title LIKE ? OR
        current_company LIKE ? OR
        skills LIKE ? OR
        location LIKE ?
      )`;
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    // Filter by status
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Filter by position / title / market with normalized terms
    if (position) {
      const normalizedPosition = position.trim().replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ');
      const terms = normalizedPosition.split(/\s+/).filter(Boolean);
      if (terms.length) {
        whereClause += ' AND (' + terms.map(() => '(position LIKE ? OR current_title LIKE ? OR market LIKE ? OR current_company LIKE ?)').join(' AND ') + ')';
        terms.forEach(term => {
          const pattern = `%${term}%`;
          params.push(pattern, pattern, pattern, pattern);
        });
      }
    }

    // Filter by market
    if (market) {
      whereClause += ' AND market LIKE ?';
      params.push(`%${market}%`);
    }

    // Validate sort column
    const validSorts = ['overall_score', 'technical_score', 'experience_score', 'culture_fit_score', 'experience_years', 'full_name', 'created_at', 'status'];
    const sortCol = validSorts.includes(sort) ? sort : 'overall_score';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countRow = dbGet(`SELECT COUNT(*) as total FROM candidates WHERE ${whereClause}`, params);
    const total = countRow ? countRow.total : 0;

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Fetch candidates
    const candidates = dbAll(
      `SELECT * FROM candidates WHERE ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Parse JSON fields
    const parsed = candidates.map(c => addResumeMetadata({
      ...c,
      skills: parseJsonField(c.skills),
      strengths: parseJsonField(c.strengths),
      concerns: parseJsonField(c.concerns),
      ai_analysis: parseJsonField(c.ai_analysis, null)
    }));

    // Status counts for filter UI
    const statusCounts = dbAll('SELECT status, COUNT(*) as count FROM candidates GROUP BY status');
    const statusSummary = {};
    statusCounts.forEach(r => { statusSummary[r.status] = r.count; });

    res.json({
      success: true,
      data: parsed,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      statusSummary
    });
  } catch (error) {
    console.error('GET /candidates error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch candidates.' });
  }
});

/**
 * GET /api/candidates/:id
 * Single candidate detail
 */
router.get('/:id', (req, res) => {
  try {
    const candidate = dbGet('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const parsed = addResumeMetadata({
      ...candidate,
      skills: parseJsonField(candidate.skills),
      strengths: parseJsonField(candidate.strengths),
      concerns: parseJsonField(candidate.concerns),
      ai_analysis: parseJsonField(candidate.ai_analysis, null)
    });

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch candidate.' });
  }
});

router.get('/:id/resume', (req, res) => {
  try {
    const candidate = dbGet(
      'SELECT id, full_name, resume_file_name, resume_file_data, resume_text FROM candidates WHERE id = ?',
      [req.params.id]
    );

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const storedResume = readStoredResume(candidate.id);
    const dispositionType = req.query.download === '1' ? 'attachment' : 'inline';

    if (storedResume && candidate.resume_file_name) {
      res.setHeader('Content-Type', getMimeTypeFromFilename(candidate.resume_file_name));
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(candidate.resume_file_name)}"`);
      return res.send(storedResume.buffer);
    }

    if (candidate.resume_file_data && candidate.resume_file_name) {
      const buffer = decodeBase64Payload(candidate.resume_file_data);
      if (buffer) {
        res.setHeader('Content-Type', getMimeTypeFromFilename(candidate.resume_file_name));
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(candidate.resume_file_name)}"`);
        return res.send(buffer);
      }
    }

    if (candidate.resume_text) {
      const fallbackName = `${(candidate.full_name || 'candidate').replace(/[^a-z0-9]+/gi, '_')}_resume.txt`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${fallbackName}"`);
      return res.send(candidate.resume_text);
    }

    return res.status(404).json({ success: false, error: 'No resume available for this candidate.' });
  } catch (error) {
    console.error('GET /candidates/:id/resume error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch resume.' });
  }
});

/**
 * POST /api/candidates
 * Add a new candidate
 */
router.post('/', (req, res) => {
  try {
    const {
      full_name, email, phone, current_title, current_company, location,
      linkedin_url, skills, experience_years, status, source, notes,
      resume_text, resume_file_name, resume_file_data, job_description, rejection_reason,
      technical_score, experience_score, culture_fit_score, overall_score,
      strengths, concerns, assigned_recruiter, position, market
    } = req.body;

    // Validation
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, error: 'Candidate name is required.' });
    }

    const id = crypto.randomUUID();
    const validStatuses = ['new', 'screening', 'interview', 'technical', 'offer', 'rejected', 'hired', 'on_hold'];
    const candidateStatus = validStatuses.includes(status) ? status : 'new';

    dbRun(`
      INSERT INTO candidates (
        id, full_name, email, phone, current_title, current_company, location,
        linkedin_url, skills, experience_years, status, source, notes,
        resume_text, resume_file_name, resume_file_data, job_description, rejection_reason,
        technical_score, experience_score, culture_fit_score, overall_score,
        strengths, concerns, assigned_recruiter, position, market
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, full_name?.trim(), email?.trim() || null, phone?.trim() || null,
      current_title?.trim() || null, current_company?.trim() || null,
      location?.trim() || null, linkedin_url?.trim() || null,
      JSON.stringify(skills || []), experience_years || null, candidateStatus,
      source || 'manual', notes || '', resume_text || null,
      resume_file_name || null, resume_file_data || null,
      job_description || null, rejection_reason || null,
      Math.min(10, Math.max(0, technical_score || 0)),
      Math.min(10, Math.max(0, experience_score || 0)),
      Math.min(10, Math.max(0, culture_fit_score || 0)),
      Math.min(10, Math.max(0, overall_score || 0)),
      JSON.stringify(strengths || []), JSON.stringify(concerns || []),
      assigned_recruiter || null, position || null, market || null
    ]);

    if (resume_file_name && resume_file_data) {
      storeResumeFile(id, resume_file_name, resume_file_data);
    }

    const candidate = dbGet('SELECT * FROM candidates WHERE id = ?', [id]);
    const parsed = addResumeMetadata({
      ...candidate,
      skills: parseJsonField(candidate.skills),
      strengths: parseJsonField(candidate.strengths),
      concerns: parseJsonField(candidate.concerns)
    });

    res.status(201).json({ success: true, data: parsed, message: 'Candidate added successfully.' });
  } catch (error) {
    console.error('POST /api/candidates Error details:', error);
    res.status(500).json({ success: false, error: 'Failed to add candidate.', details: error.message });
  }
});

/**
 * PUT /api/candidates/:id
 * Update candidate fields
 */
router.put('/:id', (req, res) => {
  try {
    const candidate = dbGet('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const {
      full_name, email, phone, current_title, current_company, location,
      linkedin_url, skills, experience_years, notes,
      resume_text, resume_file_name, resume_file_data, job_description, rejection_reason,
      technical_score, experience_score, culture_fit_score, overall_score,
      strengths, concerns, assigned_recruiter, position, market
    } = req.body;

    dbRun(`
      UPDATE candidates SET
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        current_title = COALESCE(?, current_title),
        current_company = COALESCE(?, current_company),
        location = COALESCE(?, location),
        linkedin_url = COALESCE(?, linkedin_url),
        skills = COALESCE(?, skills),
        experience_years = COALESCE(?, experience_years),
        notes = COALESCE(?, notes),
        resume_text = COALESCE(?, resume_text),
        resume_file_name = COALESCE(?, resume_file_name),
        resume_file_data = COALESCE(?, resume_file_data),
        job_description = COALESCE(?, job_description),
        technical_score = COALESCE(?, technical_score),
        experience_score = COALESCE(?, experience_score),
        culture_fit_score = COALESCE(?, culture_fit_score),
        overall_score = COALESCE(?, overall_score),
        strengths = COALESCE(?, strengths),
        concerns = COALESCE(?, concerns),
        assigned_recruiter = COALESCE(?, assigned_recruiter),
        position = COALESCE(?, position),
        market = COALESCE(?, market),
        rejection_reason = COALESCE(?, rejection_reason),
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      full_name?.trim() || null, email?.trim() || null, phone?.trim() || null,
      current_title?.trim() || null, current_company?.trim() || null,
      location?.trim() || null, linkedin_url?.trim() || null,
      skills ? JSON.stringify(skills) : null,
      experience_years ?? null, notes ?? null,
      resume_text || null, resume_file_name || null, resume_file_data || null, job_description || null,
      technical_score !== undefined ? Math.min(10, Math.max(0, technical_score)) : null,
      experience_score !== undefined ? Math.min(10, Math.max(0, experience_score)) : null,
      culture_fit_score !== undefined ? Math.min(10, Math.max(0, culture_fit_score)) : null,
      overall_score !== undefined ? Math.min(10, Math.max(0, overall_score)) : null,
      strengths ? JSON.stringify(strengths) : null,
      concerns ? JSON.stringify(concerns) : null,
      assigned_recruiter ?? null, position ?? null, market ?? null, rejection_reason ?? null,
      req.params.id
    ]);

    if (resume_file_name && resume_file_data) {
      storeResumeFile(req.params.id, resume_file_name, resume_file_data);
    }

    const updated = dbGet('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
    const parsed = addResumeMetadata({
      ...updated,
      skills: parseJsonField(updated.skills),
      strengths: parseJsonField(updated.strengths),
      concerns: parseJsonField(updated.concerns)
    });

    res.json({ success: true, data: parsed, message: 'Candidate updated successfully.' });
  } catch (error) {
    console.error('PUT /candidates error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update candidate.' });
  }
});

/**
 * PATCH /api/candidates/:id/status
 * Update candidate status only
 */
router.patch('/:id/status', (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const validStatuses = ['new', 'screening', 'interview', 'technical', 'offer', 'rejected', 'hired', 'on_hold'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const candidate = dbGet('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    const previousStatus = candidate.status;
    if (status === 'rejected') {
      dbRun("UPDATE candidates SET status = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?", [status, rejection_reason || null, req.params.id]);
    } else {
      dbRun("UPDATE candidates SET status = ?, rejection_reason = NULL, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);
    }

    // Log status change
    dbRun(`
      INSERT INTO search_history (user_id, query, filters, results_count)
      VALUES (?, ?, ?, ?)
    `, [
      req.user?.id || null,
      `Status changed: ${candidate.full_name}`,
      JSON.stringify({ candidateId: req.params.id, from: previousStatus, to: status, updatedBy: req.user?.username }),
      0
    ]);

    const updated = dbGet('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      data: {
        ...updated,
        skills: parseJsonField(updated.skills),
        strengths: parseJsonField(updated.strengths),
        concerns: parseJsonField(updated.concerns)
      },
      message: `Status updated from "${previousStatus}" to "${status}".`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update status.' });
  }
});

/**
 * DELETE /api/candidates/:id
 * Remove a candidate
 */
router.delete('/:id', (req, res) => {
  try {
    const candidate = dbGet('SELECT id, full_name FROM candidates WHERE id = ?', [req.params.id]);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    dbRun('DELETE FROM candidates WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Candidate "${candidate.full_name}" deleted.` });
  } catch (error) {
    console.error('DELETE /api/candidates Error details:', error);
    res.status(500).json({ success: false, error: 'Failed to delete candidate.' });
  }
});

module.exports = router;
