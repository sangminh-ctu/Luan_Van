const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('../models/user.model');
const membershipService = require('../services/membership.service');
const voucherService = require('../services/voucher.service');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(0|\+84)\d{9}$/;

// HELPER: Lấy secret từ process.env (fallback cho an toàn)
const getJwtSecret = () => process.env.JWT_SECRET || 'fallback_secret_key';

exports.register = async (req, res) => {
    try {
        let { full_name, email, password, phone } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ message: "Vui lòng nhập đủ thông tin bắt buộc" });
        }

        email = email.trim().toLowerCase();

        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Email không đúng định dạng" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự trở lên" });
        }
        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: "Email đã được sử dụng" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            full_name,
            email,
            password: hashedPassword,
            phone,
            role: 'customer' // Tuyệt đối luôn là customer
        });

        const token = jwt.sign(
            { user_id: newUser.user_id, role: newUser.role },
            getJwtSecret(),
            { expiresIn: '1d' }
        );

        const userResponse = {
            user_id: newUser.user_id,
            full_name: newUser.full_name,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            reward_points_balance: newUser.reward_points_balance
        };

        return res.status(201).json({ token, user: userResponse });
    } catch (error) {
        console.error("Register Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.login = async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu" });
        }

        email = email.trim().toLowerCase();

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
        }

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            getJwtSecret(),
            { expiresIn: '1d' }
        );

        const userResponse = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            reward_points_balance: user.reward_points_balance
        };

        return res.status(200).json({ token, user: userResponse });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.adminLogin = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu qua body JSON" });
        }
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu" });
        }

        email = email.trim().toLowerCase();

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ message: "Tài khoản này không có quyền quản trị" });
        }

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            getJwtSecret(),
            { expiresIn: '1d' }
        );

        const userResponse = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            reward_points_balance: user.reward_points_balance
        };

        return res.status(200).json({ token, user: userResponse });
    } catch (error) {
        console.error("Admin Login Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.me = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(401).json({ message: "Không tìm thấy thông tin người dùng" });
        }

        // Thống kê đơn hàng trong năm hiện tại và danh sách voucher khả dụng
        const [orderStats] = await sequelize.query(
            `SELECT
                COUNT(*) FILTER (WHERE order_status = 'delivered' AND payment_status = 'paid')::int AS order_count,
                COALESCE(SUM(CASE WHEN order_status = 'delivered' AND payment_status = 'paid' THEN GREATEST(0, subtotal - voucher_discount_amount - points_discount) ELSE 0 END), 0)::numeric AS total_spent
             FROM orders
             WHERE user_id = :userId
               AND EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
            { replacements: { userId }, type: QueryTypes.SELECT }
        );

        const offers = await voucherService.customerOffers(userId);
        const tiers = await membershipService.list();

        return res.status(200).json({
            user,
            stats: {
                year: Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())),
                order_count: Number(orderStats?.order_count || 0),
                total_spent: Number(orderStats?.total_spent || 0)
            },
            vouchers: offers.vouchers,
            available_voucher_count: offers.available_count,
            membership: offers.membership,
            tiers
        });
    } catch (error) {
        console.error("Me Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        }

        let { full_name, phone, email } = req.body;
        full_name = typeof full_name === 'string' ? full_name.trim() : '';
        phone = typeof phone === 'string' ? phone.trim() : '';
        email = typeof email === 'string' ? email.trim().toLowerCase() : user.email;

        if (!full_name) {
            return res.status(400).json({ message: "Vui lòng nhập họ và tên" });
        }
        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ message: "Số điện thoại không hợp lệ (gồm 10 chữ số bắt đầu bằng 0 hoặc +84)" });
        }
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ message: "Email không đúng định dạng" });
        }

        if (email !== user.email) {
            const existingEmail = await User.findOne({
                where: {
                    email,
                    user_id: { [Op.ne]: userId }
                }
            });
            if (existingEmail) {
                return res.status(409).json({ message: "Email này đã được sử dụng bởi tài khoản khác" });
            }
        }

        user.full_name = full_name;
        user.phone = phone || null;
        user.email = email;
        await user.save();

        const userResponse = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            reward_points_balance: user.reward_points_balance
        };

        return res.status(200).json({
            message: "Cập nhật thông tin tài khoản thành công",
            user: userResponse
        });
    } catch (error) {
        console.error("Update Profile Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới" });
        }
        if (String(new_password).length < 6) {
            return res.status(400).json({ message: "Mật khẩu mới phải từ 6 ký tự trở lên" });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        }

        const isMatch = await bcrypt.compare(String(current_password), user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Mật khẩu hiện tại không chính xác" });
        }

        user.password = await bcrypt.hash(String(new_password), 10);
        await user.save();

        return res.status(200).json({ message: "Đổi mật khẩu thành công" });
    } catch (error) {
        console.error("Change Password Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
