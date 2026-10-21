/**
 * Resume Parser Service - Extracts raw text from PDF/DOCX files
 * and uses structured regex patterns to parse candidate details.
 */
const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text || '';
}

function parseResumeDetails(text) {
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/);
  const githubMatch = text.match(/(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
  const linkedinMatch = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);

  // Extract key technology skills
  const knownSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'React', 'React Native',
    'Next.js', 'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'MongoDB',
    'PostgreSQL', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'Git', 'GraphQL', 'REST', 'Tailwind', 'HTML', 'CSS', 'Flutter', 'Android'
  ];

  const foundSkills = knownSkills.filter(skill =>
    new RegExp(`\\b${skill.replace('+', '\\+')}\\b`, 'i').test(text)
  );

  // Extract candidate highlights / bullet points
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(l => /^[•\-\*]\s+|^\d+\.\s+/.test(l) || l.length > 30).slice(0, 5);

  return {
    email: emailMatch ? emailMatch[1] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    githubUrl: githubMatch ? (githubMatch[0].startsWith('http') ? githubMatch[0] : 'https://' + githubMatch[0]) : '',
    linkedinUrl: linkedinMatch ? (linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : 'https://' + linkedinMatch[0]) : '',
    skills: foundSkills.join(', '),
    highlights: bulletLines.map(b => b.replace(/^[•\-\*]\s+|^\d+\.\s+/, '').trim())
  };
}

module.exports = {
  extractTextFromPDF,
  parseResumeDetails
};
