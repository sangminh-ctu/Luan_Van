const jwt = require('jsonwebtoken');

const getJwtSecret = () => process.env.JWT_SECRET || 'fallback_secret_key';

exports.verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "Vui lòng đăng nhập để tiếp tục" });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: "Token không hợp lệ" });
        }

        const decoded = jwt.verify(token, getJwtSecret());
        req.user = decoded; // { user_id, role, ... }
        next();
    } catch (error) {
        return res.status(401).json({ message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ" });
    }
};
