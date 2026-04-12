const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function login() {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  });

  const data = await response.json();
  if (!response.ok || !data.success || !data.token) {
    throw new Error(data.error || 'Failed to authenticate as admin.');
  }

  return data.token;
}

async function createCandidate(token, candidate) {
  const response = await fetch(`${API_BASE}/api/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(candidate),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`${candidate.full_name}: ${data.error || 'Failed to create candidate.'}`);
  }

  return data.data;
}

async function deleteCandidate(token, candidateId) {
  const response = await fetch(`${API_BASE}/api/candidates/${candidateId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to delete candidate ${candidateId}.`);
  }
}

async function listAllCandidates(token) {
  const response = await fetch(`${API_BASE}/api/candidates?limit=200&sort=created_at&order=DESC`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to list candidates.');
  }

  return data.data || [];
}

async function listNewest(token, limit = 6) {
  const response = await fetch(`${API_BASE}/api/candidates?limit=${limit}&sort=created_at&order=DESC`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to list candidates.');
  }

  return data.data || [];
}

async function main() {
  const token = await login();
  const candidates = [
    {
      full_name: 'Areeba Khan',
      email: 'areeba.khan@example.com',
      phone: '+92 300 111 2451',
      current_title: 'Frontend Developer',
      current_company: 'Pixel Forge',
      location: 'Lahore, Pakistan',
      linkedin_url: 'https://linkedin.com/in/areebakhan-dev',
      skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
      experience_years: 4,
      status: 'screening',
      source: 'linkedin',
      notes: 'Strong product UI background and solid frontend fundamentals.',
      resume_text: 'Frontend developer with experience building modern web interfaces in React and Next.js.',
      technical_score: 8,
      experience_score: 7,
      culture_fit_score: 8,
      overall_score: 8,
      strengths: ['Strong React skills', 'Clean UI implementation', 'Good communication'],
      concerns: ['Needs deeper backend exposure'],
      assigned_recruiter: 'Shahrukh',
      position: 'Frontend Engineer',
      market: 'Pakistan',
    },
    {
      full_name: 'Hamza Siddiqui',
      email: 'hamza.siddiqui@example.com',
      phone: '+92 321 458 7721',
      current_title: 'Backend Engineer',
      current_company: 'Data Harbor',
      location: 'Karachi, Pakistan',
      linkedin_url: 'https://linkedin.com/in/hamzasiddiqui-api',
      skills: ['Node.js', 'PostgreSQL', 'Express', 'Docker'],
      experience_years: 5,
      status: 'interview',
      source: 'manual',
      notes: 'Reliable backend profile with API and database optimization experience.',
      resume_text: 'Backend engineer focused on scalable APIs, data modeling, and infrastructure basics.',
      technical_score: 8,
      experience_score: 8,
      culture_fit_score: 7,
      overall_score: 8,
      strengths: ['API design', 'Database optimization', 'Team collaboration'],
      concerns: ['Limited frontend ownership'],
      assigned_recruiter: 'Shahrukh',
      position: 'Backend Engineer',
      market: 'Pakistan',
    },
    {
      full_name: 'Mariam Aslam',
      email: 'mariam.aslam@example.com',
      phone: '+92 333 805 1944',
      current_title: 'Product Designer',
      current_company: 'Northstar Studio',
      location: 'Islamabad, Pakistan',
      linkedin_url: 'https://linkedin.com/in/mariamaslam-design',
      skills: ['Figma', 'Design Systems', 'UX Research', 'Prototyping'],
      experience_years: 6,
      status: 'new',
      source: 'referral',
      notes: 'Strong design systems and stakeholder communication.',
      resume_text: 'Product designer with hands-on experience in UX research and interface systems.',
      technical_score: 7,
      experience_score: 8,
      culture_fit_score: 9,
      overall_score: 8,
      strengths: ['Design systems', 'User research', 'Presentation skills'],
      concerns: ['No engineering background'],
      assigned_recruiter: 'Shahrukh',
      position: 'Product Designer',
      market: 'Pakistan',
    },
    {
      full_name: 'Bilal Qureshi',
      email: 'bilal.qureshi@example.com',
      phone: '+92 300 667 3188',
      current_title: 'DevOps Engineer',
      current_company: 'Cloud Circuit',
      location: 'Dubai, UAE',
      linkedin_url: 'https://linkedin.com/in/bilalqureshi-devops',
      skills: ['AWS', 'Terraform', 'Kubernetes', 'CI/CD'],
      experience_years: 7,
      status: 'technical',
      source: 'linkedin',
      notes: 'Owns delivery pipelines and cloud reliability well.',
      resume_text: 'DevOps engineer with strong cloud automation and platform reliability experience.',
      technical_score: 9,
      experience_score: 8,
      culture_fit_score: 7,
      overall_score: 8,
      strengths: ['Cloud automation', 'Infrastructure as code', 'Release engineering'],
      concerns: ['High compensation expectations'],
      assigned_recruiter: 'Shahrukh',
      position: 'DevOps Engineer',
      market: 'UAE',
    },
    {
      full_name: 'Sara Nadeem',
      email: 'sara.nadeem@example.com',
      phone: '+92 322 710 8824',
      current_title: 'QA Automation Engineer',
      current_company: 'Velocity Labs',
      location: 'Karachi, Pakistan',
      linkedin_url: 'https://linkedin.com/in/saranadeem-qa',
      skills: ['Playwright', 'Cypress', 'API Testing', 'JavaScript'],
      experience_years: 5,
      status: 'offer',
      source: 'manual',
      notes: 'Good mix of automation coverage and release quality ownership.',
      resume_text: 'QA automation engineer experienced in browser testing, APIs, and release validation.',
      technical_score: 8,
      experience_score: 8,
      culture_fit_score: 8,
      overall_score: 8,
      strengths: ['Automation strategy', 'Stable test design', 'Cross-team coordination'],
      concerns: ['Not much mobile testing'],
      assigned_recruiter: 'Shahrukh',
      position: 'QA Automation Engineer',
      market: 'Pakistan',
    },
    {
      full_name: 'Omar Farooq',
      email: 'omar.farooq@example.com',
      phone: '+92 345 922 5041',
      current_title: 'Full Stack Engineer',
      current_company: 'Launchpad Tech',
      location: 'Riyadh, Saudi Arabia',
      linkedin_url: 'https://linkedin.com/in/omarfarooq-fullstack',
      skills: ['Node.js', 'React', 'MongoDB', 'System Design'],
      experience_years: 6,
      status: 'hired',
      source: 'referral',
      notes: 'Balanced full stack engineer with startup delivery pace.',
      resume_text: 'Full stack engineer with end-to-end ownership across product, backend, and frontend systems.',
      technical_score: 9,
      experience_score: 8,
      culture_fit_score: 8,
      overall_score: 9,
      strengths: ['End-to-end ownership', 'Fast execution', 'Architecture thinking'],
      concerns: ['Prefers small fast-moving teams'],
      assigned_recruiter: 'Shahrukh',
      position: 'Full Stack Engineer',
      market: 'Saudi Arabia',
    },
  ];

  const desiredNames = new Set(candidates.map(candidate => candidate.full_name));
  const existing = await listAllCandidates(token);
  const seenNames = new Set();
  const deleted = [];

  for (const candidate of existing) {
    const candidateName = candidate.full_name;
    const shouldKeepName = desiredNames.has(candidateName);

    if (!shouldKeepName || seenNames.has(candidateName)) {
      await deleteCandidate(token, candidate.id);
      deleted.push({ id: candidate.id, name: candidateName, reason: shouldKeepName ? 'duplicate' : 'not-in-sample-set' });
      continue;
    }

    seenNames.add(candidateName);
  }

  const created = [];
  for (const candidate of candidates) {
    if (seenNames.has(candidate.full_name)) {
      continue;
    }

    const record = await createCandidate(token, candidate);
    created.push({ id: record.id, name: record.full_name, status: record.status });
    seenNames.add(candidate.full_name);
  }

  const newest = await listNewest(token, 6);
  console.log(JSON.stringify({ created, deleted, newest }, null, 2));
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});