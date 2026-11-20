const { Router } = require('express');
const { randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { verifyToken } = require('../../../middlewares/auth.middleware');
const { recommend } = require('./index');
const { sanitizePrevious } = require('./context');
const { loadActiveDocuments } = require('./knowledge');

const sessions = new Map();
const ttl = 2 * 60 * 60 * 1000;
const limit = 2000;
const historyLimit = 30;

function failure(status, message) {
    return Object.assign(new Error(message), { status, logToConsole: status >= 500 });
}

function createSession(owner, context = {}) {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (!session.busy && session.expires <= now) sessions.delete(id);
    }
    if (sessions.size >= limit) throw failure(503, 'Chatbot đang bận. Bạn thử lại sau nhé.');
    const session = {
        id: randomUUID(), token: randomBytes(32).toString('hex'), owner,
        context, turns: [], busy: false, expires: now + ttl,
    };
    sessions.set(session.id, session);
    return session;
}

function accessSession(id, token, owner) {
    const session = sessions.get(id);
    const valid = session && session.owner === owner && typeof token === 'string'
        && /^[a-f0-9]{64}$/.test(token)
        && timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(session.token, 'hex'));
    if (!valid) throw failure(404, 'Không tìm thấy cuộc trò chuyện.');
    if (session.expires <= Date.now() && !session.busy) {
        sessions.delete(id);
        throw failure(410, 'Phiên chat đã hết hạn.');
    }
    session.expires = Date.now() + ttl;
    return session;
}

async function runTurn(session, message, answer) {
    if (session.busy) throw failure(409, 'Chatbot đang trả lời tin nhắn trước.');
    session.busy = true;
    try {
        const result = await answer(message, session.context);
        const { context, ...turn } = result;
        session.context = context;
        session.turns = [...session.turns, { message, ...turn }].slice(-historyLimit);
        return turn;
    } finally {
        session.busy = false;
    }
}

function serialize(result) {
    const aspects = { book_price: 'price', book_stock: 'stock', book_detail: result.aspect || 'general' };
    const aspect = aspects[result.intent];
    const searchIntent = ['book_search', 'book_recommendation', 'discount_search', 'follow_up'].includes(result.intent);
    const intent = aspect ? 'book_lookup' : searchIntent && result.context?.askedClarification ? 'clarification' : result.intent;
    return {
        ...result,
        intent,
        ...(aspect ? { aspect } : {}),
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        sources: result.sources || [],
        source: ['gemini', 'groq'].includes(result.replySource) ? result.replySource : 'backend',
    };
}

function createController(answer = recommend) {
    function owner(req) {
        return req.user ? String(req.user.user_id) : null;
    }

    return {
        async message(req, res, next) {
            const { message, conversationId, conversationToken, context } = req.body || {};
            if (typeof message !== 'string' || !message.trim() || message.length > 500) {
                return res.status(400).json({ message: 'Nhập câu hỏi từ 1 đến 500 ký tự.' });
            }
            if (context !== undefined && (!context || typeof context !== 'object' || Array.isArray(context)
                || Buffer.byteLength(JSON.stringify(context)) > 4096)) {
                return res.status(400).json({ message: 'Ngữ cảnh trò chuyện không hợp lệ.' });
            }
            try {
                const session = conversationId === undefined
                    ? createSession(owner(req), sanitizePrevious(context))
                    : accessSession(conversationId, conversationToken, owner(req));
                const turn = await runTurn(session, message.trim(), async (text, previous) => serialize(await answer(text, previous)));
                return res.set('Cache-Control', 'no-store')
                    .json({ conversationId: session.id, conversationToken: session.token, ...turn });
            } catch (error) {
                return next(error);
            }
        },
        history(req, res, next) {
            try {
                const session = accessSession(req.params.id, req.get('X-Conversation-Token'), owner(req));
                res.set('Cache-Control', 'no-store').json({ conversationId: session.id, turns: session.turns });
            } catch (error) {
                next(error);
            }
        },
    };
}

const router = Router();
const controller = createController((message, previous) => recommend(message, previous, { loadDocuments: loadActiveDocuments }));
const requests = new Map();
let activeMinute = 0;

function rateLimit(req, res, next) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    if (minute !== activeMinute) {
        activeMinute = minute;
        requests.clear();
    }
    const key = req.ip || req.socket.remoteAddress;
    const count = requests.get(key) || 0;
    if (count >= 12 || (!count && requests.size >= 10000)) {
        res.set('Retry-After', String(Math.ceil((60000 - now % 60000) / 1000)));
        return res.status(429).json({ message: 'Bạn đã gửi nhiều câu hỏi. Hãy chờ một lúc rồi thử lại.' });
    }
    requests.set(key, count + 1);
    next();
}

function optionalAuth(req, res, next) {
    return req.headers.authorization ? verifyToken(req, res, next) : next();
}

router.post('/messages', rateLimit, optionalAuth, controller.message);
router.get('/conversations/:id', rateLimit, optionalAuth, controller.history);

module.exports = router;
module.exports.createController = createController;
