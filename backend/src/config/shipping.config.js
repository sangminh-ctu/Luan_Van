/**
 * Cấu hình phí vận chuyển cố định phía Server
 */
const FREE_SHIPPING_THRESHOLD = 300000;
const STANDARD_SHIPPING_FEE = 30000;

function calculateShippingFee(subtotal) {
    const amount = Number(subtotal) || 0;
    if (amount <= 0) return 0;
    return amount >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}

module.exports = {
    FREE_SHIPPING_THRESHOLD,
    STANDARD_SHIPPING_FEE,
    calculateShippingFee
};
