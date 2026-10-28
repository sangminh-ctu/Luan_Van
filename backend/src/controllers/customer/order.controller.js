const orderService = require('../../services/order.service');

const ensureCustomer = (req) => {
    if (req.user && req.user.role === 'admin') {
        const err = new Error('Tài khoản Quản trị viên không sử dụng chức năng đặt hàng của khách');
        err.status = 403;
        throw err;
    }
};

exports.getShippingConfig = (req, res, next) => {
    try {
        const config = orderService.getShippingConfig();
        res.status(200).json(config);
    } catch (error) {
        next(error);
    }
};

exports.createOrder = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const order = await orderService.createOrder(userId, req.body);
        res.status(201).json({
            message: 'Đặt hàng thành công',
            order
        });
    } catch (error) {
        next(error);
    }
};

exports.getMyOrders = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const result = await orderService.getCustomerOrders(userId, req.query);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

exports.getMyOrderDetail = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const idOrCode = req.params.id;
        const order = await orderService.getCustomerOrderById(userId, idOrCode);
        res.status(200).json({ order });
    } catch (error) {
        next(error);
    }
};

exports.cancelMyOrder = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const orderId = Number(req.params.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'ID đơn hàng không hợp lệ' });
        }

        const order = await orderService.cancelOrderByCustomer(userId, orderId);
        res.status(200).json({
            message: 'Đã hủy đơn hàng và hoàn lại số lượng sách vào kho',
            order
        });
    } catch (error) {
        next(error);
    }
};
