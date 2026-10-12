const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

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
        const user = await User.findByPk(req.user.user_id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(401).json({ message: "Không tìm thấy thông tin người dùng" });
        }

        return res.status(200).json({ user });
    } catch (error) {
        console.error("Me Error:", error);
        return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
