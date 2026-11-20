const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');

process.env.AI_PROVIDER = 'disabled';
delete process.env.AI_FALLBACK_PROVIDER;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { sequelize } = require('../src/config/database');
const app = require('../src/app');
const catalog = require('../src/services/customer/catalog.service');
const { normalize } = require('../src/services/customer/chat/fallback-parser');
const { recommend } = require('../src/services/customer/chat');

function token(userId, role = 'customer') {
    return 'Bearer ' + jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET);
}

test('Chatbot HTTP và FAQ với PostgreSQL trong giao dịch riêng', async t => {
    let transaction;
    let server;
    t.after(async () => {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        try { await transaction?.rollback(); } finally { await sequelize.close(); }
    });
    transaction = await sequelize.transaction();
    const schema = 'chatbot_test_' + randomBytes(8).toString('hex');
    await sequelize.query('CREATE SCHEMA ' + schema, { transaction });
    await sequelize.query('SET LOCAL search_path TO ' + schema + ', public', { transaction });
    const migration = await readFile(join(__dirname, '../../database/migrations/020_chatbot_knowledge.sql'), 'utf8');
    await sequelize.query(migration.replace(/^\uFEFF/, ''), { transaction });
    const originalQuery = sequelize.query.bind(sequelize);
    t.mock.method(sequelize, 'query', (sql, options) => originalQuery(sql, { ...options, transaction }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port + '/api';
    const admin = { Authorization: token(1, 'admin') };
    const owner = { Authorization: token(2) };
    const otherOwner = { Authorization: token(3) };
    const request = (path, options) => fetch(url + path, options);
    const chat = (message, credentials = {}, headers = {}) => request('/chat/messages', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, ...credentials }),
    });
    const file = (filename, content) => {
        const body = new FormData();
        body.append('file', new Blob([content], { type: 'text/plain' }), filename);
        return body;
    };

    await t.test('CRUD tài liệu, quyền admin, lọc theo phiên bản và nguồn chính sách', async () => {
        const path = '/admin/chat-knowledge';
        assert.equal((await request(path, { headers: owner })).status, 403);
        assert.equal((await request(path, { method: 'POST', headers: admin, body: file('bad.pdf', 'Invalid') })).status, 400);
        const created = await request(path, { method: 'POST', headers: admin, body: file('Đổi trả.md', '# Đổi trả\nSách giao nhầm được đổi trong 30 ngày.') });
        assert.equal(created.status, 201);
        const doc = await created.json();
        const listed = await (await request(path, { headers: admin })).json();
        assert.deepEqual(listed.map(item => item.id), [doc.id]);
        const detail = await (await request(path + '/' + doc.id, { headers: admin })).json();
        assert.match(detail.content, /30 ngày/);
        const updated = await request(path + '/' + doc.id, { method: 'PUT', headers: admin,
            body: file('Đổi trả.md', '# Đổi trả\nSách giao nhầm được đổi trong 7 ngày.') });
        assert.equal((await updated.json()).version, 2);
        const answer = await (await chat('Sách giao nhầm đổi trong bao lâu?')).json();
        assert.match(answer.reply, /7 ngày/);
        assert.deepEqual(answer.sources, [{ id: doc.id, name: 'Đổi trả.md', version: 2, section: 'Đổi trả' }]);
        const toggled = await request(path + '/' + doc.id, { method: 'PATCH', headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) });
        assert.equal((await toggled.json()).active, false);
        const inactive = await (await chat('Sách giao nhầm đổi trong bao lâu?')).json();
        assert.deepEqual(inactive.sources, []);
        assert.equal((await request(path + '/' + doc.id, { method: 'DELETE', headers: admin })).status, 204);
        assert.deepEqual(await (await request(path, { headers: admin })).json(), []);
    });

    await t.test('Phiên khách và tài khoản khác không mở được hội thoại', async () => {
        const first = await (await chat('Xin chào', {}, owner)).json();
        assert.equal(first.intent, 'greeting');
        const { conversationId, conversationToken } = first;
        const path = '/chat/conversations/' + conversationId;
        const headers = { 'X-Conversation-Token': conversationToken };
        assert.equal((await request(path, { headers: { ...otherOwner, ...headers } })).status, 404);
        assert.equal((await request(path, { headers })).status, 404);
        assert.equal((await request(path, { headers: owner })).status, 404);
        const own = await (await request(path, { headers: { ...owner, ...headers } })).json();
        assert.equal(own.turns[0].message, 'Xin chào');
        const guest = await (await chat('Chào bạn')).json();
        const next = await (await chat('Cảm ơn', guest)).json();
        assert.equal(next.conversationId, guest.conversationId);
        assert.notEqual(guest.conversationId, conversationId);
    });

    await t.test('Tra tên bỏ dấu và đối chiếu giá với danh mục thật', async () => {
        const { books } = await catalog.getBooks({ search: 'Rừng Xanh Nước Bạc' });
        const target = books.find(book => normalize(book.title) === 'rung xanh nuoc bac');
        assert.ok(target, 'Cần có sách Rừng Xanh Nước Bạc trong bộ dữ liệu danh mục.');
        const expected = await catalog.getBookById(target.book_id);
        const response = await chat('Sach rung xanh nuoc bac hien gia bao nhieu va co giam gia khong');
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.intent, 'book_lookup');
        assert.equal(result.aspect, 'price');
        assert.deepEqual(result.books.map(book => book.id), [expected.book_id]);
        assert.equal(result.books[0].price, Number(expected.final_price));
        const multi = await recommend('Rừng Xanh Nước Bạc còn hàng không, giá bao nhiêu và có giảm không?');
        assert.deepEqual(multi.books.map(book => book.id), [expected.book_id]);
        assert.deepEqual(multi.aspects, ['stock', 'price', 'discount']);
        assert.equal(multi.books[0].price, Number(expected.final_price));
    });

    await t.test('Truy vấn chủ đề thực tế không thay bằng sách khác vừa ngân sách', async () => {
        const result = await (await chat('Có sách học Xylophonorific cho người mới dưới 200k không?')).json();
        assert.deepEqual(result.books, []);
        assert.equal(result.reply, 'Hiện mình chưa tìm thấy sách phù hợp.');
    });

    await t.test('Hỏi sách dưới 300 nghìn trả sách thật dù chủ đề cũ không khớp', async () => {
        const response = await chat('sách dưới 300 nghìn', { context: {
            title: 'Sách không tồn tại', keywords: ['duoc', 'ao'], requiredKeywords: ['duoc', 'ao'],
        } });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.ok(result.books.length > 0);
        assert.match(result.reply, /dưới 300\.000đ/);
        for (const book of result.books) {
            assert.ok(book.price < 300000);
            const detail = await catalog.getBookById(book.id);
            assert.ok(Number(detail.inventory?.stock_quantity) > 0);
        }
    });

    await t.test('Tra sách giá thường trên PostgreSQL loại cả giảm giá thực tế', async () => {
        const result = await recommend('có sách nào không giảm giá không');
        const { books } = await catalog.getBooks({ in_stock: true, sort: 'featured', limit: 48 }, { regularPriceOnly: true });
        assert.ok(result.books.length > 0);
        assert.deepEqual(result.books.map(book => book.id), books.slice(0, 3).map(book => book.book_id));
        assert.match(result.reply, /giá thường/);
        assert.ok(result.books.every(book => book.originalPrice === null));
        for (const book of result.books) {
            const detail = await catalog.getBookById(book.id);
            assert.ok(Number(detail.final_price) >= Number(detail.base_price ?? detail.price));
        }
        const next = await recommend('Vẫn chủ đề đó, tăng lên 250 nghìn, giảm hay không cũng được', {
            discountStatus: 'regular', maxPrice: 100000,
        });
        assert.equal(next.context.discountStatus, 'any');
        assert.equal(next.context.maxPrice, 250000);
        assert.ok(next.books.length > 0 && next.books.every(book => book.price <= 250000));
    });
});
