/**
 * Centralized Application Verification Service
 * Strictly evaluates application status and evidence to determine genuine submission verification.
 */

// Tightened Application-Specific Confirmation Verification Patterns
const CREDIBLE_CONFIRMATION_PATTERNS = /thank you for applying|thanks for applying|application (has been )?(received|submitted|sent|complete)|successfully applied|we (have )?received your application|your application is in|applied stamp confirmed|dialog closed, 'applied' stamp confirmed|confirmed after \d+ step\(s\)|verified: in .* applied list/i;

// Rejects generic single words or non-application phrases that might give false positives
const FALSE_POSITIVE_PATTERNS = /^(success|thank|confirm|submitted|ok|done)$/i;

/**
 * Evaluates application status and verification evidence.
 * @param {string} requestedStatus - Status requested by client or engine
 * @param {string} evidenceText - Evidence log or proof snippet
 * @returns {{ finalStatus: string, verified: number, explanation: string }}
 */
function evaluateVerification(requestedStatus, evidenceText = '') {
  const cleanEvidence = (evidenceText || '').trim();

  let finalStatus = requestedStatus || 'Application prepared';

  if (finalStatus === 'Submitted') {
    if (
      cleanEvidence &&
      !FALSE_POSITIVE_PATTERNS.test(cleanEvidence) &&
      CREDIBLE_CONFIRMATION_PATTERNS.test(cleanEvidence)
    ) {
      return {
        finalStatus: 'Submitted',
        verified: 1,
        explanation: 'Confirmed via credible application confirmation evidence.'
      };
    } else {
      return {
        finalStatus: 'Submission uncertain',
        verified: 0,
        explanation: 'Insufficient or ambiguous confirmation evidence; status set to Submission uncertain for manual verification.'
      };
    }
  }

  if (finalStatus === 'Application prepared' || finalStatus === 'would-apply') {
    return {
      finalStatus: 'Application prepared',
      verified: 0,
      explanation: 'Application form prepared / dry-run completed.'
    };
  }

  if (finalStatus === 'Submission uncertain') {
    return {
      finalStatus: 'Submission uncertain',
      verified: 0,
      explanation: 'Submission attempted but outcome remains unconfirmed.'
    };
  }

  return {
    finalStatus: finalStatus,
    verified: 0,
    explanation: 'Non-submitted lifecycle status.'
  };
}

module.exports = {
  CREDIBLE_CONFIRMATION_PATTERNS,
  FALSE_POSITIVE_PATTERNS,
  evaluateVerification
};
