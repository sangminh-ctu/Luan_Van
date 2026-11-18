const router = require('express').Router();
const { sequelize } = require('../../config/database');
const { publishReviewHidden } = require('../../services/notification.service');
const { fail, positiveInteger, optionalText, query, recordAction, closeReports } =
    require('../../services/review-moderation.service');

const pageSize = 15;
const hideReasons = new Map([
    ['spam', 'Spam hoặc quảng cáo'],
    ['harassment', 'Xúc phạm hoặc quấy rối'],
    ['personal_info', 'Tiết lộ thông tin cá nhân'],
    ['inappropriate', 'Nội dung không phù hợp'],
]);

router.get('/', async (req, res) => {
    const filter = req.query.filter ?? 'pending';
    if (!['pending', 'all', 'hidden'].includes(filter)) fail(400, 'Bộ lọc không hợp lệ.');
    const page = positiveInteger(req.query.page ?? 1);
    const search = req.query.search ?? '';
    if (typeof search !== 'string' || search.length > 200) fail(400, 'Từ khóa không hợp lệ.');
    const [result] = await query(
        `WITH reviews AS (
            SELECT r.review_id, r.rating, r.comment, r.visibility_status, r.deleted_at,
                   r.created_at, b.title AS book_title,
                   u.full_name AS author_name, COALESCE(p.pending_count, 0) AS pending_reports
            FROM review r
            JOIN book b USING (book_id)
            JOIN users u USING (user_id)
            LEFT JOIN (
                SELECT review_id, count(*)::int AS pending_count
                FROM review_report WHERE status = 'pending' GROUP BY review_id
            ) p USING (review_id)
            WHERE strpos(lower(b.title), lower($search)) > 0 OR $search = ''
        ), queue AS (
            SELECT *, deleted_at IS NULL AND pending_reports > 0 AS needs_action
            FROM reviews
        ), filtered AS (
            SELECT * FROM queue WHERE $filter = 'all' OR ($filter = 'pending' AND needs_action)
                OR ($filter = 'hidden' AND visibility_status = 'hidden' AND deleted_at IS NULL)
        ), page_rows AS (
            SELECT * FROM filtered ORDER BY created_at DESC NULLS LAST, review_id DESC
            LIMIT $limit OFFSET $offset
        )
        SELECT (SELECT count(*)::int FROM filtered) AS total,
               (SELECT count(*)::int FROM queue WHERE deleted_at IS NULL) AS active,
               (SELECT count(*)::int FROM queue WHERE needs_action) AS pending,
               (SELECT count(*)::int FROM queue WHERE visibility_status = 'hidden' AND deleted_at IS NULL) AS hidden,
               COALESCE((SELECT json_agg(p ORDER BY p.created_at DESC NULLS LAST, p.review_id DESC)
                         FROM page_rows p), '[]'::json) AS reviews`,
        { filter, search: search.trim(), limit: pageSize, offset: (page - 1) * pageSize }
    );
    res.json({ ...result, page, totalPages: Math.ceil(result.total / pageSize) });
});

router.get('/:id', async (req, res) => {
    const [review] = await query(
        `SELECT r.review_id, r.book_id, r.order_item_id, r.rating, r.comment, r.visibility_status, r.version,
                r.created_at, r.deleted_at, r.moderation_reason,
                b.title AS book_title, u.full_name AS author_name,
                COALESCE((SELECT json_agg(p ORDER BY p.created_at DESC, p.report_id DESC)
                          FROM review_report p WHERE p.review_id = r.review_id), '[]'::json) AS reports,
                COALESCE((SELECT json_agg(h ORDER BY h.history_id DESC) FROM (
                    SELECT l.history_id, l.action, l.reason, l.created_at, a.full_name AS actor_name
                    FROM review_moderation_history l LEFT JOIN users a ON a.user_id = l.actor_user_id
                    WHERE l.review_id = r.review_id
                ) h), '[]'::json) AS history
         FROM review r JOIN book b USING (book_id) JOIN users u USING (user_id)
         WHERE r.review_id = $reviewId`,
        { reviewId: positiveInteger(req.params.id) }
    );
    if (!review) fail(404, 'Không tìm thấy đánh giá.');
    res.json(review);
});

router.post('/:id/moderate', async (req, res) => {
    const reviewId = positiveInteger(req.params.id);
    const { action, version, reason, customReason } = req.body ?? {};
    if (!['kept', 'hidden', 'restored'].includes(action)) {
        fail(400, 'Quyết định kiểm duyệt không hợp lệ.');
    }
    const expectedVersion = positiveInteger(version);
    let explanation;
    if (action === 'hidden') {
        explanation = reason === 'other' ? optionalText(customReason) : hideReasons.get(reason);
        if (!explanation) {
            fail(400, reason === 'other' ? 'Vui lòng nhập lý do ẩn cụ thể.' : 'Vui lòng chọn lý do ẩn.');
        }
    } else {
        explanation = optionalText(reason);
    }
    await sequelize.transaction(async transaction => {
        const [current] = await query(
            `SELECT r.*, EXISTS (SELECT 1 FROM review_report p
                            WHERE p.review_id = r.review_id AND p.status = 'pending') AS has_reports
             FROM review r WHERE review_id = $reviewId FOR UPDATE OF r`,
            { reviewId }, transaction
        );
        if (!current) fail(404, 'Không tìm thấy đánh giá.');
        if (current.version !== expectedVersion) {
            fail(409, 'Đánh giá đã thay đổi. Vui lòng tải lại trước khi xử lý.');
        }
        if (current.deleted_at) fail(409, 'Tác giả đã xóa đánh giá này.');
        const hidden = current.visibility_status === 'hidden';
        const permitted = {
            kept: !hidden && current.has_reports,
            hidden: !hidden,
            restored: hidden
        };
        if (!permitted[action]) fail(409, 'Thao tác không phù hợp với trạng thái đánh giá.');
        const nextHidden = action === 'hidden';
        const [updated] = await query(
            `UPDATE review SET visibility_status = $visibility, moderation_reason = $reason,
                    version = version + 1
             WHERE review_id = $reviewId RETURNING review_id, version`,
            { reviewId, visibility: nextHidden ? 'hidden' : 'visible', reason: nextHidden ? explanation : null },
            transaction
        );
        if (current.has_reports) {
            await closeReports(reviewId, action === 'kept' ? 'rejected' : 'resolved',
                action === 'kept' ? 'kept' : 'hidden', transaction);
        }
        await recordAction(updated, req.user.user_id, action, explanation, transaction);
        if (nextHidden) await publishReviewHidden(reviewId, explanation, transaction);
    });
    res.sendStatus(204);
});

module.exports = router;
