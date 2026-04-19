/**
 * Admin user management controller.
 * Inputs: Express req/res objects, session user state, admin form values, and collections.
 * Outputs: Admin-only user list/detail views plus persisted edits to other user accounts.
 */
const bcrypt = require('bcryptjs');
const {
  findUserById,
  listUsers,
  updateUserById,
  normalizeUsername,
} = require('../auth/userRepository');
const { toSessionUser } = require('../auth/authService');
const {
  getResumeCollectionView,
  getResumeResultsView,
  getResumePreviewData,
} = require('../resumes/resumeService');
const { toObjectId } = require('../resumes/resumeRepository');
const {
  listRecentChatsForUser,
  findChatLogByChatId,
  listChatTurnsForChat,
} = require('../interviews/chatRepository');
const { findInterviewScoreByChatId } = require('../interviews/interviewScoreRepository');
const { ensureChatId } = require('../interviews/interviewService');

const USER_ROLES = ['candidate', 'admin'];

const formatInterviewLength = (chat) => {
  const startAt = chat?.createdAt ? new Date(chat.createdAt) : null;
  const endSource = chat?.closedAt || chat?.updatedAt || chat?.createdAt;
  const endAt = endSource ? new Date(endSource) : null;

  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return 'n/a';
  }

  const durationMs = Math.max(0, endAt.getTime() - startAt.getTime());
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
};

const withInterviewLength = (chat) => ({
  ...chat,
  interviewLength: formatInterviewLength(chat),
});

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const countUserRecords = async (collections, userId) => {
  const [resumeCount, resumeScoreCount, chatCount, interviewScoreCount] = await Promise.all([
    collections?.resumeFiles?.countDocuments({ userId }) || 0,
    collections?.resumeScores?.countDocuments({ userId }) || 0,
    collections?.chatLogs?.countDocuments({ userId }) || 0,
    collections?.interviewScores?.countDocuments({ userId }) || 0,
  ]);

  return {
    resumeCount,
    resumeScoreCount,
    chatCount,
    interviewScoreCount,
  };
};

const renderUserList = async (req, res, { error = null, success = null } = {}) => {
  const collections = req.app.locals.collections;
  const search = String(req.query?.q || '').trim();
  const users = await listUsers(collections, { search, limit: 250 });
  const usersWithStats = await Promise.all(
    users.map(async (user) => ({
      ...user,
      stats: await countUserRecords(collections, user._id),
    }))
  );

  res.render('admin-users', {
    users: usersWithStats,
    search,
    error,
    success,
  });
};

const renderUserDetail = async (req, res, userId, { error = null, success = null } = {}) => {
  const collections = req.app.locals.collections;
  const user = await findUserById(collections, userId);

  if (!user) {
    return res.status(404).render('admin-user-detail', {
      user: null,
      userStats: null,
      availableRoles: USER_ROLES,
      error: 'User not found.',
      success: null,
    });
  }

  const userStats = await countUserRecords(collections, user._id);
  return res.render('admin-user-detail', {
    user,
    userStats,
    availableRoles: USER_ROLES,
    error,
    success,
  });
};

const loadTargetUser = async (req, userId) => findUserById(req.app.locals.collections, userId);

const toAdminSessionUser = (userId) => ({
  id: userId?.toString?.() || String(userId || ''),
});

const showUsers = async (req, res) => renderUserList(req, res);

const showUserDetail = async (req, res) => renderUserDetail(req, res, req.params.userId);

const showUserResumes = async (req, res) => {
  const targetUser = await loadTargetUser(req, req.params.userId);
  if (!targetUser) {
    return res.status(404).render('error', {
      title: 'User Not Found',
      message: 'That user account could not be found.',
    });
  }

  const showArchived = req.query?.archived === '1';
  const resumes = await getResumeCollectionView({
    collections: req.app.locals.collections,
    sessionUser: toAdminSessionUser(targetUser._id),
    archived: showArchived,
    limit: 100,
  });

  return res.render('admin-user-resumes', {
    targetUser,
    resumes,
    showArchived,
  });
};

const showUserResumePreview = async (req, res) => {
  const targetUser = await loadTargetUser(req, req.params.userId);
  if (!targetUser) {
    return res.status(404).render('error', {
      title: 'User Not Found',
      message: 'That user account could not be found.',
    });
  }

  try {
    const data = await getResumePreviewData({
      collections: req.app.locals.collections,
      sessionUser: toAdminSessionUser(targetUser._id),
      resumeId: req.params.resumeId,
    });

    if (!data) {
      return res.status(404).send('Resume not found.');
    }

    const { resume, parsedText } = data;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Resume Preview</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0f0f10; color: #e5e5e5; padding: 24px; }
          .card { background: #181818; border: 1px solid #222; border-radius: 10px; padding: 16px; max-width: 980px; }
          pre { white-space: pre-wrap; background: #0f0f10; border: 1px solid #222; padding: 12px; border-radius: 8px; }
          .meta { margin-bottom: 14px; line-height: 1.6; }
          .muted { color: #aaa; }
          a { color: #8fb8ff; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Admin Resume Preview</h1>
          <div class="meta">
            <div><strong>User:</strong> ${targetUser.name || targetUser.username} (@${targetUser.username})</div>
            <div><strong>Original Name:</strong> ${resume.originalName || 'n/a'}</div>
            <div><strong>MIME Type:</strong> ${resume.mimeType || 'n/a'}</div>
            <div><strong>Size:</strong> ${resume.size ? Math.round(resume.size / 1024) + ' KB' : 'n/a'}</div>
            <div><strong>Stored Path:</strong> ${resume.path || 'n/a'}</div>
            <div><strong>Back:</strong> <a href="/admin/users/${targetUser._id}/resumes">Return to admin resume list</a></div>
            <div class="muted">Admin preview of the stored file metadata and parsed text.</div>
          </div>
          <h3>Extracted Text (best-effort)</h3>
          <pre>${parsedText || 'No text extracted from resume.'}</pre>
        </div>
      </body>
      </html>
    `;

    return res.type('text/html').send(html);
  } catch (error) {
    console.error('Admin resume preview failed:', error);
    return res.status(500).send('Could not read stored resume file.');
  }
};

const showUserResumeResults = async (req, res) => {
  const targetUser = await loadTargetUser(req, req.params.userId);
  if (!targetUser) {
    return res.status(404).render('error', {
      title: 'User Not Found',
      message: 'That user account could not be found.',
    });
  }

  const viewModel = await getResumeResultsView({
    collections: req.app.locals.collections,
    sessionUser: toAdminSessionUser(targetUser._id),
    resumeId: req.params.resumeId,
  });

  return res.render('admin-user-resume-detail', {
    targetUser,
    ...viewModel,
  });
};

const showUserChats = async (req, res) => {
  const targetUser = await loadTargetUser(req, req.params.userId);
  if (!targetUser) {
    return res.status(404).render('error', {
      title: 'User Not Found',
      message: 'That user account could not be found.',
    });
  }

  const userId = toObjectId(targetUser._id);
  const docs = await listRecentChatsForUser({
    collections: req.app.locals.collections,
    userId,
    limit: 100,
  });

  const chats = await Promise.all(
    docs.map(async (chat) => ({
      ...withInterviewLength(chat),
      finalScore: await findInterviewScoreByChatId({
        collections: req.app.locals.collections,
        userId,
        chatId: chat.chatId,
      }),
    }))
  );

  return res.render('admin-user-chats', {
    targetUser,
    chats,
  });
};

const showUserChatDetail = async (req, res) => {
  const targetUser = await loadTargetUser(req, req.params.userId);
  if (!targetUser) {
    return res.status(404).render('error', {
      title: 'User Not Found',
      message: 'That user account could not be found.',
    });
  }

  try {
    const userId = toObjectId(targetUser._id);
    const chatId = ensureChatId(req.params.chatId);
    const chat = await findChatLogByChatId({
      collections: req.app.locals.collections,
      chatId,
      userId,
    });

    if (!chat) {
      return res.status(404).send('Chat log not found.');
    }

    const turns = await listChatTurnsForChat({
      collections: req.app.locals.collections,
      chatId,
      userId,
    });

    const finalScore = await findInterviewScoreByChatId({
      collections: req.app.locals.collections,
      userId,
      chatId,
    });

    return res.render('admin-user-chat-detail', {
      targetUser,
      chat: withInterviewLength(chat),
      turns,
      finalScore,
    });
  } catch (error) {
    console.error('Admin chat detail failed:', error);
    return res.status(500).send(error.message || 'Failed to load chat log.');
  }
};

const updateUser = async (req, res) => {
  const targetUserId = req.params.userId;
  const { username, name, role, password } = req.body || {};
  const updates = {};
  const normalizedUsername = normalizeUsername(username);
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedUsername) {
    return renderUserDetail(req, res, targetUserId, { error: 'Username is required.' });
  }

  if (!trimmedName) {
    return renderUserDetail(req, res, targetUserId, { error: 'Name is required.' });
  }

  updates.username = username;
  updates.name = name;

  if (role) {
    updates.role = role;
  }

  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return renderUserDetail(req, res, targetUserId, { error: 'No changes submitted.' });
  }

  try {
    const updatedUser = await updateUserById(req.app.locals.collections, targetUserId, updates);

    if (req.session?.user?.id === updatedUser?._id?.toString()) {
      req.session.user = toSessionUser(updatedUser);
      await saveSession(req);
    }

    return renderUserDetail(req, res, targetUserId, { success: 'User updated.' });
  } catch (error) {
    console.error('Admin user update failed:', error);
    const message =
      error?.code === 11000
        ? 'That username is already in use.'
        : error?.message || 'User update failed.';
    return renderUserDetail(req, res, targetUserId, { error: message });
  }
};

module.exports = {
  showUsers,
  showUserDetail,
  showUserResumes,
  showUserResumeResults,
  showUserResumePreview,
  showUserChats,
  showUserChatDetail,
  updateUser,
};
