require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../src/models/user.model');
const { sequelize } = require('../src/config/database');

const createAdmin = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            console.error('Lỗi: Chưa cấu hình ADMIN_PASSWORD trong file .env');
            process.exit(1);
        }

        const adminEmail = 'admin@bookstore.com';
        const existingAdmin = await User.findOne({ where: { email: adminEmail } });

        if (existingAdmin) {
            console.log('Tài khoản Admin đã tồn tại. Bỏ qua.');
        } else {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.create({
                full_name: 'Quản trị viên',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin'
            });
            console.log('Tạo tài khoản Admin thành công!');
        }
    } catch (error) {
        console.error('Lỗi khi tạo Admin:', error);
    } finally {
        await sequelize.close();
    }
};

createAdmin();
