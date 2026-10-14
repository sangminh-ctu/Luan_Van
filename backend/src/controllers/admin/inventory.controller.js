const inventoryService = require('../../services/admin/inventory.service');

// 1. Báo cáo Tồn kho & Thống kê
exports.getInventory = async (req, res) => {
    try {
        const result = await inventoryService.getInventorySummary(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi tải dữ liệu tồn kho', error: error.message });
    }
};

// 2. Lấy danh sách Phiếu Nhập / Xuất kho
exports.getReceipts = async (req, res) => {
    try {
        const result = await inventoryService.getReceipts(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi tải danh sách phiếu kho', error: error.message });
    }
};

// 3. Lấy chi tiết 1 Phiếu
exports.getReceiptById = async (req, res) => {
    try {
        const receipt = await inventoryService.getReceiptById(req.params.id);
        if (!receipt) {
            return res.status(404).json({ message: 'Không tìm thấy phiếu kho' });
        }
        res.json(receipt);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi tải chi tiết phiếu kho', error: error.message });
    }
};

// 4. Lập Phiếu mới (Hỗ trợ auto_complete = true)
exports.createReceipt = async (req, res) => {
    try {
        const { type, supplier_name, note, details, auto_complete } = req.body;
        const newReceipt = await inventoryService.createReceipt({
            type,
            supplier_name,
            note,
            details,
            auto_complete: auto_complete === true || auto_complete === 'true'
        });
        res.status(201).json(newReceipt);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Mã phiếu kho đã tồn tại trong hệ thống' });
        }
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({ message: 'Một số sách trong phiếu không tồn tại trong hệ thống' });
        }
        res.status(500).json({ message: 'Lỗi tạo phiếu kho: ' + error.message });
    }
};

// 5. Duyệt hoàn tất Phiếu (Chống click đúp, chống race-condition & deadlock)
exports.completeReceipt = async (req, res) => {
    try {
        const completedReceipt = await inventoryService.completeReceipt(req.params.id);
        res.json({
            message: `Duyệt hoàn tất phiếu ${completedReceipt.receipt_code} thành công. Tồn kho đã được cập nhật.`,
            receipt: completedReceipt
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        if (error.message?.includes('stock_quantity_check') || error.parent?.message?.includes('stock_quantity_check')) {
            return res.status(409).json({ message: 'Không thể xuất kho: Số lượng tồn kho không được phép nhỏ hơn 0' });
        }
        res.status(500).json({ message: 'Lỗi duyệt phiếu kho: ' + error.message });
    }
};

// 6. Hủy Phiếu đang chờ
exports.cancelReceipt = async (req, res) => {
    try {
        const { reason } = req.body;
        const cancelledReceipt = await inventoryService.cancelReceipt(req.params.id, reason);
        res.json({
            message: `Đã hủy phiếu ${cancelledReceipt.receipt_code} thành công`,
            receipt: cancelledReceipt
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        res.status(500).json({ message: 'Lỗi hủy phiếu kho: ' + error.message });
    }
};
