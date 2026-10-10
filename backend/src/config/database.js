const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(
    env.db.name,
    env.db.user,
    env.db.password,
    {
        host: env.db.host,
        port: env.db.port,
        dialect: 'postgres',
        logging: false, // Tắt log câu lệnh SQL ra terminal để đỡ rối mắt
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Kết nối PostgreSQL thành công');
    } catch (error) {
        console.error('Không thể kết nối CSDL:', error.message);
        process.exit(1);
    }
};

module.exports = { sequelize, testConnection };