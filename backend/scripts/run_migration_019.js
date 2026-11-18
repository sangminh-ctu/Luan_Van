const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { sequelize } = require('../src/config/database');

async function migrate() {
    try {
        const sql = fs.readFileSync(
            path.join(__dirname, '../../database/migrations/019_customer_notifications.sql'), 'utf8'
        );
        await sequelize.transaction(transaction => sequelize.query(sql, { transaction }));
        console.log('Migration 019 hoàn tất.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

migrate();
