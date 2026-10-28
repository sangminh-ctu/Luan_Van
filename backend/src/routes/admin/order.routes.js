const express = require('express');
const router = express.Router();
const adminOrderController = require('../../controllers/admin/order.controller');

router.get('/', adminOrderController.getOrders);
router.get('/:id', adminOrderController.getOrderById);
router.patch('/:id/status', adminOrderController.updateOrderStatus);
router.patch('/:id/shipment', adminOrderController.updateShipment);

module.exports = router;
