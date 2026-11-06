const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { sequelize } = require('../src/config/database');
(async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, '../../database/migrations/009_home_spotlight.sql'), 'utf8');
        await sequelize.transaction(transaction => sequelize.query(sql, { transaction }));
        console.log('Migration 009: cấu hình trang chủ đã sẵn sàng (mặc định tắt).');
    } catch (error) {
        console.error('Migration 009 thất bại:', error.message);
        process.exitCode = 1;
    } finally { await sequelize.close(); }
})();
