const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { sequelize } = require('../src/config/database');

async function migrate() {
    try {
        const sql = fs.readFileSync(
            path.join(__dirname, '../../database/migrations/021_book_image_embedding_meta.sql'),
            'utf8',
        );
        await sequelize.transaction(transaction =>
            sequelize.query(sql.replace(/^\uFEFF/, ''), { transaction }),
        );
        console.log('Migration 021 hoàn tất.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

migrate();
