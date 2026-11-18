const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const databaseName = `review_test_${Date.now()}_${process.pid}`;
const source = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, port: process.env.DB_PORT, dialect: 'postgres', logging: false
});

async function run() {
    let created = false;
    let db;
    let server;
    try {
        await source.query(`CREATE DATABASE "${databaseName}"`);
        created = true;
        process.env.DB_NAME = databaseName;
        db = require('../src/config/database').sequelize;
        await db.query(`
            CREATE TABLE users (user_id int PRIMARY KEY, full_name text NOT NULL);
            CREATE TABLE book (book_id int PRIMARY KEY, title text NOT NULL);
            CREATE TABLE orders (order_id int PRIMARY KEY, user_id int REFERENCES users, order_status text NOT NULL,
                                 order_date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE order_item (order_item_id int PRIMARY KEY, order_id int REFERENCES orders, book_id int REFERENCES book);
            CREATE TABLE review (
                review_id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users, book_id int NOT NULL REFERENCES book,
                rating int NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text,
                created_at timestamp DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users SELECT n, 'User ' || n FROM generate_series(1, 5) n;
            INSERT INTO book SELECT n, 'Book ' || n FROM generate_series(1, 12) n;
            INSERT INTO orders (order_id, user_id, order_status)
                VALUES (1, 1, 'delivered'), (2, 2, 'shipping'), (3, 1, 'delivered');
            INSERT INTO order_item SELECT n, 1, n FROM generate_series(1, 12) n;
            INSERT INTO order_item VALUES (13, 2, 1), (14, 3, 2), (15, 3, 12);
            INSERT INTO review (user_id, book_id, rating, comment)
                VALUES (1, 1, 1, 'Original review'), (1, 12, 4, 'Legacy review with several possible orders');
        `);
        const migrations = [
            '014_book_reviews.sql', '015_review_moderation.sql', '016_order_item_reviews.sql',
            '017_drop_legacy_review_columns.sql', '018_review_notification_read.sql',
            '019_customer_notifications.sql'
        ];
        async function migrate() {
            for (const migration of migrations) {
                const sql = fs.readFileSync(path.join(__dirname, '../../database/migrations', migration), 'utf8');
                await db.transaction(transaction => db.query(sql, { transaction }));
            }
        }
        await migrate();
        await db.query(`
            INSERT INTO review (user_id, book_id, rating) VALUES (5, 3, 2);
            INSERT INTO review_notification (review_id, recipient_user_id, book_title, reason, created_at, read_at)
            SELECT review_id, 5, 'Book 3', 'Imported reason', '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z'
            FROM review WHERE user_id = 5 AND book_id = 3
        `);
        await migrate();

        server = require('../src/app').listen(0, '127.0.0.1');
        await once(server, 'listening');
        const baseURL = `http://127.0.0.1:${server.address().port}/api`;

        async function request(route, { user, method = 'GET', body } = {}) {
            const headers = { 'Content-Type': 'application/json' };
            if (user) {
                const role = user >= 4 ? 'admin' : 'customer';
                headers.Authorization = 'Bearer ' + jwt.sign({ user_id: user, role }, process.env.JWT_SECRET);
            }
            const response = await fetch(baseURL + route, { method, headers, body: JSON.stringify(body) });
            const json = response.headers.get('content-type')?.includes('application/json');
            return { status: response.status, data: json ? await response.json() : null };
        }

        async function check(status, route, options) {
            const result = await request(route, options);
            assert.equal(result.status, status, JSON.stringify(result.data));
            return result.data;
        }

        const reviews = '/reviews/books/1';
        const admin = '/admin/reviews';
        const notifications = '/notifications';
        const read = id => check(200, `${admin}/${id}`, { user: 4 });
        const submit = (id, user, reason = 'spam', description) =>
            request(`/reviews/${id}/reports`, { user, method: 'POST', body: { reason, description } });
        const moderate = (review, action, user = 4, reason = 'spam', customReason) =>
            request(`${admin}/${review.review_id}/moderate`, {
                user, method: 'POST', body: { action, version: review.version, reason, customReason }
            });
        const create = (itemId, user = 1, body = { rating: 3 }) =>
            request(`/reviews/order-items/${itemId}`, { user, method: 'POST', body });
        const list = () => check(200, reviews);
        const legacy = await list();
        const imported = await check(200, notifications, { user: 5 });
        assert.equal(imported.unread, 0);
        assert.equal(imported.notifications.length, 1);
        assert.equal(imported.notifications[0].event_type, 'review_hidden');
        assert.equal(imported.notifications[0].reason, 'Imported reason');
        assert.equal(new Date(imported.notifications[0].read_at).toISOString(), '2025-01-02T00:00:00.000Z');
        assert.equal(legacy.average, 1);
        const id = legacy.reviews[0].review_id;
        assert.equal((await read(id)).order_item_id, 1);
        const ambiguous = await check(200, '/reviews/books/12');
        assert.equal((await read(ambiguous.reviews[0].review_id)).order_item_id, null);
        assert.equal((await create(1)).status, 409);
        assert.equal((await create(13, 2)).status, 403);
        assert.equal((await create(2, 2)).status, 403);
        assert.equal((await create(2, 1, { rating: 6 })).status, 400);
        await check(403, admin, { user: 2 });

        const sameItem = await Promise.all([create(2), create(2)]);
        assert.deepEqual(sameItem.map(r => r.status).sort(), [201, 409]);
        const [saved] = sameItem.filter(r => r.status === 201);
        assert.equal(saved.data.order_item_id, 2);
        const repeatedPurchase = await create(14, 1, { rating: 5, comment: 'Another purchase' });
        assert.equal(repeatedPurchase.status, 201);
        assert.equal(repeatedPurchase.data.book_id, saved.data.book_id);
        const mine = await check(200, '/reviews/mine?order_item_ids=2,14', { user: 1 });
        assert.deepEqual(mine.reviews.map(r => r.order_item_id).sort((a, b) => a - b), [2, 14]);
        assert.deepEqual((await check(200, '/reviews/mine?order_item_ids=2,14', { user: 2 })).reviews, []);
        for (const route of [reviews, '/reviews/order-items/2']) {
            for (const method of ['PATCH', 'DELETE']) {
                await check(404, route, { user: 1, method, body: { rating: 5 } });
            }
        }
        await migrate(); // Old migrations must not reintroduce unique-by-book after repeat purchases.

        assert.equal((await submit(id, 1)).status, 403);
        assert.equal((await submit(id, 2, 'other', ' ')).status, 400);
        assert.deepEqual(
            (await Promise.all([submit(id, 2), submit(id, 2)])).map(r => r.status).sort(), [201, 409]
        );
        assert.equal((await submit(id, 3, 'inappropriate')).status, 201);
        const grouped = await check(200, admin, { user: 4 });
        assert.equal(grouped.pending, 1);
        assert.equal(grouped.reviews[0].pending_reports, 2);
        assert.equal((await list()).total, 1);
        const reported = await check(200, reviews + '/report-status', { user: 2 });
        assert.deepEqual(reported, [{ review_id: id, own: false, reported: true }]);
        const first = await read(id);
        assert.equal(first.reports[0].reported_comment, 'Original review');
        assert.deepEqual(
            (await Promise.all([moderate(first, 'kept'), moderate(first, 'kept', 5)])).map(r => r.status).sort(),
            [204, 409]
        );
        assert.equal((await list()).average, 1);
        assert.ok((await read(id)).reports.every(r => r.status === 'rejected'));
        assert.equal((await submit(id, 2)).status, 409);
        assert.equal((await submit(id, 4, 'other', 'A concrete report')).status, 201);
        const toHide = await read(id);
        assert.equal((await moderate(toHide, 'hidden', 4, 'invalid')).status, 400);
        assert.deepEqual(
            (await Promise.all([moderate(toHide, 'hidden'), moderate(toHide, 'hidden', 5)])).map(r => r.status).sort(),
            [204, 409]
        );
        const hiddenSummary = await list();
        assert.equal(hiddenSummary.total, 0);
        assert.equal(hiddenSummary.average, null);
        assert.deepEqual(hiddenSummary.counts, [0, 0, 0, 0, 0]);
        const hidden = await read(id);
        assert.equal(hidden.reports.find(r => r.reporter_user_id === 4).status, 'resolved');
        assert.equal(hidden.history.filter(h => h.action === 'hidden').length, 1);
        assert.equal((await create(1)).status, 409);
        const ownNotification = await check(200, notifications, { user: 1 });
        assert.equal(ownNotification.notifications.length, 1);
        assert.equal(ownNotification.unread, 1);
        assert.equal(ownNotification.notifications[0].read_at, null);
        assert.equal(ownNotification.notifications[0].book_title, 'Book 1');
        assert.equal(ownNotification.notifications[0].reason, hidden.moderation_reason);
        assert.deepEqual((await check(200, notifications, { user: 2 })).notifications, []);
        const hiddenOwnerReview = await check(200, '/reviews/mine?order_item_ids=1', { user: 1 });
        assert.equal(hiddenOwnerReview.reviews[0].visibility_status, 'hidden');
        assert.equal(hiddenOwnerReview.reviews[0].moderation_reason, hidden.moderation_reason);
        assert.equal((await moderate(hidden, 'restored')).status, 204);
        assert.equal((await list()).average, 1);
        assert.equal((await create(1)).status, 409);
        assert.equal((await check(200, notifications, { user: 1 })).notifications.length, 1);
        const restored = await read(id);
        assert.equal((await moderate(restored, 'hidden', 4, 'other', '   ')).status, 400);
        assert.equal((await moderate(restored, 'hidden', 4, 'other', '  Includes an unrelated promotional link.  ')).status, 204);
        const customHidden = await read(id);
        assert.equal(customHidden.moderation_reason, 'Includes an unrelated promotional link.');
        assert.equal(customHidden.history[0].reason, customHidden.moderation_reason);
        const updatedNotifications = await check(200, notifications, { user: 1 });
        assert.equal(updatedNotifications.notifications[0].reason, customHidden.moderation_reason);
        const latestId = updatedNotifications.notifications[0].notification_id;
        const firstNotificationId = ownNotification.notifications[0].notification_id;
        const markRead = (user, through) => check(204, notifications + '/read', {
            user, method: 'PATCH', body: { through }
        });
        await markRead(2, latestId);
        assert.equal((await check(200, notifications, { user: 1 })).unread, 2);
        await markRead(1, firstNotificationId);
        const partlyRead = await check(200, notifications, { user: 1 });
        assert.equal(partlyRead.unread, 1);
        assert.equal(partlyRead.notifications[0].read_at, null);
        assert.ok(partlyRead.notifications[1].read_at);
        await check(204, notifications + '/' + latestId + '/read', { user: 2, method: 'PATCH' });
        assert.equal((await check(200, notifications, { user: 1 })).unread, 1);
        await check(204, notifications + '/' + latestId + '/read', { user: 1, method: 'PATCH' });
        await markRead(1, latestId);
        assert.equal((await check(200, notifications, { user: 1 })).unread, 0);
        const limited = await check(200, notifications + '?limit=1', { user: 1 });
        assert.equal(limited.notifications.length, 1);
        const older = await check(200, notifications + '?before=' + limited.next, { user: 1 });
        assert.equal(older.notifications[0].notification_id, firstNotificationId);
        assert.equal((await check(200, notifications, { user: 5 })).notifications.length, 1);
        for (let itemId = 2; itemId <= 10; itemId++) {
            const review = itemId === 2 ? saved : await create(itemId);
            assert.equal(review.status, 201);
            assert.equal((await submit(review.data.review_id, 2)).status, 201);
        }
        const extra = await create(11);
        assert.equal(extra.status, 201);
        assert.equal((await submit(extra.data.review_id, 2)).status, 429);
        console.log('PASS legacy migration, write-once reviews, repeat purchases, reporting, notifications and moderation.');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.close();
        try {
            if (created) await source.query(`DROP DATABASE "${databaseName}"`);
        } finally {
            await source.close();
        }
    }
}

run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
