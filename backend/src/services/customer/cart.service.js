const { sequelize } = require('../../config/database');
const { CartItem, Book, BookImage, Inventory, Category } = require('../../models/associations');
const catalogService = require('./catalog.service');

class CartService {
    /**
     * Lấy toàn bộ giỏ hàng của người dùng kèm cờ cảnh báo mềm tồn kho
     */
    async getCart(userId) {
        const items = await CartItem.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Book,
                    as: 'book',
                    attributes: { exclude: ['embedding'] },
                    include: [
                        { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                        { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] },
                        { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
                    ]
                }
            ],
            order: [['book_id', 'ASC']]
        });

        let totalItems = 0;
        let totalQuantity = 0;
        let totalPrice = 0;
        let hasIssues = false;

        const cartItems = items.map(item => {
            const raw = item.toJSON();
            const book = raw.book;

            const stock = book?.inventory?.stock_quantity || 0;
            const isUnavailable = !book || !book.is_active;
            const isOutOfStock = !isUnavailable && stock === 0;
            const exceedsStock = !isUnavailable && !isOutOfStock && raw.quantity > stock;

            const finalPrice = book ? catalogService.calculateFinalPrice(book.price, book.discount_percent) : 0;
            const subtotal = finalPrice * raw.quantity;

            if (isUnavailable || isOutOfStock || exceedsStock) {
                hasIssues = true;
            } else {
                totalPrice += subtotal;
            }

            totalItems += 1;
            totalQuantity += raw.quantity;

            return {
                book_id: raw.book_id,
                quantity: raw.quantity,
                book: book ? {
                    book_id: book.book_id,
                    title: book.title,
                    isbn: book.isbn,
                    cover_type: book.cover_type,
                    price: book.price,
                    discount_percent: book.discount_percent,
                    final_price: finalPrice,
                    category: book.category,
                    images: book.images,
                    stock_quantity: stock,
                    is_active: book.is_active
                } : null,
                subtotal,
                flags: {
                    is_unavailable: isUnavailable,
                    is_out_of_stock: isOutOfStock,
                    exceeds_stock: exceedsStock,
                    available_stock: stock
                }
            };
        });

        return {
            items: cartItems,
            summary: {
                total_items: totalItems,
                total_quantity: totalQuantity,
                total_price: totalPrice,
                has_issues: hasIssues
            }
        };
    }

    /**
     * Thêm sách vào giỏ hàng (Upsert nguyên tử chống race condition bấm đúp)
     */
    async addToCart(userId, bookId, addQty = 1) {
        const qty = parseInt(addQty, 10);
        if (isNaN(qty) || qty <= 0 || qty > 99) {
            const err = new Error('Số lượng sách thêm vào giỏ phải từ 1 đến 99');
            err.status = 400;
            throw err;
        }

        // Kiểm tra sách có tồn tại và đang mở bán không
        const book = await Book.findOne({
            where: { book_id: bookId, is_active: true },
            include: [{ model: Inventory, as: 'inventory', attributes: ['stock_quantity'] }]
        });

        if (!book) {
            const err = new Error('Sách không tồn tại hoặc đã ngừng kinh doanh');
            err.status = 404;
            throw err;
        }

        const stock = book.inventory?.stock_quantity || 0;
        if (stock === 0) {
            const err = new Error(`Sách "${book.title}" hiện tại đã hết hàng`);
            err.status = 400;
            throw err;
        }

        // Kiểm tra số lượng hiện có trong giỏ
        const currentItem = await CartItem.findOne({
            where: { user_id: userId, book_id: bookId }
        });
        const currentQtyInCart = currentItem ? currentItem.quantity : 0;
        const targetQty = currentQtyInCart + qty;

        if (targetQty > stock) {
            const err = new Error(`Kho chỉ còn ${stock} cuốn. Giỏ hàng của bạn đã có ${currentQtyInCart} cuốn, không thể thêm tiếp ${qty} cuốn`);
            err.status = 400;
            throw err;
        }

        // Thực thi UPSERT nguyên tử bằng PostgreSQL
        await sequelize.query(`
            INSERT INTO cart_item (user_id, book_id, quantity)
            VALUES (:userId, :bookId, :qty)
            ON CONFLICT (user_id, book_id)
            DO UPDATE SET quantity = LEAST(99, cart_item.quantity + EXCLUDED.quantity)
        `, {
            replacements: { userId, bookId, qty }
        });

        return await this.getCart(userId);
    }

    /**
     * Cập nhật số lượng của 1 dòng sách trong giỏ
     */
    async updateCartItem(userId, bookId, newQty) {
        const qty = parseInt(newQty, 10);
        if (isNaN(qty) || qty <= 0 || qty > 99) {
            const err = new Error('Số lượng cập nhật phải từ 1 đến 99');
            err.status = 400;
            throw err;
        }

        const item = await CartItem.findOne({
            where: { user_id: userId, book_id: bookId }
        });

        if (!item) {
            const err = new Error('Sách không có trong giỏ hàng');
            err.status = 404;
            throw err;
        }

        // Kiểm tra tồn kho cảnh báo mềm
        const book = await Book.findByPk(bookId, {
            include: [{ model: Inventory, as: 'inventory', attributes: ['stock_quantity'] }]
        });
        const stock = book?.inventory?.stock_quantity || 0;

        if (qty > stock) {
            const err = new Error(`Số lượng yêu cầu (${qty}) vượt quá số lượng tồn kho còn lại (${stock} cuốn)`);
            err.status = 400;
            throw err;
        }

        item.quantity = qty;
        await item.save();

        return await this.getCart(userId);
    }

    /**
     * Xóa 1 cuốn sách khỏi giỏ hàng
     */
    async removeFromCart(userId, bookId) {
        const deleted = await CartItem.destroy({
            where: { user_id: userId, book_id: bookId }
        });

        if (deleted === 0) {
            const err = new Error('Sách không tồn tại trong giỏ hàng');
            err.status = 404;
            throw err;
        }

        return await this.getCart(userId);
    }

    /**
     * Xóa sạch toàn bộ giỏ hàng
     */
    async clearCart(userId) {
        await CartItem.destroy({
            where: { user_id: userId }
        });
        return { message: 'Đã xóa toàn bộ giỏ hàng thành công' };
    }
}

module.exports = new CartService();
