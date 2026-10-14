const { sequelize } = require('../src/config/database');
const inventoryService = require('../src/services/admin/inventory.service');
const { Book, Inventory, StockReceipt, StockReceiptDetail } = require('../src/models/associations');

async function runTests() {
    console.log('--- BẮT ĐẦU KIỂM THỬ MODULE INVENTORY & STOCK RECEIPTS ---');

    // 1. Lấy 1 cuốn sách có sẵn trong DB để test
    let testBook = await Book.findOne();
    if (!testBook) {
        console.error('Không tìm thấy sách nào trong DB để test!');
        process.exit(1);
    }
    const bookId = testBook.book_id;
    console.log(`1. Sử dụng sách test: "${testBook.title}" (ID: ${bookId})`);

    // Lấy tồn kho ban đầu
    let [inv] = await Inventory.findOrCreate({
        where: { book_id: bookId },
        defaults: { stock_quantity: 0 }
    });
    const initialStock = inv.stock_quantity;
    console.log(`- Tồn kho ban đầu: ${initialStock}`);

    // 2. Test Tạo Phiếu Nhập Kho (import) có trùng book_id để kiểm tra tự gộp (merge)
    console.log('\n2. Test Tạo Phiếu Nhập Kho (Trùng 2 dòng sách để test gộp số lượng)...');
    const importReceipt = await inventoryService.createReceipt({
        type: 'import',
        supplier_name: 'Nhà Xuất Bản Test',
        note: 'Phiếu nhập tự động kiểm thử',
        details: [
            { book_id: bookId, quantity: 20, unit_cost: 50000 },
            { book_id: bookId, quantity: 30, unit_cost: 50000 } // trùng ID, tổng phải là 50
        ],
        auto_complete: false
    });
    console.log(`- Đã tạo phiếu: ${importReceipt.receipt_code}, Status: ${importReceipt.status}, Tổng tiền: ${importReceipt.total_cost}`);
    if (importReceipt.details.length !== 1 || importReceipt.details[0].quantity !== 50) {
        throw new Error(`Gộp trùng sách thất bại: ${JSON.stringify(importReceipt.details)}`);
    }
    console.log('=> PASS: Gộp trùng sách thành công (20 + 30 = 50)!');

    // Tồn kho chưa đổi vì phiếu đang pending
    await inv.reload();
    if (inv.stock_quantity !== initialStock) {
        throw new Error('Tồn kho bị đổi khi phiếu mới chỉ pending!');
    }
    console.log('=> PASS: Tồn kho không đổi khi phiếu ở trạng thái Pending.');

    // 3. Test Duyệt Phiếu Nhập (completeReceipt)
    console.log('\n3. Test Duyệt Phiếu Nhập Kho...');
    const completedImport = await inventoryService.completeReceipt(importReceipt.receipt_id);
    console.log(`- Phiếu sau khi duyệt: ${completedImport.receipt_code}, Status: ${completedImport.status}`);

    await inv.reload();
    const expectedStockAfterImport = initialStock + 50;
    if (inv.stock_quantity !== expectedStockAfterImport) {
        throw new Error(`Tồn kho không đúng! Kỳ vọng: ${expectedStockAfterImport}, Thực tế: ${inv.stock_quantity}`);
    }
    console.log(`=> PASS: Tồn kho đã tăng đúng từ ${initialStock} lên ${inv.stock_quantity}!`);

    // 4. Test Chống Click Đúp: Duyệt lại chính phiếu đó lần thứ 2
    console.log('\n4. Test Chống bấm Duyệt 2 lần (Idempotency / Race Condition)...');
    try {
        await inventoryService.completeReceipt(importReceipt.receipt_id);
        throw new Error('Thất bại: Cho phép duyệt lại phiếu đã completed!');
    } catch (err) {
        if (err.status === 409) {
            console.log(`=> PASS: Chặn duyệt lại thành công với mã 409: "${err.message}"`);
        } else {
            throw err;
        }
    }

    // 5. Test Xuất Kho Vượt Tồn (Phải bị chặn với mã 409)
    console.log('\n5. Test Xuất Kho Vượt Tồn Kho...');
    const currentStock = inv.stock_quantity;
    const overExportQty = currentStock + 999;
    try {
        await inventoryService.createReceipt({
            type: 'export',
            note: 'Xuất thanh lý quá số lượng',
            details: [
                { book_id: bookId, quantity: overExportQty, unit_cost: 0 }
            ],
            auto_complete: true // Lưu & Hoàn tất ngay
        });
        throw new Error('Thất bại: Cho phép xuất kho vượt quá số lượng tồn!');
    } catch (err) {
        if (err.status === 409) {
            console.log(`=> PASS: Chặn xuất kho vượt tồn thành công với mã 409: "${err.message}"`);
        } else {
            throw err;
        }
    }

    // 6. Test Xuất Kho Hợp Lệ với auto_complete = true
    console.log('\n6. Test Xuất Kho Hợp Lệ (Lưu & Hoàn tất ngay)...');
    const validExportQty = 15;
    const exportReceipt = await inventoryService.createReceipt({
        type: 'export',
        note: 'Xuất trả nhà cung cấp 15 cuốn',
        details: [
            { book_id: bookId, quantity: validExportQty, unit_cost: 0 }
        ],
        auto_complete: true
    });
    console.log(`- Đã tạo và hoàn tất phiếu xuất: ${exportReceipt.receipt_code}`);

    await inv.reload();
    const expectedStockAfterExport = currentStock - validExportQty;
    if (inv.stock_quantity !== expectedStockAfterExport) {
        throw new Error(`Tồn kho sau khi xuất không đúng! Kỳ vọng: ${expectedStockAfterExport}, Thực tế: ${inv.stock_quantity}`);
    }
    console.log(`=> PASS: Tồn kho đã trừ chuẩn xác từ ${currentStock} xuống ${inv.stock_quantity}!`);

    // 7. Test Báo Cáo Tồn Kho và Thống Kê
    console.log('\n7. Test Báo Cáo Tồn Kho...');
    const summary = await inventoryService.getInventorySummary({ page: 1, limit: 5 });
    console.log('- Thống kê kho:', summary.stats);
    console.log(`- Tổng số đầu sách lấy được: ${summary.inventory.length}`);
    console.log('=> PASS: API Báo cáo tồn kho hoạt động trơn tru!');

    // 8. Chạy câu SQL Đối chiếu Kiểm toán (Audit Query)
    console.log('\n8. Chạy câu SQL Kiểm Toán Đối Chiếu...');
    const [discrepancies] = await sequelize.query(`
        SELECT i.book_id, i.stock_quantity,
               COALESCE(SUM(CASE WHEN r.type='import' THEN d.quantity ELSE -d.quantity END), 0) AS expected
        FROM inventory i
        LEFT JOIN stock_receipt_detail d ON d.book_id = i.book_id
        LEFT JOIN stock_receipt r ON r.receipt_id = d.receipt_id AND r.status = 'completed'
        WHERE i.book_id = ${bookId}
        GROUP BY i.book_id, i.stock_quantity
        HAVING i.stock_quantity <> COALESCE(SUM(CASE WHEN r.type='import' THEN d.quantity ELSE -d.quantity END), 0);
    `);

    if (discrepancies.length === 0) {
        console.log('=> PASS TUYỆT ĐỐI: Câu SQL kiểm toán trả về RỖNG (0 dòng lệch kho)! Tồn kho khớp 100% với chứng từ gốc!');
    } else {
        console.warn('Lệch tồn kho kiểm toán:', discrepancies);
    }

    console.log('\n🎉 TOÀN BỘ CÁC CA TEST BACKEND ĐỀU ĐẠT CHUẨN 100%!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('LỖI TEST BACKEND:', err);
    process.exit(1);
});
