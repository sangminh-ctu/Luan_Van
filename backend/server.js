const app = require('./src/app');
const { testConnection } = require('./src/config/database');
const env = require('./src/config/env');

const startServer = async () => {
    await testConnection();

    app.listen(env.port, () => {
        console.log(`Server đang chạy tại http://localhost:${env.port}`);
    });
};

startServer();