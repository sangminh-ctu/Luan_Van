const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { Supplier, StockReceipt } = require('../../models/associations');

class SupplierService {
    /**
     * Chuẩn hóa và xác thực dữ liệu đầu vào
     */
    sanitizeInput(data, isCreate = true) {
        const sanitized = {};

        // 0. supplier_code (admin tự nhập: chữ, số, gạch ngang/dưới, tự viết hoa)
        if (data.supplier_code !== undefined) {
            const code = typeof data.supplier_code === 'string' ? data.supplier_code.trim().toUpperCase() : '';
            if (!code) {
                const err = new Error('Mã nhà cung cấp không được để trống');
                err.status = 400;
                throw err;
            }
            if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
                const err = new Error('Mã nhà cung cấp gồm 2-20 ký tự: chữ không dấu, số, dấu - hoặc _ (VD: NCC001, FAHASA)');
                err.status = 400;
                throw err;
            }
            sanitized.supplier_code = code;
        } else if (isCreate) {
            const err = new Error('Mã nhà cung cấp là bắt buộc');
            err.status = 400;
            throw err;
        }

        // 1. supplier_name
        if (data.supplier_name !== undefined) {
            const rawName = typeof data.supplier_name === 'string' ? data.supplier_name.trim().replace(/\s+/g, ' ') : '';
            if (!rawName) {
                const err = new Error('Tên nhà cung cấp không được để trống');
                err.status = 400;
                throw err;
            }
            if (rawName.length > 150) {
                const err = new Error('Tên nhà cung cấp tối đa 150 ký tự');
                err.status = 400;
                throw err;
            }
            sanitized.supplier_name = rawName;
        } else if (isCreate) {
            const err = new Error('Tên nhà cung cấp là bắt buộc');
            err.status = 400;
            throw err;
        }

        // 2. contact_person
        if (data.contact_person !== undefined) {
            const val = typeof data.contact_person === 'string' ? data.contact_person.trim().replace(/\s+/g, ' ') : null;
            if (!val) {
                sanitized.contact_person = null;
            } else {
                if (val.length > 100) {
                    const err = new Error('Người liên hệ tối đa 100 ký tự');
                    err.status = 400;
                    throw err;
                }
                sanitized.contact_person = val;
            }
        }

        // 3. phone (chấp nhận di động 10 số, số bàn 10-11 số có mã vùng, hoặc tổng đài 1800/1900)
        if (data.phone !== undefined) {
            const val = typeof data.phone === 'string' ? data.phone.trim().replace(/\s+/g, '') : null;
            if (!val) {
                sanitized.phone = null;
            } else {
                const phoneClean = val.replace(/[-.]/g, '');
                const phoneRegex = /^(?:(0|\+84)\d{8,10}|(1800|1900)\d{4,6})$/;
                if (!phoneRegex.test(phoneClean) || phoneClean.length > 20) {
                    const err = new Error('Số điện thoại không đúng định dạng (VD: 0901234567, 02838123456 hoặc 1900xxxx)');
                    err.status = 400;
                    throw err;
                }
                sanitized.phone = val;
            }
        }

        // 4. email
        if (data.email !== undefined) {
            const val = typeof data.email === 'string' ? data.email.trim() : null;
            if (!val) {
                sanitized.email = null;
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(val) || val.length > 100) {
                    const err = new Error('Email không đúng định dạng');
                    err.status = 400;
                    throw err;
                }
                sanitized.email = val.toLowerCase();
            }
        }

        // 5. address
        if (data.address !== undefined) {
            const val = typeof data.address === 'string' ? data.address.trim().replace(/\s+/g, ' ') : null;
            if (!val) {
                sanitized.address = null;
            } else {
                if (val.length > 255) {
                    const err = new Error('Địa chỉ tối đa 255 ký tự');
                    err.status = 400;
                    throw err;
                }
                sanitized.address = val;
            }
        }

        // 6. note
        if (data.note !== undefined) {
            const val = typeof data.note === 'string' ? data.note.trim() : null;
            if (!val) {
                sanitized.note = null;
            } else {
                if (val.length > 255) {
                    const err = new Error('Ghi chú tối đa 255 ký tự');
                    err.status = 400;
                    throw err;
                }
                sanitized.note = val;
            }
        }

        // 7. is_active
        if (data.is_active !== undefined) {
            sanitized.is_active = Boolean(data.is_active);
        }

        return sanitized;
    }

    /**
     * Lấy danh sách nhà cung cấp có phân trang, tìm kiếm, lọc trạng thái
     * và tính số phiếu nhập hoàn tất, tổng giá trị hoàn tất, số phiếu đang pending
     */
    async getAll(query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
        const offset = (page - 1) * limit;

        const whereClauses = [];
        const replacements = {};

        if (query.search && query.search.trim()) {
            replacements.search = `%${query.search.trim().toLowerCase()}%`;
            whereClauses.push(`(
                LOWER(COALESCE(s.supplier_code, '')) LIKE :search OR
                LOWER(s.supplier_name) LIKE :search OR
                LOWER(COALESCE(s.contact_person, '')) LIKE :search OR
                COALESCE(s.phone, '') LIKE :search OR
                LOWER(COALESCE(s.email, '')) LIKE :search
            )`);
        }

        if (query.is_active !== undefined && query.is_active !== null && query.is_active !== '') {
            const isActive = query.is_active === 'true' || query.is_active === true;
            replacements.is_active = isActive;
            whereClauses.push(`s.is_active = :is_active`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Đếm tổng số bản ghi
        const countQuery = `
            SELECT COUNT(*)::int AS total
            FROM supplier s
            ${whereSql}
        `;
        const [countResult] = await sequelize.query(countQuery, { replacements });
        const total = countResult[0]?.total || 0;

        // Truy vấn dữ liệu có thống kê phiếu
        replacements.limit = limit;
        replacements.offset = offset;

        const dataQuery = `
            SELECT 
                s.supplier_id,
                s.supplier_code,
                s.supplier_name,
                s.contact_person,
                s.phone,
                s.email,
                s.address,
                s.note,
                s.is_active,
                s.created_at,
                s.updated_at,
                COUNT(r.receipt_id) FILTER (WHERE r.type = 'import' AND r.status = 'completed')::int AS receipt_count,
                COALESCE(SUM(r.total_cost) FILTER (WHERE r.type = 'import' AND r.status = 'completed'), 0)::numeric AS total_value,
                COUNT(r.receipt_id) FILTER (WHERE r.type = 'import' AND r.status = 'pending')::int AS pending_receipt_count
            FROM supplier s
            LEFT JOIN stock_receipt r ON r.supplier_id = s.supplier_id
            ${whereSql}
            GROUP BY s.supplier_id
            ORDER BY s.supplier_id DESC
            LIMIT :limit OFFSET :offset
        `;

        const [rows] = await sequelize.query(dataQuery, { replacements });

        const suppliers = rows.map(r => ({
            ...r,
            receipt_count: Number(r.receipt_count) || 0,
            total_value: Number(r.total_value) || 0,
            pending_receipt_count: Number(r.pending_receipt_count) || 0
        }));

        return {
            suppliers,
            pagination: {
                total,
                page,
                limit,
                totalPages: total === 0 ? 1 : Math.ceil(total / limit)
            }
        };
    }

    /**
     * Lấy danh sách gọn nhẹ cho ô chọn (Dropdown / Select options)
     * Chỉ lấy nhà cung cấp đang hợp tác (is_active = true)
     */
    async getOptions() {
        const suppliers = await Supplier.findAll({
            where: { is_active: true },
            attributes: ['supplier_id', 'supplier_code', 'supplier_name', 'contact_person', 'phone', 'address'],
            order: [['supplier_name', 'ASC']],
            raw: true
        });
        return suppliers;
    }

    /**
     * Lấy chi tiết một nhà cung cấp theo ID
     */
    async getById(id) {
        const supplierId = parseInt(id, 10);
        if (isNaN(supplierId) || supplierId <= 0) {
            const err = new Error('ID nhà cung cấp không hợp lệ');
            err.status = 400;
            throw err;
        }

        const query = `
            SELECT 
                s.supplier_id,
                s.supplier_code,
                s.supplier_name,
                s.contact_person,
                s.phone,
                s.email,
                s.address,
                s.note,
                s.is_active,
                s.created_at,
                s.updated_at,
                COUNT(r.receipt_id) FILTER (WHERE r.type = 'import' AND r.status = 'completed')::int AS receipt_count,
                COALESCE(SUM(r.total_cost) FILTER (WHERE r.type = 'import' AND r.status = 'completed'), 0)::numeric AS total_value,
                COUNT(r.receipt_id) FILTER (WHERE r.type = 'import' AND r.status = 'pending')::int AS pending_receipt_count
            FROM supplier s
            LEFT JOIN stock_receipt r ON r.supplier_id = s.supplier_id
            WHERE s.supplier_id = :supplierId
            GROUP BY s.supplier_id
        `;

        const [rows] = await sequelize.query(query, { replacements: { supplierId } });
        if (rows.length === 0) {
            const err = new Error('Không tìm thấy nhà cung cấp');
            err.status = 404;
            throw err;
        }

        const r = rows[0];
        return {
            ...r,
            receipt_count: Number(r.receipt_count) || 0,
            total_value: Number(r.total_value) || 0,
            pending_receipt_count: Number(r.pending_receipt_count) || 0
        };
    }

    /**
     * Tạo nhà cung cấp mới
     */
    async create(data) {
        const payload = this.sanitizeInput(data, true);

        try {
            const supplier = await Supplier.create(payload);
            return await this.getById(supplier.supplier_id);
        } catch (error) {
            const errStr = error.toString().toLowerCase();
            if (errStr.includes('uq_supplier_code') || error.parent?.constraint === 'uq_supplier_code') {
                const err = new Error(`Mã nhà cung cấp "${payload.supplier_code}" đã được sử dụng`);
                err.status = 409;
                throw err;
            }
            if (error.name === 'SequelizeUniqueConstraintError' || error.parent?.code === '23505' || errStr.includes('uq_supplier_name_norm')) {
                const err = new Error(`Nhà cung cấp "${payload.supplier_name}" đã tồn tại trong hệ thống (không phân biệt chữ hoa, chữ thường và khoảng trắng)`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }

    /**
     * Cập nhật thông tin nhà cung cấp
     */
    async update(id, data) {
        const supplierId = parseInt(id, 10);
        if (isNaN(supplierId) || supplierId <= 0) {
            const err = new Error('ID nhà cung cấp không hợp lệ');
            err.status = 400;
            throw err;
        }

        const supplier = await Supplier.findByPk(supplierId);
        if (!supplier) {
            const err = new Error('Không tìm thấy nhà cung cấp');
            err.status = 404;
            throw err;
        }

        const payload = this.sanitizeInput(data, false);

        try {
            await supplier.update(payload);
            return await this.getById(supplierId);
        } catch (error) {
            const errStr = error.toString().toLowerCase();
            if (errStr.includes('uq_supplier_code') || error.parent?.constraint === 'uq_supplier_code') {
                const err = new Error(`Mã nhà cung cấp "${payload.supplier_code}" đã được sử dụng`);
                err.status = 409;
                throw err;
            }
            if (error.name === 'SequelizeUniqueConstraintError' || error.parent?.code === '23505' || errStr.includes('uq_supplier_name_norm')) {
                const err = new Error(`Tên nhà cung cấp "${payload.supplier_name}" đã tồn tại trong hệ thống`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }

    /**
     * Xóa nhà cung cấp (chặn cứng bằng khóa ngoại nếu đã có phiếu)
     */
    async delete(id) {
        const supplierId = parseInt(id, 10);
        if (isNaN(supplierId) || supplierId <= 0) {
            const err = new Error('ID nhà cung cấp không hợp lệ');
            err.status = 400;
            throw err;
        }

        const supplier = await Supplier.findByPk(supplierId);
        if (!supplier) {
            const err = new Error('Không tìm thấy nhà cung cấp');
            err.status = 404;
            throw err;
        }

        try {
            await supplier.destroy();
            return { message: `Đã xóa nhà cung cấp "${supplier.supplier_name}" thành công` };
        } catch (error) {
            const errStr = error.toString().toLowerCase();
            if (error.name === 'SequelizeForeignKeyConstraintError' || error.parent?.code === '23503' || errStr.includes('foreign key') || errStr.includes('stock_receipt')) {
                const err = new Error(`Từ chối xóa: Nhà cung cấp "${supplier.supplier_name}" đã có phiếu nhập kho trong hệ thống. Vui lòng chuyển trạng thái sang "Ngừng hợp tác" để bảo toàn chứng từ kho.`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }
}

module.exports = new SupplierService();
