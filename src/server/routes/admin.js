/**
 * Admin route module.
 * Inputs: Express router plus admin controller handlers.
 * Outputs: Mounted admin-only routes for managing application users.
 */
const express = require('express');
const router = express.Router();
const {
  showUsers,
  showUserDetail,
  showUserResumes,
  showUserResumeResults,
  showUserResumePreview,
  showUserChats,
  showUserChatDetail,
  updateUser,
} = require('../admin/adminController');

router.get('/users', showUsers);
router.get('/users/:userId', showUserDetail);
router.get('/users/:userId/resumes', showUserResumes);
router.get('/users/:userId/resumes/:resumeId', showUserResumeResults);
router.get('/users/:userId/resumes/:resumeId/preview', showUserResumePreview);
router.get('/users/:userId/chats', showUserChats);
router.get('/users/:userId/chats/:chatId', showUserChatDetail);
router.post('/users/:userId', updateUser);

module.exports = router;
