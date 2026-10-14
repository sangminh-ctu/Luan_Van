const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/admin/inventory.controller');

// 1. Quản lý Tồn kho
router.get('/inventory', inventoryController.getInventory);

// 2. Quản lý Phiếu Nhập / Xuất kho
router.get('/stock-receipts', inventoryController.getReceipts);
router.get('/stock-receipts/:id', inventoryController.getReceiptById);
router.post('/stock-receipts', inventoryController.createReceipt);
router.patch('/stock-receipts/:id/complete', inventoryController.completeReceipt);
router.patch('/stock-receipts/:id/cancel', inventoryController.cancelReceipt);

module.exports = router;
