const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Groq = require('groq-sdk');

const envPaths = [
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

function loadEnvIfNeeded() {
  if (process.env.GROQ_API_KEY) return;
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      if (process.env.GROQ_API_KEY) return;
    }
  }
}

loadEnvIfNeeded();

let groqClient = null;

function getGroqClient() {
  loadEnvIfNeeded();
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set.');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function safeJsonParse(content) {
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```\s*$/i, '');

  let start = -1, end = -1;
  let braceCount = 0, bracketCount = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (start === -1) start = i;
      braceCount++;
    } else if (ch === '}') {
      braceCount--;
      if (braceCount === 0 && start !== -1) { end = i + 1; break; }
    } else if (ch === '[') {
      if (start === -1) start = i;
      bracketCount++;
    } else if (ch === ']') {
      bracketCount--;
      if (bracketCount === 0 && start !== -1) { end = i + 1; break; }
    }
  }

  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end);
  }

  let result = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (esc) {
      result += ch;
      esc = false;
      continue;
    }

    if (ch === '\\' && inStr) {
      result += ch;
      esc = true;
      continue;
    }

    if (ch === '"') {
      inStr = !inStr;
      result += ch;
      continue;
    }

    if (inStr) {
      if (ch === '\n') { result += '\\n'; }
      else if (ch === '\r') { result += '\\r'; }
      else if (ch === '\t') { result += '\\t'; }
      else if (ch < ' ') { }
      else { result += ch; }
    } else {
      if (ch < ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      } else {
        result += ch;
      }
    }
  }
  cleaned = result;

  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    try {
      const simple = content.replace(/[\r\n\t]/g, ' ').trim();
      return JSON.parse(simple);
    } catch (e2) {
      throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
    }
  }
}

async function analyzeCandidate(candidate, position) {
  const client = getGroqClient();

  const skills = typeof candidate.skills === 'string'
    ? candidate.skills
    : Array.isArray(candidate.skills)
      ? candidate.skills.join(', ')
      : 'N/A';

  const prompt = `You are an expert technical recruiter at Sperton, a recruitment agency. 
Analyze the following candidate for the position: "${position || candidate.position || candidate.current_title || 'General Developer'}".

${candidate.job_description ? `Job Description for Context:\n${candidate.job_description}\n` : ''}

Candidate Information:
- Name: ${candidate.full_name || 'Unknown'}
- Current Title: ${candidate.current_title || 'N/A'}
- Current Company: ${candidate.current_company || 'N/A'}
- Location: ${candidate.location || 'N/A'}
- Experience: ${candidate.experience_years || 'Unknown'} years
- Skills (USER-PROVIDED): ${skills}
- Notes: ${candidate.notes || 'N/A'}

${candidate.resume_text ? `Candidate Resume Content:\n${candidate.resume_text}\n` : ''}

CRITICAL INSTRUCTIONS:
1. The "Skills (USER-PROVIDED)" above are what the recruiter added. Review them critically:
   - Valid skills (React, Python, AWS, etc.) should be acknowledged as strengths.
   - Irrelevant or placeholder terms (alpha, beta, gamma, test, demo, etc.) should NOT be treated as real skills. Flag these as irrelevant in concerns.
2. Carefully compare the Candidate Resume/Skills with the Job Description.
3. Calculate the "suggested_technical_score", "suggested_experience_score", and "suggested_culture_fit_score" (0-10) based on REAL skills only.
4. Be objective. If the resume lacks specific technologies mentioned in the JD, lower the technical score accordingly.
5. Summary should be professional and mention specific matches or gaps.
6. Only list legitimate experience/background concerns in the "concerns" field - NOT valid recruiter-provided skills, but DO flag nonsensical or irrelevant terms.

Provide your analysis as a JSON object with the following fields:
{
  "summary": "2-3 sentence professional assessment of the candidate fit",
  "recommendation": "One of: Proceed to interview, Schedule screening call, Request more details, Not suitable, Fast-track offer process",
  "fit_level": "One of: very_high, high, medium, low",
  "technical_assessment": "Assessment of technical capabilities",
  "experience_assessment": "Assessment of relevant experience",
  "strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"],
  "suggested_technical_score": 7,
  "suggested_experience_score": 7,
  "suggested_culture_fit_score": 7,
  "interview_questions": ["question1", "question2", "question3"]
}

Return ONLY valid JSON, no markdown formatting or code blocks.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a professional recruitment analyst. Always respond with valid JSON only, no markdown. Do not include newlines inside JSON string values.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const analysis = safeJsonParse(content);

    return { success: true, analysis };
  } catch (error) {
    console.error('Groq API error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateOutreach(candidate, position, clientCompany) {
  const client = getGroqClient();

  const skills = typeof candidate.skills === 'string'
    ? candidate.skills
    : Array.isArray(candidate.skills)
      ? candidate.skills.join(', ')
      : 'N/A';

  const prompt = `You are a recruiter at Sperton. Write a professional, personalized outreach message to this candidate.

Position: ${position || 'Open Role'}
Client: ${clientCompany || 'Confidential'}

Candidate: ${candidate.full_name}
Current Role: ${candidate.current_title || 'N/A'}
Company: ${candidate.current_company || 'N/A'}
Skills: ${skills}

Generate a JSON response with:
{
  "subject": "Email subject line",
  "message": "The outreach message body. Professional but warm. Use \\n for line breaks. Do not use actual newlines in the string.",
  "key_points": ["Why this role fits them", "What makes Sperton different"]
}

Return ONLY valid JSON, no markdown. Do not use actual newline characters inside string values.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a professional recruiter. Respond with valid JSON only, no markdown. CRITICAL: Never include raw newline characters inside JSON string values. Use \\n escape sequences instead.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const outreach = safeJsonParse(content);

    return { success: true, outreach };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { analyzeCandidate, generateOutreach };
