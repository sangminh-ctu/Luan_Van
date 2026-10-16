const cartService = require('../../services/customer/cart.service');

// Middleware phụ kiểm tra chỉ khách hàng mới dùng giỏ hàng
const ensureCustomer = (req, res) => {
    if (req.user && req.user.role === 'admin') {
        const err = new Error('Tài khoản Quản trị viên không sử dụng chức năng giỏ hàng');
        err.status = 403;
        throw err;
    }
};

exports.getCart = async (req, res, next) => {
    try {
        ensureCustomer(req, res);
        const userId = req.user.user_id || req.user.id;
        const result = await cartService.getCart(userId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

exports.addToCart = async (req, res, next) => {
    try {
        ensureCustomer(req, res);
        const userId = req.user.user_id || req.user.id;
        const { book_id, quantity } = req.body;

        if (!book_id) {
            return res.status(400).json({ message: 'book_id là bắt buộc' });
        }

        const result = await cartService.addToCart(userId, parseInt(book_id, 10), quantity || 1);
        res.status(200).json({ message: 'Đã thêm sách vào giỏ hàng', cart: result });
    } catch (error) {
        next(error);
    }
};

exports.updateQuantity = async (req, res, next) => {
    try {
        ensureCustomer(req, res);
        const userId = req.user.user_id || req.user.id;
        const bookId = parseInt(req.params.bookId, 10);
        const { quantity } = req.body;

        if (isNaN(bookId)) {
            return res.status(400).json({ message: 'bookId không hợp lệ' });
        }
        if (quantity === undefined || quantity === null) {
            return res.status(400).json({ message: 'quantity là bắt buộc' });
        }

        const result = await cartService.updateCartItem(userId, bookId, quantity);
        res.status(200).json({ message: 'Đã cập nhật số lượng', cart: result });
    } catch (error) {
        next(error);
    }
};

exports.removeItem = async (req, res, next) => {
    try {
        ensureCustomer(req, res);
        const userId = req.user.user_id || req.user.id;
        const bookId = parseInt(req.params.bookId, 10);

        if (isNaN(bookId)) {
            return res.status(400).json({ message: 'bookId không hợp lệ' });
        }

        const result = await cartService.removeFromCart(userId, bookId);
        res.status(200).json({ message: 'Đã xóa sách khỏi giỏ hàng', cart: result });
    } catch (error) {
        next(error);
    }
};

exports.clearCart = async (req, res, next) => {
    try {
        ensureCustomer(req, res);
        const userId = req.user.user_id || req.user.id;
        const result = await cartService.clearCart(userId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
