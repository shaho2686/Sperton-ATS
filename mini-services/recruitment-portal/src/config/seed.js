/**
 * Seed script — populates the database with mock candidates and demo users.
 * Run: npm run seed   (or npm run init to create tables + seed)
 */

const { initDatabase, dbGet, dbAll, dbRun, dbExec, dbBegin, dbCommit, saveDbNow } = require('./database');
const crypto = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateId() {
  return crypto.randomUUID();
}

function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

function generateApiKey() {
  return 'srk_' + crypto.randomBytes(24).toString('hex');
}

// ── Seed Users ───────────────────────────────────────────────────────────────
function seedUsers() {
  const demoUsers = [
    { id: 1, username: 'admin', password: 'admin', role: 'admin', fullName: 'Administrator' },
  ];

  // Check if users already exist
  const existing = dbGet('SELECT COUNT(*) as count FROM users');
  if (existing && existing.count > 0) {
    console.log(`Users table already has ${existing.count} users. Skipping user seed.`);
    return;
  }

  dbBegin();
  for (const u of demoUsers) {
    dbRun(`
      INSERT INTO users (id, username, password_hash, api_key, role, full_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [u.id, u.username, hashPassword(u.password), generateApiKey(), u.role, u.fullName]);
  }
  dbCommit();

  console.log(`Seeded ${demoUsers.length} users.`);
  console.log('  Admin login: username=admin, password=admin');
}

// ── Seed Candidates ──────────────────────────────────────────────────────────
function seedCandidates() {
  const candidates = [
    {
      id: generateId(), full_name: 'Usama Javaid', email: 'usama.javaid@email.com',
      phone: '+92-300-1234567', current_title: 'Full Stack WordPress Developer',
      current_company: 'Freelance', location: 'Wah Cantonment, Punjab, Pakistan',
      linkedin_url: 'https://linkedin.com/in/usamajavaid',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'React', 'Node.js', 'MongoDB', 'REST API', 'WooCommerce', 'Plugin Development', 'MERN Stack']),
      experience_years: 6, status: 'interview', source: 'linkedin',
      notes: 'Strong MERN stack expertise with WordPress specialization. Active on open source projects.',
      technical_score: 9, experience_score: 8, culture_fit_score: 7, overall_score: 8,
      strengths: JSON.stringify(['MERN Stack expertise', 'Plugin Development', 'WordPress core knowledge', 'REST API design']),
      concerns: JSON.stringify(['AI/ML integration not confirmed']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Shahrukh',
      ai_analysis: JSON.stringify({ summary: 'Excellent match for the Full Stack WordPress Developer position. Strong technical skills across the MERN stack with deep WordPress expertise. Plugin development experience is a significant advantage.', recommendation: 'Proceed to technical interview', fit_level: 'high' })
    },
    {
      id: generateId(), full_name: 'Muhammad Usman Shabir', email: 'usman.shabir@email.com',
      phone: '+92-321-7654321', current_title: 'Full-Stack Web Developer',
      current_company: 'Freelance', location: 'Lahore, Pakistan',
      linkedin_url: 'https://linkedin.com/in/musmanshabir',
      skills: JSON.stringify(['WordPress', 'React', 'Next.js', 'DevOps', 'Node.js', 'JavaScript', 'PHP', 'Docker', 'AWS']),
      experience_years: 5, status: 'screening', source: 'linkedin',
      notes: 'Full-stack developer with WordPress mastery and modern JS expertise. DevOps experience is a bonus.',
      technical_score: 8, experience_score: 8, culture_fit_score: 7, overall_score: 8,
      strengths: JSON.stringify(['WordPress mastery', 'React/Next.js', 'DevOps', 'Custom WordPress development']),
      concerns: JSON.stringify(['AI/ML experience not documented']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Shahrukh',
      ai_analysis: JSON.stringify({ summary: 'Strong full-stack developer with WordPress specialization and modern frontend skills. DevOps experience adds value for scalable architecture.', recommendation: 'Schedule screening call', fit_level: 'high' })
    },
    {
      id: generateId(), full_name: 'Hania Sheikh', email: 'hania.sheikh@email.com',
      phone: '+92-333-9876543', current_title: 'Senior Full Stack Engineer',
      current_company: 'Hbox Pakistan', location: 'Islamabad, Pakistan',
      linkedin_url: 'https://linkedin.com/in/haniasheikh',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'HTML/CSS', 'React', 'Vue.js', 'Wix', 'Webflow']),
      experience_years: 8, status: 'interview', source: 'linkedin',
      notes: 'Senior-level WordPress developer with full-stack expertise. Multi-platform experience.',
      technical_score: 8, experience_score: 9, culture_fit_score: 8, overall_score: 8,
      strengths: JSON.stringify(['Senior level experience', 'Full Stack Engineer', 'Multi-platform experience', 'Frontend & Backend Development']),
      concerns: JSON.stringify(['Specific frameworks like React/Vue depth unclear']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Kavita Sharma',
      ai_analysis: JSON.stringify({ summary: 'Senior engineer with extensive WordPress and full-stack experience. Multi-platform knowledge demonstrates adaptability. Leadership potential based on seniority.', recommendation: 'Proceed to final interview stage', fit_level: 'high' })
    },
    {
      id: generateId(), full_name: 'Kashif Raza', email: 'kashif@wpacademy.com',
      phone: '+92-300-5551234', current_title: 'Full Stack WordPress Developer & Trainer',
      current_company: 'WP Academy', location: 'Karachi, Pakistan',
      linkedin_url: 'https://linkedin.com/in/kashifwpacademy',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'MySQL', 'REST API', 'Plugin Development', 'Theme Development', 'Curriculum Design']),
      experience_years: 10, status: 'offer', source: 'referral',
      notes: 'WordPress Core Contributor. Trainer and conference speaker. Deep ecosystem knowledge.',
      technical_score: 9, experience_score: 10, culture_fit_score: 8, overall_score: 9,
      strengths: JSON.stringify(['WordPress Core Contributor', '10+ years experience', 'Trainer & Course Creator', 'Conference speaker']),
      concerns: JSON.stringify(['Modern JS frameworks not specified', 'May command higher salary']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Shahrukh',
      ai_analysis: JSON.stringify({ summary: 'Exceptional WordPress expertise as a Core Contributor. Training background indicates deep understanding and ability to mentor. Community leadership is a strong asset.', recommendation: 'Fast-track offer process', fit_level: 'very_high' })
    },
    {
      id: generateId(), full_name: 'Hassan Ali', email: 'hassan.ali@toptal.com',
      phone: '+92-321-4445566', current_title: 'Senior WordPress Developer',
      current_company: 'Total / Toptal', location: 'Lahore, Punjab, Pakistan',
      linkedin_url: 'https://linkedin.com/in/hassanaliwp',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'MySQL', 'REST API', 'WooCommerce', 'Affiliate Systems']),
      experience_years: 7, status: 'screening', source: 'toptal',
      notes: 'Toptal verified senior developer. Experience with cross-functional collaboration.',
      technical_score: 8, experience_score: 8, culture_fit_score: 7, overall_score: 8,
      strengths: JSON.stringify(['Senior WordPress Developer', 'Toptal Verified', 'Interdisciplinary collaboration', 'Website design']),
      concerns: JSON.stringify(['Modern JS framework not specified', 'AI/ML not documented']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Erik Giertsen',
      ai_analysis: JSON.stringify({ summary: 'Toptal-verified senior developer with solid WordPress credentials. Cross-functional collaboration experience valuable for team environments.', recommendation: 'Schedule screening call', fit_level: 'high' })
    },
    {
      id: generateId(), full_name: 'Usama Tariq', email: 'usama.tariq@email.com',
      phone: '+92-345-7778899', current_title: 'Full Stack WordPress Developer',
      current_company: 'YourBuilder', location: 'Islamabad, Pakistan',
      linkedin_url: 'https://linkedin.com/in/usamatariq',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'MySQL', 'REST API', 'Theme Development', 'Plugin Development']),
      experience_years: 4, status: 'new', source: 'linkedin',
      notes: 'Direct experience as Full Stack WordPress Developer focused on web applications.',
      technical_score: 7, experience_score: 6, culture_fit_score: 6, overall_score: 6,
      strengths: JSON.stringify(['Full Stack WordPress Development', 'Web application development']),
      concerns: JSON.stringify(['Specific tech-stack details missing', 'AI/ML not mentioned', 'Only 4 years experience']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Shahrukh',
      ai_analysis: JSON.stringify({ summary: 'Direct title match but limited information on specific technologies. Web application focus is relevant. Need more technical depth assessment.', recommendation: 'Request more details or portfolio', fit_level: 'medium' })
    },
    {
      id: generateId(), full_name: 'Sohaib Khan', email: 'sohaib.khan@email.com',
      phone: '+92-333-1112233', current_title: 'Full Stack Web Developer & Software Engineer',
      current_company: 'Freelance', location: 'Rawalpindi, Pakistan',
      linkedin_url: 'https://linkedin.com/in/sohaibkhan',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'MySQL', 'WooCommerce', 'E-Commerce', 'REST API', 'GraphQL']),
      experience_years: 5, status: 'new', source: 'linkedin',
      notes: 'Custom theme and plugin development. E-commerce specialization.',
      technical_score: 7, experience_score: 7, culture_fit_score: 6, overall_score: 7,
      strengths: JSON.stringify(['Custom themes & plugins', 'E-Commerce Development', 'Software Engineering background', 'GraphQL knowledge']),
      concerns: JSON.stringify(['Specific JS frameworks not mentioned', 'AI/ML not confirmed']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Kavita Sharma',
      ai_analysis: JSON.stringify({ summary: 'Solid WordPress and e-commerce background with software engineering fundamentals. Custom development experience is valuable. GraphQL knowledge is a plus.', recommendation: 'Schedule screening call', fit_level: 'medium' })
    },
    {
      id: generateId(), full_name: 'Wahaj Mansoor', email: 'wahaj.mansoor@email.com',
      phone: '+92-300-4445556', current_title: 'WordPress Developer & Brand Strategist',
      current_company: 'Made (formerly FD Studio)', location: 'Islamabad, Pakistan',
      linkedin_url: 'https://linkedin.com/in/wahajmansoor',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'Brand Strategy', 'UI/UX', 'HTML/CSS']),
      experience_years: 4, status: 'new', source: 'crunchbase',
      notes: 'Co-Founder with entrepreneurial background. Combines tech with brand strategy.',
      technical_score: 6, experience_score: 5, culture_fit_score: 7, overall_score: 6,
      strengths: JSON.stringify(['WordPress Developer', 'Co-Founder experience', 'Brand strategy', 'Entrepreneurship']),
      concerns: JSON.stringify(['Full stack not specified', 'Technical details missing', 'Less than 4 years experience']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Shahrukh',
      ai_analysis: JSON.stringify({ summary: 'Interesting profile combining WordPress development with brand strategy. Entrepreneurial mindset is valuable but full-stack technical depth needs verification.', recommendation: 'Initial screening to assess technical depth', fit_level: 'medium' })
    },
    {
      id: generateId(), full_name: 'Irfan Saleem', email: 'irfan.saleem@email.com',
      phone: '+92-321-6667788', current_title: 'Full Stack WordPress Developer',
      current_company: 'NotarNow', location: 'Karachi, Sindh, Pakistan',
      linkedin_url: 'https://linkedin.com/in/irfansaleem',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'MySQL', 'REST API', 'Clean Code']),
      experience_years: 5, status: 'new', source: 'linkedin',
      notes: 'Direct title match with quality-focused approach.',
      technical_score: 7, experience_score: 6, culture_fit_score: 6, overall_score: 6,
      strengths: JSON.stringify(['Full Stack WordPress Developer', 'Quality focused', 'Clean code mindset']),
      concerns: JSON.stringify(['Detailed tech stack not available', 'Experience level not specified']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Kavita Sharma',
      ai_analysis: JSON.stringify({ summary: 'Title directly matches position requirements. Quality-focused approach suggests attention to code standards. Need to verify depth of full-stack capabilities.', recommendation: 'Request technical portfolio', fit_level: 'medium' })
    },
    {
      id: generateId(), full_name: 'Codeable Pakistan Developers', email: 'contact@codeable.com',
      phone: '', current_title: 'Full-stack WordPress Developer',
      current_company: 'Codeable', location: 'Pakistan (Multiple)',
      linkedin_url: '',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'React', 'Theme Development', 'WooCommerce', 'Plugin Development']),
      experience_years: 10, status: 'new', source: 'codeable',
      notes: 'Pre-screened developers from Codeable platform. Multiple candidates available.',
      technical_score: 8, experience_score: 8, culture_fit_score: 5, overall_score: 7,
      strengths: JSON.stringify(['10+ years experience', 'Verified by Codeable', 'Multiple candidates', 'Pre-screened quality']),
      concerns: JSON.stringify(['Individual profiles need to be explored', 'AI/ML not specified', 'Platform-based — individual assessment needed']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Erik Giertsen',
      ai_analysis: JSON.stringify({ summary: 'Codeable provides verified WordPress developers with proven track records. Multiple candidates available means flexibility in selection. Individual assessment still required.', recommendation: 'Contact Codeable for individual profiles', fit_level: 'medium' })
    },
    {
      id: generateId(), full_name: 'Ashfaq Ahmed', email: 'ashfaq.ahmed@email.com',
      phone: '+92-333-9990011', current_title: 'Full-Stack WordPress Developer & Blogger',
      current_company: 'Upwork Freelance', location: 'Islamabad, Pakistan',
      linkedin_url: 'https://linkedin.com/in/ashfaqahmed',
      skills: JSON.stringify(['WordPress', 'PHP', 'JavaScript', 'SEO', 'Content Management', 'Blogging']),
      experience_years: 5, status: 'rejected', source: 'linkedin',
      notes: 'Full Stack WordPress with Upwork freelance experience. Active blogger.',
      technical_score: 6, experience_score: 6, culture_fit_score: 5, overall_score: 6,
      strengths: JSON.stringify(['Full-Stack WordPress', 'Upwork experience', 'Communication skills (blogging)']),
      concerns: JSON.stringify(['Technical details not visible', 'Length of experience unknown']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Shahrukh',
      ai_analysis: JSON.stringify({ summary: 'WordPress developer with blogging background suggesting good communication skills. Freelance experience shows independence. Technical depth needs more investigation.', recommendation: 'Rejected — insufficient full-stack evidence', fit_level: 'low' })
    },
    {
      id: generateId(), full_name: 'Ghazi Raza', email: 'ghazi.raza@email.com',
      phone: '+92-300-2223344', current_title: 'Frontend Developer | WordPress Developer',
      current_company: 'Freelance', location: 'Islamabad, Pakistan',
      linkedin_url: 'https://linkedin.com/in/ghaziraza',
      skills: JSON.stringify(['WordPress', 'JavaScript', 'HTML/CSS', 'React', 'Digital Marketing']),
      experience_years: 3, status: 'rejected', source: 'linkedin',
      notes: 'Frontend-focused with WordPress and CMS expertise. Marketing insight.',
      technical_score: 5, experience_score: 4, culture_fit_score: 5, overall_score: 5,
      strengths: JSON.stringify(['Frontend Developer', 'WordPress', 'CMS Expert', 'Digital experiences']),
      concerns: JSON.stringify(['Backend/Full stack not confirmed', 'API integration not mentioned', 'Only 3 years experience']),
      position: 'Full Stack WordPress Developer', market: 'Pakistan',
      assigned_recruiter: 'Kavita Sharma',
      ai_analysis: JSON.stringify({ summary: 'Frontend-focused profile with WordPress skills but lacks confirmed backend/full-stack experience. Not a strong match for the position requirements.', recommendation: 'Not suitable — lacks full-stack credentials', fit_level: 'low' })
    },
  ];

  // Check if candidates already exist
  const existing = dbGet('SELECT COUNT(*) as count FROM candidates');
  if (existing && existing.count > 0) {
    console.log(`Candidates table already has ${existing.count} candidates. Skipping candidate seed.`);
    return;
  }

  dbBegin();
  for (const c of candidates) {
    dbRun(`
      INSERT INTO candidates (
        id, full_name, email, phone, current_title, current_company, location,
        linkedin_url, skills, experience_years, status, source, notes,
        technical_score, experience_score, culture_fit_score, overall_score,
        strengths, concerns, ai_analysis, assigned_recruiter, position, market
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c.id, c.full_name, c.email, c.phone, c.current_title, c.current_company,
      c.location, c.linkedin_url, c.skills, c.experience_years, c.status,
      c.source, c.notes, c.technical_score, c.experience_score, c.culture_fit_score,
      c.overall_score, c.strengths, c.concerns, c.ai_analysis,
      c.assigned_recruiter, c.position, c.market
    ]);
  }
  dbCommit();

  console.log(`Seeded ${candidates.length} candidates.`);

  // Status summary
  const summary = dbAll('SELECT status, COUNT(*) as count FROM candidates GROUP BY status');
  console.log('\nCandidate status summary:');
  summary.forEach(row => console.log(`  ${row.status}: ${row.count}`));
}

// ── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await initDatabase();
    seedUsers();
    seedCandidates();
    console.log('\nDatabase seeding complete.');
  } catch (err) {
    console.error('Seeding error:', err.message);
    process.exit(1);
  }
}

main();
