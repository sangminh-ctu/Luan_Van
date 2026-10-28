const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../src/config/database');
const supplierService = require('../src/services/admin/supplier.service');
const inventoryService = require('../src/services/admin/inventory.service');
const { Supplier, StockReceipt, Book } = require('../src/models/associations');

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG QUẢN LÝ NHÀ CUNG CẤP & PHIẾU NHẬP ===\n');
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

        // Tìm một cuốn sách có sẵn trong hệ thống để test tạo phiếu
        const sampleBook = await Book.findOne({ attributes: ['book_id', 'title'] });
        if (!sampleBook) throw new Error('Không có sách nào trong CSDL để chạy kiểm thử!');

        // 1. Tạo nhà cung cấp Fahasa Test
        const testName1 = `Fahasa Test ${Date.now()}`;
        const sup1 = await supplierService.create({
            supplier_name: testName1,
            contact_person: 'Nguyễn Văn Test',
            phone: '0901234567',
            email: 'test@fahasa.com'
        });
        assert(sup1 && sup1.supplier_id > 0, '1. Tạo nhà cung cấp hợp lệ thành công');

        // 2. Chặn trùng tên chuẩn hóa: chữ thường và thêm khoảng trắng (409 Conflict)
        try {
            await supplierService.create({
                supplier_name: `  ${testName1.toLowerCase()}   `
            });
            assert(false, '2. Trùng tên chuẩn hóa chữ thường/khoảng trắng phải bị chặn');
        } catch (err) {
            assert(err.status === 409, '2. Trùng tên chuẩn hóa bị chặn với mã lỗi 409');
        }

        // 3. Chặn trùng tên khi viết hoa toàn bộ (409 Conflict)
        try {
            await supplierService.create({
                supplier_name: testName1.toUpperCase()
            });
            assert(false, '3. Trùng tên chuẩn hóa chữ hoa phải bị chặn');
        } catch (err) {
            assert(err.status === 409, '3. Trùng tên viết hoa bị chặn với mã lỗi 409');
        }

        // 4. Kiểm thử chạy song song 2 request tạo cùng tên (chống race condition)
        const dupName = `Concurrent Test ${Date.now()}`;
        const [resA, resB] = await Promise.allSettled([
            supplierService.create({ supplier_name: dupName }),
            supplierService.create({ supplier_name: dupName })
        ]);
        const oneSucceeded = (resA.status === 'fulfilled' && resB.status === 'rejected') || (resA.status === 'rejected' && resB.status === 'fulfilled');
        const rejectedHas409 = (resA.reason?.status === 409) || (resB.reason?.status === 409);
        assert(oneSucceeded && rejectedHas409, '4. Hai request tạo cùng tên cùng lúc: đúng 1 thành công (201) và 1 bị chặn (409)');

        // 5. Kiểm thử các tham số lỗi 400 (SĐT sai, email sai, tên rỗng, tên > 150 ký tự)
        try {
            await supplierService.create({ supplier_name: 'Test SĐT Lỗi', phone: '12345' });
            assert(false, '5. SĐT không hợp lệ phải trả về 400');
        } catch (err) {
            assert(err.status === 400, '5a. SĐT không hợp lệ (12345) bị chặn với status 400');
        }

        try {
            await supplierService.create({ supplier_name: 'Test Email Lỗi', email: 'email_sai_dinh_dang' });
            assert(false, '5. Email không hợp lệ phải trả về 400');
        } catch (err) {
            assert(err.status === 400, '5b. Email không hợp lệ bị chặn với status 400');
        }

        try {
            await supplierService.create({ supplier_name: '   ' });
            assert(false, '5. Tên rỗng phải trả về 400');
        } catch (err) {
            assert(err.status === 400, '5c. Tên rỗng bị chặn với status 400');
        }

        try {
            await supplierService.create({ supplier_name: 'A'.repeat(151) });
            assert(false, '5. Tên > 150 ký tự phải trả về 400');
        } catch (err) {
            assert(err.status === 400, '5d. Tên dài quá 150 ký tự bị chặn với status 400');
        }

        // 6. Ô để trống gửi chuỗi rỗng "" được lưu thành NULL, không lỗi định dạng
        const supEmpty = await supplierService.create({
            supplier_name: `Empty Strings Test ${Date.now()}`,
            contact_person: '',
            phone: '   ',
            email: '',
            address: '',
            note: ''
        });
        assert(supEmpty.phone === null && supEmpty.email === null && supEmpty.contact_person === null,
            '6. Chuỗi rỗng "" ở các trường tùy chọn được chuyển thành NULL an toàn');

        // 7. Lập phiếu nhập kho không có supplier_id -> Bị chặn 400
        try {
            await inventoryService.createReceipt({
                type: 'import',
                details: [{ book_id: sampleBook.book_id, quantity: 2, unit_cost: 50000 }]
            });
            assert(false, '7. Lập phiếu nhập thiếu supplier_id phải bị chặn 400');
        } catch (err) {
            assert(err.status === 400, '7. Lập phiếu nhập thiếu supplier_id bị chặn với status 400');
        }

        // 8. Lập phiếu nhập với nhà cung cấp ngừng hợp tác (is_active = false) -> Bị chặn 400
        const supInactive = await supplierService.create({
            supplier_name: `Inactive Sup ${Date.now()}`,
            is_active: false
        });
        try {
            await inventoryService.createReceipt({
                type: 'import',
                supplier_id: supInactive.supplier_id,
                details: [{ book_id: sampleBook.book_id, quantity: 2, unit_cost: 50000 }]
            });
            assert(false, '8. Lập phiếu nhập với NCC ngừng hợp tác phải bị chặn');
        } catch (err) {
            assert(err.status === 400, '8. Lập phiếu nhập với NCC ngừng hợp tác bị chặn với status 400');
        }

        // 9. Lập phiếu nhập kèm supplier_name do client gửi -> Server tự bỏ qua, dùng tên snapshot từ DB
        const receipt = await inventoryService.createReceipt({
            type: 'import',
            supplier_id: sup1.supplier_id,
            supplier_name: 'Tên Lạ Do Hacker Gửi',
            details: [{ book_id: sampleBook.book_id, quantity: 3, unit_cost: 40000 }],
            auto_complete: false // Để ở trạng thái pending
        });
        assert(receipt.supplier_name === testName1 && receipt.supplier_id === sup1.supplier_id,
            '9. Phiếu nhập tự chụp supplier_name chuẩn từ DB, bỏ qua supplier_name client gửi');

        // 10. Chặn xóa nhà cung cấp đã có phiếu nhập (409 Conflict)
        try {
            await supplierService.delete(sup1.supplier_id);
            assert(false, '10. Xóa NCC đã có phiếu nhập phải bị chặn 409');
        } catch (err) {
            assert(err.status === 409, '10. Xóa NCC có phiếu nhập bị chặn với status 409 ON DELETE RESTRICT');
        }

        // 11. Đổi tên nhà cung cấp -> Phiếu cũ giữ nguyên tên chụp, thống kê theo supplier_id vẫn chuẩn xác
        const updatedName = `Fahasa Đã Đổi Tên ${Date.now()}`;
        await supplierService.update(sup1.supplier_id, { supplier_name: updatedName });
        const oldReceipt = await inventoryService.getReceiptById(receipt.receipt_id);
        assert(oldReceipt.supplier_name === testName1,
            '11. Đổi tên NCC: Phiếu nhập cũ vẫn giữ nguyên bản chụp tên lúc lập chứng từ');

        // 12. Thống kê: Phiếu pending chưa được tính vào receipt_count và total_value
        let supStats = await supplierService.getById(sup1.supplier_id);
        assert(supStats.receipt_count === 0 && supStats.total_value === 0 && supStats.pending_receipt_count === 1,
            '12a. Phiếu pending không tính vào receipt_count/total_value, tính vào pending_receipt_count');

        // 13. Ngừng hợp tác NCC rồi duyệt phiếu pending -> Vẫn duyệt thành công
        await supplierService.update(sup1.supplier_id, { is_active: false });
        await inventoryService.completeReceipt(receipt.receipt_id);
        supStats = await supplierService.getById(sup1.supplier_id);
        assert(supStats.receipt_count === 1 && supStats.total_value === 120000 && supStats.pending_receipt_count === 0,
            '13. Duyệt hoàn tất phiếu của NCC đã ngừng hợp tác thành công, cập nhật thống kê completed');

        // 14. getOptions chỉ trả về nhà cung cấp đang hợp tác (is_active = true)
        const options = await supplierService.getOptions();
        const containsInactive = options.some(s => s.supplier_id === sup1.supplier_id);
        assert(!containsInactive, '14. getOptions chỉ trả về nhà cung cấp đang hợp tác (is_active = true)');

        // Dọn dẹp dữ liệu test phiếu
        await StockReceipt.destroy({ where: { receipt_id: receipt.receipt_id } });
        await Supplier.destroy({ where: { supplier_id: [sup1.supplier_id, supInactive.supplier_id, supEmpty.supplier_id] } });

        console.log(`\n=== TỔNG KẾT: ${passed} PASSED, ${failed} FAILED ===`);
    } catch (error) {
        console.error('Lỗi kiểm thử:', error);
    } finally {
        await sequelize.close();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
