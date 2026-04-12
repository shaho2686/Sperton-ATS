const express = require('express');
const { dbGet, dbAll, dbRun } = require('../config/database');
const { analyzeCandidate, generateOutreach } = require('../utils/groq');

const router = express.Router();

/**
 * POST /api/ai/analyze
 * Body: { candidateId } or { candidate: {...} }
 * Uses Groq LLM to analyze a candidate
 */
router.post('/analyze', async (req, res) => {
  try {
    let candidate;

    // Accept either a candidate ID or full candidate object
    if (req.body.candidateId) {
      candidate = dbGet('SELECT * FROM candidates WHERE id = ?', [req.body.candidateId]);
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate not found.' });
      }
    } else if (req.body.candidate) {
      candidate = req.body.candidate;
    } else {
      return res.status(400).json({ success: false, error: 'Provide candidateId or candidate object.' });
    }

    const position = req.body.position || candidate.current_title || 'Developer';
    const result = await analyzeCandidate(candidate, position);

    if (result.success) {
      // If we have a DB candidate, update their record with AI analysis
      if (candidate.id) {
        const overallScore = result.analysis.suggested_technical_score != null
          ? Math.round((result.analysis.suggested_technical_score +
              result.analysis.suggested_experience_score +
              result.analysis.suggested_culture_fit_score) / 3 * 10) / 10
          : null;

        dbRun(`
          UPDATE candidates SET
            ai_analysis = ?,
            technical_score = COALESCE(?, technical_score),
            experience_score = COALESCE(?, experience_score),
            culture_fit_score = COALESCE(?, culture_fit_score),
            overall_score = COALESCE(?, overall_score),
            strengths = COALESCE(?, strengths),
            concerns = COALESCE(?, concerns),
            updated_at = datetime('now')
          WHERE id = ?
        `, [
          JSON.stringify(result.analysis),
          result.analysis.suggested_technical_score || null,
          result.analysis.suggested_experience_score || null,
          result.analysis.suggested_culture_fit_score || null,
          overallScore,
          result.analysis.strengths ? JSON.stringify(result.analysis.strengths) : null,
          result.analysis.concerns ? JSON.stringify(result.analysis.concerns) : null,
          candidate.id
        ]);
      }

      res.json({ success: true, analysis: result.analysis });
    } else {
      res.status(500).json({ success: false, error: `AI analysis failed: ${result.error}` });
    }
  } catch (error) {
    console.error('AI analyze error:', error.message);
    res.status(500).json({ success: false, error: 'AI analysis failed.' });
  }
});

/**
 * POST /api/ai/outreach
 * Body: { candidateId } or { candidate: {...}, position, clientCompany }
 * Generates outreach message using Groq LLM
 */
router.post('/outreach', async (req, res) => {
  try {
    let candidate;

    if (req.body.candidateId) {
      candidate = dbGet('SELECT * FROM candidates WHERE id = ?', [req.body.candidateId]);
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate not found.' });
      }
    } else if (req.body.candidate) {
      candidate = req.body.candidate;
    } else {
      return res.status(400).json({ success: false, error: 'Provide candidateId or candidate object.' });
    }

    const position = req.body.position || candidate.position || candidate.current_title;
    const clientCompany = req.body.clientCompany || 'Confidential';

    const result = await generateOutreach(candidate, position, clientCompany);

    if (result.success) {
      res.json({ success: true, outreach: result.outreach });
    } else {
      res.status(500).json({ success: false, error: `Outreach generation failed: ${result.error}` });
    }
  } catch (error) {
    console.error('AI outreach error:', error.message);
    res.status(500).json({ success: false, error: 'Outreach generation failed.' });
  }
});

/**
 * POST /api/ai/batch-analyze
 * Analyze multiple candidates at once
 * Body: { candidateIds: [...] }
 */
router.post('/batch-analyze', async (req, res) => {
  try {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide an array of candidate IDs.' });
    }

    if (candidateIds.length > 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 candidates per batch analysis.' });
    }

    const placeholders = candidateIds.map(() => '?').join(',');
    const candidates = dbAll(`SELECT * FROM candidates WHERE id IN (${placeholders})`, candidateIds);

    const results = [];
    for (const candidate of candidates) {
      const result = await analyzeCandidate(candidate, candidate.position || candidate.current_title);
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        ...result
      });

      if (result.success && candidate.id) {
        const overallScore = result.analysis.suggested_technical_score != null
          ? Math.round((result.analysis.suggested_technical_score +
              result.analysis.suggested_experience_score +
              result.analysis.suggested_culture_fit_score) / 3 * 10) / 10
          : null;

        dbRun(`
          UPDATE candidates SET
            ai_analysis = ?,
            technical_score = COALESCE(?, technical_score),
            experience_score = COALESCE(?, experience_score),
            culture_fit_score = COALESCE(?, culture_fit_score),
            overall_score = COALESCE(?, overall_score),
            updated_at = datetime('now')
          WHERE id = ?
        `, [
          JSON.stringify(result.analysis),
          result.analysis.suggested_technical_score || null,
          result.analysis.suggested_experience_score || null,
          result.analysis.suggested_culture_fit_score || null,
          overallScore,
          candidate.id
        ]);
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Batch analyze error:', error.message);
    res.status(500).json({ success: false, error: 'Batch analysis failed.' });
  }
});

module.exports = router;
