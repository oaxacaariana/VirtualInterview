/**
 * Resume listing route module.
 * Inputs: Express router plus resume controller handlers.
 * Outputs: Mounted routes for listing, archiving, and unarchiving resumes.
 */
const express = require('express');
const { showResumes, archiveResume, unarchiveResume } = require('../resumes/resumeController');

const router = express.Router();

router.get('/', showResumes);
router.post('/:id/archive', archiveResume);
router.post('/:id/unarchive', unarchiveResume);

module.exports = router;
