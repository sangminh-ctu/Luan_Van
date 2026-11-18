const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');

function fail(status, message, code) {
    throw Object.assign(new Error(message), { status, code, logToConsole: false });
}

function positiveInteger(value) {
    if (!/^\d{1,10}$/.test(String(value))) fail(400, 'Tham số không hợp lệ.');
    const id = Number(value);
    if (id < 1 || id > 2147483647) fail(400, 'Tham số không hợp lệ.');
    return id;
}

function optionalText(value) {
    if (value == null) return null;
    if (typeof value !== 'string' || value.length > 1000 || value.includes('\0')) {
        fail(400, 'Nội dung phải là văn bản tối đa 1.000 ký tự.');
    }
    return value.trim() || null;
}

function query(sql, bind, transaction) {
    return sequelize.query(sql, { bind, transaction, type: QueryTypes.SELECT });
}

async function recordAction(review, actorId, action, reason, transaction) {
    await query(
        `INSERT INTO review_moderation_history (review_id, actor_user_id, action, reason, review_version)
         VALUES ($reviewId, $actorId, $action, $reason, $version)`,
        { reviewId: review.review_id, version: review.version, actorId, action, reason }, transaction
    );
}

async function closeReports(reviewId, status, resolution, transaction) {
    await query(
        `UPDATE review_report SET status = $status, resolution = $resolution, closed_at = CURRENT_TIMESTAMP
         WHERE review_id = $reviewId AND status = 'pending'`,
        { reviewId, status, resolution }, transaction
    );
}

module.exports = { fail, positiveInteger, optionalText, query, recordAction, closeReports };
