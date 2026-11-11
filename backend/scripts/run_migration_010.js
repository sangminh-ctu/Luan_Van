const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { sequelize } = require('../src/config/database');
(async () => {
    try {
        await sequelize.transaction(async transaction => {
            await sequelize.query('LOCK TABLE voucher, orders IN SHARE ROW EXCLUSIVE MODE', { transaction });
            const [inconsistent] = await sequelize.query(`SELECT v.voucher_id, v.used_count,
                count(o.order_id) FILTER (WHERE o.order_status <> 'cancelled')::int AS active_uses
                FROM voucher v LEFT JOIN orders o ON o.voucher_id = v.voucher_id
                GROUP BY v.voucher_id HAVING v.used_count <> count(o.order_id) FILTER (WHERE o.order_status <> 'cancelled')`, { transaction });
            if (inconsistent.length) throw new Error('Bộ đếm voucher không khớp lịch sử đơn hàng. Cần đối chiếu dữ liệu trước khi bật checkout voucher: ' + JSON.stringify(inconsistent));
            await sequelize.query(fs.readFileSync(path.join(__dirname, '../../database/migrations/010_voucher_checkout.sql'), 'utf8'), { transaction });
        });
        console.log('Migration 010 hoàn tất: giới hạn mỗi tài khoản mặc định 1, lịch sử đơn hàng được giữ nguyên.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
    finally { await sequelize.close(); }
})();
