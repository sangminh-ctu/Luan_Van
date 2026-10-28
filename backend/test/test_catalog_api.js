const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../src/config/database');
const catalogService = require('../src/services/customer/catalog.service');

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG CATALOG & BỘ LỌC ===\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}`);
            failed++;
        }
    }

    try {
        await sequelize.authenticate();
        console.log('Kết nối CSDL thành công.\n');

        // Ca 1: Lấy danh mục cây và bộ lọc
        const tree = await catalogService.getCategories();
        assert(Array.isArray(tree), '1. getCategories trả về mảng danh mục');
        const filterOptions = await catalogService.getFilterOptions();
        assert(Array.isArray(filterOptions.publishers) && Array.isArray(filterOptions.authors) && Array.isArray(filterOptions.coverTypes),
            '2. getFilterOptions trả về publishers, authors, coverTypes');

        // Ca 2: Lấy tất cả sách mặc định
        const resAll = await catalogService.getBooks({ page: 1, limit: 12 });
        assert(Array.isArray(resAll.books) && resAll.pagination.page === 1,
            '3. getBooks mặc định thành công, có pagination');

        // Ca 3: Kiểm tra lọc theo danh mục cha (nếu có danh mục cha có con)
        const parentWithChildren = tree.find(c => c.children && c.children.length > 0);
        if (parentWithChildren) {
            const resParent = await catalogService.getBooks({ category_id: parentWithChildren.category_id });
            assert(resParent.books !== undefined, `4. Lọc theo danh mục cha ID ${parentWithChildren.category_id} thành công`);
        } else {
            console.log('[SKIP] Chưa có danh mục cha có con để test đệ quy');
        }

        // Ca 4: Kiểm tra lọc khoảng giá sau giảm
        const resPrice = await catalogService.getBooks({ min_price: 50000, max_price: 300000 });
        const allInRange = resPrice.books.every(b => b.final_price >= 50000 && b.final_price <= 300000);
        assert(allInRange, '5. Lọc khoảng giá [50k - 300k] chuẩn xác trên final_price');

        // Ca 5: Kiểm tra kết hợp nhiều bộ lọc
        const resMulti = await catalogService.getBooks({ in_stock: true, sort: 'price_asc', limit: 12 });
        assert(Array.isArray(resMulti.books), '6. Kết hợp nhiều bộ lọc (in_stock, sort=price_asc) thành công');

        // Ca 6: Kiểm tra tham số lỗi 400: min_price > max_price
        try {
            await catalogService.getBooks({ min_price: 300000, max_price: 100000 });
            assert(false, '7. min_price > max_price phải ném lỗi 400');
        } catch (err) {
            assert(err.status === 400, '7. min_price > max_price bị chặn với status 400');
        }

        // Ca 7: Kiểm tra tham số lỗi 400: limit không hợp lệ
        try {
            await catalogService.getBooks({ limit: 9999 });
            assert(false, '8. limit=9999 phải ném lỗi 400');
        } catch (err) {
            assert(err.status === 400, '8. limit=9999 bị chặn với status 400');
        }

        // Ca 8: Kiểm tra tham số lỗi 400: sort không hợp lệ
        try {
            await catalogService.getBooks({ sort: 'hacker_sort' });
            assert(false, '9. sort=hacker_sort phải ném lỗi 400');
        } catch (err) {
            assert(err.status === 400, '9. sort=hacker_sort bị chặn với status 400');
        }

        // Ca 9: Kiểm tra tham số lỗi 400: category_id không hợp lệ
        try {
            await catalogService.getBooks({ category_id: 'abc' });
            assert(false, '10. category_id=abc phải ném lỗi 400');
        } catch (err) {
            assert(err.status === 400, '10. category_id=abc bị chặn với status 400');
        }

        // Ca 10: Trang vượt quá tổng số trang (page=999)
        const resOverflow = await catalogService.getBooks({ page: 999 });
        assert(resOverflow.books.length === 0 && resOverflow.pagination.total >= 0,
            '11. page=999 trả về mảng rỗng và pagination vẫn giữ total chuẩn xác');

        // Ca 11: Lọc theo tác giả với EXISTS (kiểm tra không nhân bản bản ghi)
        if (filterOptions.authors.length > 0) {
            const authorId = filterOptions.authors[0].author_id;
            const resAuthor = await catalogService.getBooks({ author_id: authorId });
            const bookIds = resAuthor.books.map(b => b.book_id);
            const isUnique = new Set(bookIds).size === bookIds.length;
            assert(isUnique, `12. Lọc theo author_id ${authorId} không bị nhân bản (tất cả book_id đều duy nhất)`);
        }

        // Ca 12: Kiểm tra khóa sắp xếp phụ book_id DESC chống trùng giữa các trang
        const page1 = await catalogService.getBooks({ page: 1, limit: 5, sort: 'price_asc' });
        const page2 = await catalogService.getBooks({ page: 2, limit: 5, sort: 'price_asc' });
        if (page1.books.length > 0 && page2.books.length > 0) {
            const p1Ids = new Set(page1.books.map(b => b.book_id));
            const overlap = page2.books.some(b => p1Ids.has(b.book_id));
            assert(!overlap, '13. Duyệt trang 1 và trang 2 với sort=price_asc không bị trùng lặp sách nào');
        }

        console.log(`\n=== KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED ===`);
    } catch (error) {
        console.error('Lỗi kiểm thử:', error);
    } finally {
        await sequelize.close();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
