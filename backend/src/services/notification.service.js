const { sequelize } = require('../config/database');

function shipmentDetails(shipment) {
    const details = [
        shipment?.carrier_name && `Đơn vị vận chuyển: ${shipment.carrier_name}`,
        shipment?.tracking_code && `Mã vận đơn: ${shipment.tracking_code}`,
    ].filter(Boolean);
    return details.length ? ` ${details.join('. ')}.` : '';
}

const orderEvents = {
    placed: ['Đã tiếp nhận đơn hàng', () => 'đã được tiếp nhận.'],
    confirmed: ['Đơn hàng đã xác nhận', () => 'đã được xác nhận và đang được chuẩn bị.'],
    picked_up: ['Đã bàn giao vận chuyển', ({ shipment }) =>
        `đã được bàn giao cho đơn vị vận chuyển.${shipmentDetails(shipment)}`],
    shipping: ['Đơn hàng đang giao', ({ shipment }) =>
        `đang trên đường giao đến bạn.${shipmentDetails(shipment)}`],
    delivered: ['Giao hàng thành công', () => 'đã được giao. Bạn có thể đánh giá sách trong đơn.'],
    cancelled: ['Đơn hàng đã hủy', ({ reason }) =>
        reason ? `đã được hủy. Lý do: ${reason}` : 'đã được hủy.'],
};

async function publishOrder(order, event, transaction, details = {}) {
    const [title, text] = orderEvents[event];
    await sequelize.query(
        `INSERT INTO customer_notification (recipient_user_id, event_type, title, message, order_id, event_key)
         VALUES ($userId, $type, $title, $message, $orderId, $key)
         ON CONFLICT (event_key) DO NOTHING`,
        {
            bind: {
                userId: order.user_id, orderId: order.order_id, type: `order_${event}`, title,
                message: `Đơn ${order.order_code} ${text(details)}`, key: `order:${order.order_id}:${event}`,
            },
            transaction,
        }
    );
}

async function publishShipment(order, shipment, transaction) {
    if (shipment.shipping_status === 'picked_up') {
        await publishOrder(order, 'picked_up', transaction, { shipment });
    } else if (shipment.shipping_status === 'in_transit') {
        await publishOrder(order, 'shipping', transaction, { shipment });
    }
}

async function publishReviewHidden(reviewId, reason, transaction) {
    await sequelize.query(
        `INSERT INTO customer_notification (recipient_user_id, event_type, title, message, review_id, book_title, reason)
         SELECT r.user_id, 'review_hidden', 'Đánh giá đã bị ẩn',
                format('Đánh giá của bạn về %s đã bị ẩn. Lý do: %s', b.title, $reason::text),
                r.review_id, b.title, $reason
         FROM review r JOIN book b USING (book_id) WHERE r.review_id = $reviewId`,
        { bind: { reviewId, reason }, transaction }
    );
}

module.exports = { publishOrder, publishShipment, publishReviewHidden };
