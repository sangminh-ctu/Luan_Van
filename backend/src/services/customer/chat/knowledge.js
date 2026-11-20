const { Router } = require('express');
const multer = require('multer');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { sequelize } = require('../../../config/database');
const { normalize } = require('./fallback-parser');
const { templates } = require('./answer');

const subjects = [
    /\b(doi tra|doi sach|doi hang|giao nham|rach|hoan tien|tra hang|doi trong)\b/,
    /\b(giao hang|van chuyen|phi ship|ship)\b/,
    /\b(thanh toan|chuyen khoan|tien mat|cod)\b/,
    /\b(thanh vien|tich diem|hang thanh vien)\b/,
    /\b(voucher|ma giam gia)\b/,
    /\b(don hang|huy don)\b/,
];
const stop = new Set('chinh sach cua shop the nao khong trong bao nhieu lau co cho minh voi va nhu quy dinh khi neu'.split(' '));
const words = text => [...new Set(normalize(text).split(' ').filter(word => word.length > 2 && !stop.has(word)))];

function findPassages(message, documents) {
    const query = normalize(message);
    const terms = words(message);
    const relevantSubjects = subjects.filter(subject => subject.test(query));
    const asksDuration = /\b(bao lau|bao nhieu ngay|may ngay|thoi han)\b/.test(query);
    const matches = [];
    for (const doc of documents) {
        if (!doc.active) continue;
        let section = '';
        for (const paragraph of doc.content.split(/\r?\n\s*\r?\n/)) {
            const heading = paragraph.match(/^#{1,6}\s+([^\r\n]+)(?:\r?\n|$)/);
            if (heading) section = heading[1];
            const body = (heading ? paragraph.slice(heading[0].length) : paragraph).trim();
            if (!body) continue;
            const context = normalize(doc.name + ' ' + section);
            for (const passage of body.match(/[^\r\n]{1,750}(?:\r?\n|$)|[^\r\n]{1,750}/g) || []) {
                const text = passage.trim();
                if (!text) continue;
                const passageWords = new Set(words(text));
                const overlap = terms.filter(term => passageWords.has(term)).length;
                const textNorm = normalize(text);
                if (asksDuration && !/\b(\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s+(gio|ngay|tuan|thang|nam)\b/.test(textNorm)) continue;
                const sameSubject = relevantSubjects.some(subject => subject.test(context) || subject.test(textNorm));
                if (relevantSubjects.length ? !sameSubject : overlap < 2) continue;
                matches.push({
                    text,
                    score: overlap * 3 + Number(sameSubject),
                    source: { id: doc.id, name: doc.name, version: doc.version, section },
                });
            }
        }
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, 2);
}

async function answerPolicy(message, loadDocuments) {
    const matches = findPassages(message, await loadDocuments());
    if (!matches.length) return { reply: templates.policy, sources: [] };
    const sources = [...new Map(matches.map(match => [match.source.id + ':' + match.source.section, match.source])).values()];
    return { reply: matches.map(match => match.text).join('\n\n'), sources };
}

function isPolicyQuestion(text) {
    return subjects.some(subject => subject.test(text));
}

// Admin FAQ router & loader
const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: { fileSize: 65536, files: 1, fields: 0 },
}).single('file');
const router = Router();
const metadata = 'id, name, version, active, updated_at';
const allFields = metadata + ', content';
const query = (sql, replacements = {}) => sequelize.query(sql, { replacements }).then(([rows]) => rows);

function handle(action) {
    return async (req, res, next) => {
        try { await action(req, res); } catch (error) { next(error); }
    };
}

function documentId(req, res, next) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return res.status(400).json({ message: 'ID tài liệu không hợp lệ.' });
    req.documentId = id;
    next();
}

function readFile(req, res, next) {
    upload(req, res, error => {
        if (error || !req.file) return res.status(400).json({ message: 'Chọn một file TXT hoặc Markdown tối đa 64 KB.' });
        const name = path.basename(req.file.originalname.replace(/\\/g, '/')).normalize('NFC').trim();
        if (name.length > 180 || !/\.(txt|md|markdown)$/i.test(name) || /[\x00-\x1f]/.test(name)) {
            return res.status(400).json({ message: 'Tên file TXT hoặc Markdown không hợp lệ.' });
        }
        try {
            const content = new TextDecoder('utf-8', { fatal: true }).decode(req.file.buffer).trim();
            if (!content || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(content)) throw new Error('invalid_text');
            req.document = { name, content };
            next();
        } catch {
            res.status(400).json({ message: 'Tài liệu phải chứa văn bản UTF-8 hợp lệ.' });
        }
    });
}

function sendDocument(res, row, status = 200) {
    if (!row) return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
    return res.status(status).json(row);
}

router.get('/', handle(async (_req, res) => res.json(await query('SELECT ' + metadata + ' FROM chatbot_knowledge_documents ORDER BY id DESC'))));
router.get('/:id', documentId, handle(async (req, res) => {
    const [row] = await query('SELECT ' + allFields + ' FROM chatbot_knowledge_documents WHERE id = :id', { id: req.documentId });
    sendDocument(res, row);
}));
router.post('/', readFile, handle(async (req, res) => {
    const [row] = await query('INSERT INTO chatbot_knowledge_documents (name, content) VALUES (:name, :content) RETURNING ' + allFields, req.document);
    sendDocument(res, row, 201);
}));
router.put('/:id', documentId, readFile, handle(async (req, res) => {
    const [row] = await query('UPDATE chatbot_knowledge_documents SET name = :name, content = :content, version = version + 1, updated_at = NOW() WHERE id = :id RETURNING ' + allFields,
        { ...req.document, id: req.documentId });
    sendDocument(res, row);
}));
router.patch('/:id', documentId, handle(async (req, res) => {
    if (typeof req.body?.active !== 'boolean') return res.status(400).json({ message: 'Trạng thái áp dụng không hợp lệ.' });
    const [row] = await query('UPDATE chatbot_knowledge_documents SET active = :active, updated_at = NOW() WHERE id = :id RETURNING ' + metadata, { active: req.body.active, id: req.documentId });
    sendDocument(res, row);
}));
router.delete('/:id', documentId, handle(async (req, res) => {
    const [row] = await query('DELETE FROM chatbot_knowledge_documents WHERE id = :id RETURNING id', { id: req.documentId });
    if (!row) return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
    res.sendStatus(204);
}));

async function loadActiveDocuments() {
    try {
        return await query('SELECT id, name, content, version, active FROM chatbot_knowledge_documents WHERE active = TRUE');
    } catch (error) {
        if (error.original?.code !== '42P01') throw error;
        console.warn('[chat] knowledge migration pending');
        return [];
    }
}

module.exports = { answerPolicy, findPassages, isPolicyQuestion, router, loadActiveDocuments };
