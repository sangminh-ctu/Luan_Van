const addressService = require('../../services/customer/address.service');

const ensureCustomer = (req) => {
    if (req.user && req.user.role === 'admin') {
        const err = new Error('Tài khoản Quản trị viên không sử dụng sổ địa chỉ mua hàng');
        err.status = 403;
        throw err;
    }
};

exports.getAddresses = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const addresses = await addressService.getAddresses(userId);
        res.status(200).json({ addresses });
    } catch (error) {
        next(error);
    }
};

exports.createAddress = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const address = await addressService.createAddress(userId, req.body);
        res.status(201).json({ message: 'Đã thêm địa chỉ nhận hàng mới', address });
    } catch (error) {
        next(error);
    }
};

exports.updateAddress = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const addressId = Number(req.params.id);
        if (!Number.isInteger(addressId) || addressId <= 0) {
            return res.status(400).json({ message: 'ID địa chỉ không hợp lệ' });
        }

        const address = await addressService.updateAddress(userId, addressId, req.body);
        res.status(200).json({ message: 'Đã cập nhật địa chỉ nhận hàng', address });
    } catch (error) {
        next(error);
    }
};

exports.setDefaultAddress = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const addressId = Number(req.params.id);
        if (!Number.isInteger(addressId) || addressId <= 0) {
            return res.status(400).json({ message: 'ID địa chỉ không hợp lệ' });
        }

        const address = await addressService.setDefaultAddress(userId, addressId);
        res.status(200).json({ message: 'Đã đặt làm địa chỉ mặc định', address });
    } catch (error) {
        next(error);
    }
};

exports.deleteAddress = async (req, res, next) => {
    try {
        ensureCustomer(req);
        const userId = req.user.user_id || req.user.id;
        const addressId = Number(req.params.id);
        if (!Number.isInteger(addressId) || addressId <= 0) {
            return res.status(400).json({ message: 'ID địa chỉ không hợp lệ' });
        }

        const result = await addressService.deleteAddress(userId, addressId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
