const router = require('express').Router();
const { sequelize } = require('../../config/database');
const { verifyToken } = require('../../middlewares/auth.middleware');
const { fail, positiveInteger, optionalText, query } =
    require('../../services/review-moderation.service');

const reviewFields = `review_id, order_item_id, book_id, rating, comment, created_at,
                      visibility_status, moderation_reason, deleted_at`;
const pageSize = 10;

function reviewInput(body) {
    const { rating, comment } = body ?? {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        fail(400, 'Vui lòng chọn từ 1 đến 5 sao.');
    }
    return { rating, comment: optionalText(comment) };
}

router.get('/books/:bookId', async (req, res) => {
    const bookId = positiveInteger(req.params.bookId);
    const page = positiveInteger(req.query.page ?? 1);
    const [result] = await query(
        `WITH public_reviews AS NOT MATERIALIZED (
            SELECT * FROM review
            WHERE book_id = $bookId AND visibility_status = 'visible' AND deleted_at IS NULL
        ), summary AS (
            SELECT count(*)::int AS total, round(avg(rating), 1)::float AS average,
                   ARRAY[count(*) FILTER (WHERE rating = 1), count(*) FILTER (WHERE rating = 2),
                         count(*) FILTER (WHERE rating = 3), count(*) FILTER (WHERE rating = 4),
                         count(*) FILTER (WHERE rating = 5)]::int[] AS counts
            FROM public_reviews
        ), page_reviews AS (
            SELECT r.review_id, r.rating, r.comment, r.created_at,
                   u.full_name AS author_name
            FROM public_reviews r JOIN users u USING (user_id)
            ORDER BY r.created_at DESC NULLS LAST, r.review_id DESC
            LIMIT $limit OFFSET $offset
        )
        SELECT summary.*,
               COALESCE((SELECT json_agg(p ORDER BY p.created_at DESC NULLS LAST, p.review_id DESC)
                         FROM page_reviews p), '[]'::json) AS reviews
        FROM summary`,
        { bookId, limit: pageSize, offset: (page - 1) * pageSize }
    );
    res.json({ ...result, page, totalPages: Math.ceil(result.total / pageSize) });
});

router.use('/notifications', require('./notification.routes'));
router.use(verifyToken);

router.get('/mine', async (req, res) => {
    const raw = req.query.order_item_ids;
    if (typeof raw !== 'string' || raw.length > 2200) fail(400, 'Danh sách dòng đơn hàng không hợp lệ.');
    const itemIds = raw.split(',').map(positiveInteger);
    const reviews = await query(
        `SELECT ${reviewFields} FROM review
         WHERE user_id = $userId AND order_item_id = ANY($itemIds::int[])`,
        { userId: req.user.user_id, itemIds }
    );
    res.json({ reviews });
});

router.post('/order-items/:itemId', async (req, res) => {
    const itemId = positiveInteger(req.params.itemId);
    const userId = req.user.user_id;
    const input = reviewInput(req.body);
    const [result] = await query(
        `WITH eligible AS (
            SELECT oi.book_id FROM order_item oi JOIN orders o USING (order_id)
            WHERE oi.order_item_id = $itemId AND o.user_id = $userId AND o.order_status = 'delivered'
        ), inserted AS (
            INSERT INTO review (user_id, order_item_id, book_id, rating, comment)
            SELECT $userId, $itemId, book_id, $rating, $comment FROM eligible
            ON CONFLICT (order_item_id) DO NOTHING
            RETURNING ${reviewFields}
        )
        SELECT EXISTS (SELECT 1 FROM eligible) AS eligible,
               (SELECT row_to_json(inserted) FROM inserted) AS review`,
        { userId, itemId, ...input }
    );
    if (!result.eligible) fail(403, 'Bạn chỉ có thể đánh giá sách trong đơn đã giao của mình.');
    if (!result.review) fail(409, 'Bạn đã đánh giá dòng đơn hàng này.');
    res.status(201).json(result.review);
});

router.get('/books/:bookId/report-status', async (req, res) => {
    const rows = await query(
        `SELECT r.review_id, (r.user_id = $userId) AS own,
                EXISTS (SELECT 1 FROM review_report p WHERE p.review_id = r.review_id
                         AND p.reporter_user_id = $userId) AS reported
         FROM review r WHERE r.book_id = $bookId AND r.deleted_at IS NULL
            AND r.visibility_status = 'visible' AND (r.user_id = $userId OR EXISTS (
                SELECT 1 FROM review_report p WHERE p.review_id = r.review_id AND p.reporter_user_id = $userId))`,
        { bookId: positiveInteger(req.params.bookId), userId: req.user.user_id }
    );
    res.json(rows);
});

router.post('/:reviewId/reports', async (req, res) => {
    const reviewId = positiveInteger(req.params.reviewId);
    const userId = req.user.user_id;
    const { reason, description } = req.body ?? {};
    if (!['spam', 'harassment', 'personal_info', 'inappropriate', 'other'].includes(reason)) {
        fail(400, 'Vui lòng chọn lý do báo cáo.');
    }
    const details = optionalText(description);
    if (reason === 'other' && !details) fail(400, 'Vui lòng mô tả lý do báo cáo.');
    await sequelize.transaction(async transaction => {
        // Serialize each reporter's submissions before enforcing the rolling limit.
        await query('SELECT pg_advisory_xact_lock(-1, $userId::int)', { userId }, transaction);
        const [review] = await query(
            'SELECT * FROM review WHERE review_id = $reviewId FOR UPDATE', { reviewId }, transaction
        );
        if (!review || review.deleted_at || review.visibility_status !== 'visible') {
            fail(404, 'Đánh giá này hiện không công khai.');
        }
        if (review.user_id === userId) fail(403, 'Bạn không thể báo cáo đánh giá của chính mình.');
        const [stats] = await query(
            `SELECT EXISTS (SELECT 1 FROM review_report
                 WHERE reporter_user_id = $userId AND review_id = $reviewId) AS reported,
                 (SELECT count(*)::int FROM review_report WHERE reporter_user_id = $userId
                   AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') AS recent`,
            { userId, reviewId }, transaction
        );
        if (stats.reported) fail(409, 'Bạn đã gửi báo cáo cho đánh giá này.', 'ALREADY_REPORTED');
        if (stats.recent >= 10) fail(429, 'Bạn đã gửi tối đa 10 báo cáo trong một giờ.');
        await query(
            `INSERT INTO review_report (review_id, reporter_user_id, reason, description,
                                        reported_rating, reported_comment, review_version)
             VALUES ($reviewId, $userId, $reason, $details, $rating, $comment, $version)`,
            { reviewId, userId, reason, details, rating: review.rating, comment: review.comment, version: review.version },
            transaction
        );
        await query('UPDATE review SET version = version + 1 WHERE review_id = $reviewId', { reviewId }, transaction);
    });
    res.status(201).json({ reported: true });
});

module.exports = router;
