/**
 * Transcript controller.
 * Inputs: Express req/res objects, session user state, chat identifiers, and collections.
 * Outputs: Renders transcript history/detail pages and returns transcript summaries as JSON.
 */
const { toObjectId } = require('../resumes/resumeRepository');
const { findInterviewScoreByChatId } = require('./interviewScoreRepository');
const {
  listRecentChatsForUser,
  findChatLogByChatId,
  listChatTurnsForChat,
} = require('./chatRepository');
const { ensureChatId } = require('./interviewService');

const showChatLogsPage = async (req, res) => {
  try {
    const userId = toObjectId(req.session?.user?.id);
    const docs = await listRecentChatsForUser({
      collections: req.app.locals.collections,
      userId,
    });

    const chats = await Promise.all(
      docs.map(async (chat) => ({
        ...chat,
        finalScore: await findInterviewScoreByChatId({
          collections: req.app.locals.collections,
          userId,
          chatId: chat.chatId,
        }),
      }))
    );

    return res.render('chat-logs', { chats });
  } catch (error) {
    return res.status(500).render('chat-logs', { chats: [] });
  }
};

const showChatLogDetail = async (req, res) => {
  try {
    const userId = toObjectId(req.session?.user?.id);
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

    return res.render('chat-log-detail', { chat, turns, finalScore });
  } catch (error) {
    return res.status(500).send(error.message || 'Failed to load chat log.');
  }
};

const listTranscripts = async (req, res) => {
  try {
    const userId = toObjectId(req.session?.user?.id);
    const docs = await listRecentChatsForUser({
      collections: req.app.locals.collections,
      userId,
    });
    return res.json(docs);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'chatLogs unavailable' });
  }
};

module.exports = {
  showChatLogsPage,
  showChatLogDetail,
  listTranscripts,
};
