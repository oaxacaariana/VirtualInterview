/**
 * Resume score presentation helpers.
 * Inputs: Numeric resume scores and stored rubric versions.
 * Outputs: Human-readable fit labels and rubric metadata for resume views.
 */
const RESUME_RUBRIC_VERSION = 2;

const RUBRIC_CONFIGS = {
  1: [
    { key: 'role_fit', label: 'Role fit', shortLabel: 'Fit', max: 25 },
    { key: 'experience_depth', label: 'Experience depth', shortLabel: 'Depth', max: 20 },
    { key: 'quantified_impact', label: 'Evidence of impact', shortLabel: 'Impact', max: 15 },
    { key: 'skills_evidence_alignment', label: 'Skills evidence', shortLabel: 'Proof', max: 10 },
    { key: 'resume_completeness', label: 'Resume completeness', shortLabel: 'Complete', max: 10 },
    { key: 'professional_structure_clarity', label: 'Structure & clarity', shortLabel: 'Clarity', max: 10 },
    { key: 'project_quality', label: 'Project quality', shortLabel: 'Projects', max: 5 },
    { key: 'education_certifications', label: 'Education / certs', shortLabel: 'Education', max: 5 },
  ],
  2: [
    { key: 'role_fit', label: 'Core role fit', shortLabel: 'Core fit', max: 20 },
    { key: 'experience_depth', label: 'Experience depth', shortLabel: 'Depth', max: 25 },
    { key: 'quantified_impact', label: 'Evidence of impact', shortLabel: 'Impact', max: 15 },
    { key: 'skills_evidence_alignment', label: 'Job-specific evidence', shortLabel: 'Evidence', max: 15 },
    { key: 'resume_completeness', label: 'Resume completeness', shortLabel: 'Complete', max: 10 },
    { key: 'professional_structure_clarity', label: 'Structure & clarity', shortLabel: 'Clarity', max: 5 },
    { key: 'project_quality', label: 'Project quality', shortLabel: 'Projects', max: 5 },
    { key: 'education_certifications', label: 'Education / certs', shortLabel: 'Education', max: 5 },
  ],
};

const getResumeRubricConfig = (version = 1) => RUBRIC_CONFIGS[version] || RUBRIC_CONFIGS[1];

const fitLabelForScore = (score) => {
  if (typeof score !== 'number') return 'Pending';
  if (score >= 85) return 'Excellent fit';
  if (score >= 70) return 'Good fit';
  if (score >= 50) return 'Mixed fit';
  if (score >= 35) return 'Poor fit';
  return 'Bad fit';
};

const fitBadgeForScore = (score) => {
  if (typeof score !== 'number') return 'Pending';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Mixed';
  if (score >= 35) return 'Poor';
  return 'Bad';
};

module.exports = {
  RESUME_RUBRIC_VERSION,
  getResumeRubricConfig,
  fitLabelForScore,
  fitBadgeForScore,
};
