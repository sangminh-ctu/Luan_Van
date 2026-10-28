const orderService = require('../../services/order.service');

exports.getOrders = async (req, res, next) => {
    try {
        const result = await orderService.getAdminOrders(req.query);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

exports.getOrderById = async (req, res, next) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'ID đơn hàng không hợp lệ' });
        }

        const order = await orderService.getAdminOrderById(orderId);
        res.status(200).json({ order });
    } catch (error) {
        next(error);
    }
};

exports.updateOrderStatus = async (req, res, next) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'ID đơn hàng không hợp lệ' });
        }

        const order = await orderService.updateOrderStatusByAdmin(orderId, req.body);
        res.status(200).json({
            message: 'Đã cập nhật trạng thái đơn hàng thành công',
            order
        });
    } catch (error) {
        next(error);
    }
};

exports.updateShipment = async (req, res, next) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'ID đơn hàng không hợp lệ' });
        }

        const order = await orderService.updateShipmentInfoByAdmin(orderId, req.body);
        res.status(200).json({
            message: 'Đã cập nhật thông tin vận chuyển thành công',
            order
        });
    } catch (error) {
        next(error);
    }
};
