const router = require('express').Router();
const { verifyToken } = require('../../middlewares/auth.middleware');
const { positiveInteger, query } = require('../../services/review-moderation.service');

router.use(verifyToken);

router.get('/', async (req, res) => {
    const before = req.query.before == null ? null : positiveInteger(req.query.before);
    const limit = req.query.limit == null ? 10 : Math.min(10, positiveInteger(req.query.limit));
    const [{ notifications, unread }] = await query(
        `WITH page AS (
            SELECT notification_id, event_type, title, message, order_id, book_title, reason, created_at, read_at
            FROM customer_notification
            WHERE recipient_user_id = $userId AND ($before::int IS NULL OR notification_id < $before)
            ORDER BY notification_id DESC LIMIT $limit
        )
        SELECT COALESCE((SELECT json_agg(page ORDER BY notification_id DESC) FROM page), '[]'::json) AS notifications,
               (SELECT count(*)::int FROM customer_notification
                WHERE recipient_user_id = $userId AND read_at IS NULL) AS unread`,
        { userId: req.user.user_id, before, limit: limit + 1 }
    );
    const page = notifications.slice(0, limit);
    res.json({ notifications: page, next: notifications.length > limit ? page[limit - 1].notification_id : null, unread });
});

router.patch('/read', async (req, res) => {
    const through = positiveInteger(req.body?.through);
    await query(
        `UPDATE customer_notification SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_user_id = $userId AND read_at IS NULL AND notification_id <= $through`,
        { userId: req.user.user_id, through }
    );
    res.sendStatus(204);
});

router.patch('/:id/read', async (req, res) => {
    const id = positiveInteger(req.params.id);
    await query(
        `UPDATE customer_notification SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_user_id = $userId AND read_at IS NULL AND notification_id = $id`,
        { userId: req.user.user_id, id }
    );
    res.sendStatus(204);
});

module.exports = router;
