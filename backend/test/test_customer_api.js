const jwt = require('jsonwebtoken');
const { sequelize } = require('../src/config/database');
const { Book, User, CartItem, Inventory } = require('../src/models/associations');
const catalogService = require('../src/services/customer/catalog.service');
const cartService = require('../src/services/customer/cart.service');

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ BACKEND GIAI ĐOẠN 4 (CATALOG & CART) ===');

    // 1. Kiểm thử Public Categories
    console.log('\n1. Test lấy danh sách thể loại...');
    const categories = await catalogService.getCategories();
    console.log(`- Lấy được ${categories.length} thể loại.`);
    if (!Array.isArray(categories)) throw new Error('Categories phải là mảng');
    console.log('=> PASS: API thể loại hoạt động tốt.');

    // 2. Kiểm thử Public Books (Bảo mật vector embedding & tính final_price)
    console.log('\n2. Test lấy danh sách sách công khai...');
    const bookResult = await catalogService.getBooks({ page: 1, limit: 10 });
    console.log(`- Tổng số sách mở bán: ${bookResult.pagination.total}`);
    
    if (bookResult.books.length > 0) {
        const sample = bookResult.books[0];
        console.log(`- Sách mẫu: "${sample.title}", Giá gốc: ${sample.price}, Giảm: ${sample.discount_percent}%, Giá cuối: ${sample.final_price}`);
        
        // Kiểm tra an toàn: Tuyệt đối không được rò rỉ embedding
        if (sample.embedding !== undefined) {
            throw new Error('LỖI BẢO MẬT: Cột vector AI "embedding" bị lộ ra API công khai!');
        }
        console.log('=> PASS BẢO MẬT: Cột vector "embedding" đã được loại trừ an toàn 100%!');

        // Kiểm tra tính giá cuối
        const expectedPrice = Math.round(Number(sample.price) * (1 - (Number(sample.discount_percent) || 0) / 100));
        if (sample.final_price !== expectedPrice) {
            throw new Error(`Tính giá sau giảm sai! Kỳ vọng: ${expectedPrice}, Thực tế: ${sample.final_price}`);
        }
        console.log('=> PASS: Giá sau giảm final_price được tính chuẩn xác!');
    }

    // 3. Kiểm thử Chi tiết Sách & Sách liên quan
    console.log('\n3. Test lấy chi tiết 1 cuốn sách...');
    const firstBook = await Book.findOne({ 
        where: { is_active: true },
        include: [{ model: Inventory, as: 'inventory' }]
    });
    if (firstBook) {
        const detail = await catalogService.getBookById(firstBook.book_id);
        console.log(`- Chi tiết sách: "${detail.title}" (Tồn kho: ${detail.inventory?.stock_quantity || 0})`);
        if (detail.embedding !== undefined) {
            throw new Error('LỖI BẢO MẬT: Cột embedding bị lộ trong getBookById!');
        }
        console.log('=> PASS: API Chi tiết sách hoạt động chuẩn.');

        const related = await catalogService.getRelatedBooks(firstBook.book_id, firstBook.category_id, 4);
        console.log(`- Sách liên quan cùng thể loại: ${related.length} cuốn.`);
        console.log('=> PASS: API Sách liên quan hoạt động chuẩn.');
    }

    // 4. Chuẩn bị Tài khoản Khách hàng để test Giỏ hàng
    console.log('\n4. Chuẩn bị tài khoản khách hàng test...');
    let [customer] = await User.findOrCreate({
        where: { email: 'customer_test@bookstore.com' },
        defaults: {
            full_name: 'Khách hàng Thử nghiệm',
            password: 'hashed_password_123',
            role: 'customer'
        }
    });
    const customerId = customer.user_id;
    console.log(`- Tài khoản khách: ${customer.full_name} (ID: ${customerId})`);

    // Dọn sạch giỏ cũ của khách trước khi test
    await cartService.clearCart(customerId);

    // 5. Test Thêm vào Giỏ (addToCart) & Upsert chống race-condition
    console.log('\n5. Test Thêm vào giỏ hàng & Upsert nguyên tử...');
    const testBookId = firstBook.book_id;
    const currentStock = firstBook.inventory?.stock_quantity || 0;
    console.log(`- Sách test ID: ${testBookId}, Tồn kho: ${currentStock}`);

    // Thêm lần 1: 1 cuốn
    await cartService.addToCart(customerId, testBookId, 1);
    let cart = await cartService.getCart(customerId);
    if (cart.summary.total_items !== 1 || cart.items[0].quantity !== 1) {
        throw new Error('Thêm vào giỏ lần 1 thất bại!');
    }
    console.log('=> PASS: Thêm 1 cuốn vào giỏ thành công.');

    // Thêm lần 2 vào cùng cuốn đó: 2 cuốn (tổng phải thành 3)
    await cartService.addToCart(customerId, testBookId, 2);
    cart = await cartService.getCart(customerId);
    if (cart.items[0].quantity !== 3) {
        throw new Error(`Cộng dồn giỏ hàng thất bại! Kỳ vọng: 3, Thực tế: ${cart.items[0].quantity}`);
    }
    console.log('=> PASS: Cộng dồn số lượng nguyên tử thành công (1 + 2 = 3)!');

    // 6. Test Chốt chặn mềm: Thêm vượt quá tồn kho (nếu kho có giới hạn)
    console.log('\n6. Test Chốt chặn tồn kho mềm khi thêm vào giỏ...');
    try {
        const overQty = currentStock; // hiện trong giỏ đã có 3, thêm currentStock nữa thì 3 + currentStock > currentStock!
        await cartService.addToCart(customerId, testBookId, overQty);
        throw new Error('Thất bại: Cho phép thêm vượt quá tồn kho!');
    } catch (err) {
        if (err.status === 400) {
            console.log(`=> PASS: Chặn thêm vượt tồn thành công với mã 400: "${err.message}"`);
        } else {
            throw err;
        }
    }

    // 7. Test Cập nhật số lượng (updateCartItem)
    console.log('\n7. Test Cập nhật số lượng giỏ hàng...');
    await cartService.updateCartItem(customerId, testBookId, 2);
    cart = await cartService.getCart(customerId);
    if (cart.items[0].quantity !== 2) {
        throw new Error('Cập nhật số lượng thất bại!');
    }
    console.log('=> PASS: Cập nhật số lượng về 2 thành công.');

    // 8. Test Xóa 1 cuốn khỏi giỏ & Xóa toàn bộ giỏ
    console.log('\n8. Test Xóa mặt hàng khỏi giỏ...');
    await cartService.removeFromCart(customerId, testBookId);
    cart = await cartService.getCart(customerId);
    if (cart.summary.total_items !== 0) {
        throw new Error('Xóa mặt hàng thất bại, giỏ vẫn còn sách!');
    }
    console.log('=> PASS: Xóa mặt hàng khỏi giỏ thành công.');

    console.log('\n🎉 TOÀN BỘ CÁC CA TEST BACKEND GIAI ĐOẠN 4 ĐẠT 100%!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('LỖI KIỂM THỬ BACKEND:', err);
    process.exit(1);
});
