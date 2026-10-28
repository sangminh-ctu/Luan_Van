const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../src/config/database');

(async () => {
    try {
        const file = process.argv[2] || '005_book_supplier.sql';
        const sql = fs.readFileSync(path.join(__dirname, '../../database/migrations', file), 'utf8');
        await sequelize.query(sql);
        console.log(`Migration ${file} OK`);
    } catch (err) {
        console.error('Lỗi migration:', err);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
