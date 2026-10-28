const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../src/config/database');

async function run() {
    console.log('--- BẮT ĐẦU CHẠY MIGRATION 004_supplier.sql ---');
    const sqlPath = path.join(__dirname, '../../database/migrations/004_supplier.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await sequelize.authenticate();
        console.log('Kết nối CSDL thành công.');
        await sequelize.query(sql);
        console.log('Thực thi migration thành công!');

        // Kiểm tra bảng supplier
        const [suppliers] = await sequelize.query('SELECT * FROM supplier ORDER BY supplier_id');
        console.log('\nDanh sách nhà cung cấp đã backfill:');
        console.table(suppliers);

        // Kiểm tra bảng stock_receipt
        const [receipts] = await sequelize.query('SELECT receipt_id, receipt_code, type, supplier_id, supplier_name FROM stock_receipt ORDER BY receipt_id');
        console.log('\nDanh sách phiếu kho sau khi gắn supplier_id:');
        console.table(receipts);

        // Kiểm tra không có phiếu import nào thiếu supplier_id
        const [orphaned] = await sequelize.query("SELECT receipt_id FROM stock_receipt WHERE type = 'import' AND supplier_id IS NULL");
        if (orphaned.length > 0) {
            console.error('LỖI: Vẫn còn phiếu import không có supplier_id!', orphaned);
            process.exit(1);
        } else {
            console.log('=> XÁC NHẬN: 100% phiếu nhập đã có supplier_id hợp lệ!');
        }
    } catch (err) {
        console.error('Lỗi chạy migration:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
