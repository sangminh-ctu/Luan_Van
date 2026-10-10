exports.requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: "Vui lòng đăng nhập để tiếp tục" });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Tài khoản này không có quyền quản trị" });
        }

        next();
    };
};

exports.requireAdmin = exports.requireRole('admin');
