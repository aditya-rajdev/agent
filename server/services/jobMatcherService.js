/**
 * AI Job Matcher Service - 5-Factor Weighted Relevance Engine
 * 1. Skills Match: 30%
 * 2. Job Role Match: 25%
 * 3. Experience & Education Eligibility: 20%
 * 4. Location & Remote Preference: 15%
 * 5. Job Type & Compensation: 10%
 */

function calculateJobMatch(job, candidateProfile, userPreferences) {
  const explanations = [];
  const missingSkills = [];
  let isHardEligibilityFailure = false;
  let hardFailureReason = '';

  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobLoc = (job.location || '').toLowerCase();
  const jobType = (job.job_type || '').toLowerCase();

  // Parse candidate data
  const candidateSkills = (candidateProfile.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const preferredRoles = (userPreferences.roles || []).map(r => r.toLowerCase());
  const excludedCompanies = (userPreferences.excluded_companies || []).map(c => c.toLowerCase());
  const excludedKeywords = (userPreferences.excluded_keywords || []).map(k => k.toLowerCase());

  // --- HARD ELIGIBILITY FILTERS ---
  if (job.company && excludedCompanies.some(ec => job.company.toLowerCase().includes(ec))) {
    isHardEligibilityFailure = true;
    hardFailureReason = `Company "${job.company}" is in your excluded companies list.`;
  }

  if (excludedKeywords.some(ek => jobTitle.includes(ek))) {
    isHardEligibilityFailure = true;
    hardFailureReason = `Job title contains excluded keyword "${excludedKeywords.find(ek => jobTitle.includes(ek))}".`;
  }

  if (isHardEligibilityFailure) {
    return {
      matchScore: 0,
      classification: 'Hard Eligibility Failure',
      explanation: hardFailureReason,
      missingSkills: [],
      isEligible: false
    };
  }

  // --- FACTOR 1: SKILLS MATCH (30%) ---
  let skillsScore = 0;
  let matchedSkillsCount = 0;
  if (candidateSkills.length > 0) {
    const matched = candidateSkills.filter(skill =>
      jobTitle.includes(skill) || jobDesc.includes(skill)
    );
    matchedSkillsCount = matched.length;
    skillsScore = Math.min(100, Math.round((matched.length / Math.min(candidateSkills.length, 6)) * 100));

    // Identify key missing skills from job description
    const commonTechs = ['react', 'node', 'python', 'java', 'typescript', 'aws', 'docker', 'postgresql', 'mongodb', 'graphql', 'flutter', 'android'];
    commonTechs.forEach(tech => {
      if ((jobTitle.includes(tech) || jobDesc.includes(tech)) && !candidateSkills.includes(tech)) {
        missingSkills.push(tech.toUpperCase());
      }
    });

    if (matched.length > 0) {
      explanations.push(`Skills Match (${skillsScore}%): Matched ${matched.slice(0, 4).join(', ')}.`);
    } else {
      explanations.push(`Skills Match (0%): No direct skill overlap found in title or description.`);
    }
  } else {
    skillsScore = 50; // neutral default
    explanations.push(`Skills Match (50%): Candidate profile has no listed skills for comparison.`);
  }

  // --- FACTOR 2: JOB ROLE MATCH (25%) ---
  let roleScore = 0;
  if (preferredRoles.length > 0) {
    const exactRole = preferredRoles.some(role => jobTitle.includes(role));
    if (exactRole) {
      roleScore = 100;
      explanations.push(`Role Match (100%): Job title "${job.title}" directly matches preferred roles.`);
    } else {
      // Partial role match check
      const keywords = preferredRoles.flatMap(r => r.split(' '));
      const partialMatches = keywords.filter(k => k.length > 3 && jobTitle.includes(k));
      if (partialMatches.length > 0) {
        roleScore = 65;
        explanations.push(`Role Match (65%): Title partially matches role keywords.`);
      } else {
        roleScore = 20;
        explanations.push(`Role Match (20%): Title does not match target roles.`);
      }
    }
  } else {
    roleScore = 70;
  }

  // --- FACTOR 3: EXPERIENCE & EDUCATION ELIGIBILITY (20%) ---
  let expScore = 80;
  const expText = (job.experience_req || jobDesc).toLowerCase();
  if (/10\+|\b10\s*-\s*15\b|\b12\s*years/i.test(expText)) {
    expScore = 30;
    explanations.push(`Experience (30%): Job requires senior/lead level experience.`);
  } else if (/fresher|0\s*-\s*2|1\s*-\s*3|junior|entry/i.test(expText) || jobTitle.includes('fresher') || jobTitle.includes('intern')) {
    expScore = 100;
    explanations.push(`Experience (100%): Entry/Fresher level aligns with eligibility.`);
  } else {
    explanations.push(`Experience (80%): Requirement appears compatible or unspecified.`);
  }

  // --- FACTOR 4: LOCATION & REMOTE PREFERENCE (15%) ---
  let locScore = 70;
  const preferredLocs = (userPreferences.locations || []).map(l => l.toLowerCase());
  if (job.remote_type === 'Remote' || jobLoc.includes('remote')) {
    locScore = 100;
    explanations.push(`Location (100%): Remote position matches preference.`);
  } else if (preferredLocs.some(pl => jobLoc.includes(pl))) {
    locScore = 90;
    explanations.push(`Location (90%): Onsite/Hybrid location "${job.location}" matches preferred cities.`);
  } else {
    locScore = 40;
    explanations.push(`Location (40%): Location "${job.location}" is outside target primary cities.`);
  }

  // --- FACTOR 5: JOB TYPE & COMPENSATION (10%) ---
  let compScore = 80;
  explanations.push(`Compensation/Type (80%): Job type "${job.job_type || 'Full-time'}" is acceptable.`);

  // WEIGHTED TOTAL SCORE
  const totalScore = Math.round(
    (skillsScore * 0.30) +
    (roleScore * 0.25) +
    (expScore * 0.20) +
    (locScore * 0.15) +
    (compScore * 0.10)
  );

  let classification = 'Partial Match';
  if (totalScore >= 75) {
    classification = 'Strong Match';
  } else if (totalScore < 50) {
    classification = 'Weak Match / Insufficient Info';
  }

  return {
    matchScore: totalScore,
    classification,
    explanation: explanations.join(' | '),
    missingSkills: [...new Set(missingSkills)],
    isEligible: totalScore >= (userPreferences.min_match_score || 50)
  };
}

module.exports = {
  calculateJobMatch
};
