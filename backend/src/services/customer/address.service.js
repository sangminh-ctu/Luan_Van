const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { Address, Order } = require('../../models/associations');

// Ký tự đánh dấu bản ghi địa chỉ lịch sử (đã ẩn khỏi sổ địa chỉ hiện tại nhưng vẫn giữ khóa ngoại cho ORDERS cũ)
const ARCHIVED_MARKER = '\u200B';

class AddressService {
    validatePayload(data) {
        const recipient_name = String(data?.recipient_name || '').replaceAll(ARCHIVED_MARKER, '').trim();
        const recipient_phone = String(data?.recipient_phone || '').replaceAll(ARCHIVED_MARKER, '').trim();
        const province = String(data?.province || '').replaceAll(ARCHIVED_MARKER, '').trim();
        const district = String(data?.district || '').replaceAll(ARCHIVED_MARKER, '').trim();
        const ward = String(data?.ward || '').replaceAll(ARCHIVED_MARKER, '').trim();
        const street_detail = String(data?.street_detail || '').replaceAll(ARCHIVED_MARKER, '').trim();

        if (!recipient_name || !recipient_phone || !province || !district || !ward || !street_detail) {
            const err = new Error('Vui lòng nhập đầy đủ họ tên, số điện thoại, tỉnh/thành, quận/huyện, phường/xã và địa chỉ cụ thể');
            err.status = 400;
            throw err;
        }

        if (!/^[0-9+\-\s]{8,15}$/.test(recipient_phone)) {
            const err = new Error('Số điện thoại người nhận không hợp lệ');
            err.status = 400;
            throw err;
        }

        return {
            recipient_name,
            recipient_phone,
            province,
            district,
            ward,
            street_detail,
            is_default: Boolean(data?.is_default)
        };
    }

    /**
     * Lấy danh sách địa chỉ đang hoạt động trong sổ địa chỉ của khách hàng
     */
    async getAddresses(userId) {
        return await Address.findAll({
            where: {
                user_id: userId,
                street_detail: { [Op.notLike]: `%${ARCHIVED_MARKER}` }
            },
            order: [['is_default', 'DESC'], ['address_id', 'DESC']]
        });
    }

    async createAddress(userId, data) {
        const clean = this.validatePayload(data);
        const transaction = await sequelize.transaction();

        try {
            const existingCount = await Address.count({
                where: {
                    user_id: userId,
                    street_detail: { [Op.notLike]: `%${ARCHIVED_MARKER}` }
                },
                transaction
            });

            const shouldBeDefault = existingCount === 0 || clean.is_default;

            if (shouldBeDefault && existingCount > 0) {
                await Address.update(
                    { is_default: false },
                    { where: { user_id: userId }, transaction }
                );
            }

            const created = await Address.create({
                user_id: userId,
                recipient_name: clean.recipient_name,
                recipient_phone: clean.recipient_phone,
                province: clean.province,
                district: clean.district,
                ward: clean.ward,
                street_detail: clean.street_detail,
                is_default: shouldBeDefault
            }, { transaction });

            await transaction.commit();
            return created;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Cập nhật địa chỉ của khách hàng.
     * Nếu địa chỉ này đã từng được sử dụng trong ORDERS, ẩn bản ghi cũ khỏi sổ địa chỉ
     * (để giữ nguyên cho đơn lịch sử) và tạo bản ghi ADDRESS mới cho khách hàng.
     */
    async updateAddress(userId, addressId, data) {
        const clean = this.validatePayload(data);
        const transaction = await sequelize.transaction();

        try {
            const existing = await Address.findOne({
                where: { address_id: addressId, user_id: userId },
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!existing) {
                const err = new Error('Không tìm thấy địa chỉ nhận hàng');
                err.status = 404;
                throw err;
            }

            const usedInOrdersCount = await Order.count({
                where: { address_id: addressId },
                transaction
            });

            const shouldBeDefault = clean.is_default || existing.is_default;

            if (shouldBeDefault) {
                await Address.update(
                    { is_default: false },
                    {
                        where: {
                            user_id: userId,
                            address_id: { [Op.ne]: addressId }
                        },
                        transaction
                    }
                );
            }

            if (usedInOrdersCount > 0) {
                // Lưu trữ dòng cũ cho đơn hàng lịch sử và ẩn khỏi sổ địa chỉ hiện tại
                existing.is_default = false;
                if (!existing.street_detail.endsWith(ARCHIVED_MARKER)) {
                    existing.street_detail = `${existing.street_detail}${ARCHIVED_MARKER}`;
                }
                await existing.save({ transaction });

                const newAddress = await Address.create({
                    user_id: userId,
                    recipient_name: clean.recipient_name,
                    recipient_phone: clean.recipient_phone,
                    province: clean.province,
                    district: clean.district,
                    ward: clean.ward,
                    street_detail: clean.street_detail,
                    is_default: shouldBeDefault
                }, { transaction });

                await transaction.commit();
                return newAddress;
            }

            existing.recipient_name = clean.recipient_name;
            existing.recipient_phone = clean.recipient_phone;
            existing.province = clean.province;
            existing.district = clean.district;
            existing.ward = clean.ward;
            existing.street_detail = clean.street_detail;
            existing.is_default = shouldBeDefault;
            await existing.save({ transaction });

            await transaction.commit();
            return existing;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async setDefaultAddress(userId, addressId) {
        const transaction = await sequelize.transaction();
        try {
            const existing = await Address.findOne({
                where: {
                    address_id: addressId,
                    user_id: userId,
                    street_detail: { [Op.notLike]: `%${ARCHIVED_MARKER}` }
                },
                transaction
            });

            if (!existing) {
                const err = new Error('Không tìm thấy địa chỉ nhận hàng');
                err.status = 404;
                throw err;
            }

            await Address.update(
                { is_default: false },
                { where: { user_id: userId }, transaction }
            );

            existing.is_default = true;
            await existing.save({ transaction });

            await transaction.commit();
            return existing;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Xóa địa chỉ khỏi sổ địa chỉ của khách hàng.
     * - Nếu chưa có đơn hàng nào dùng: xóa vật lý khỏi bảng ADDRESS.
     * - Nếu đã có đơn hàng dùng (ON DELETE RESTRICT): ẩn khỏi sổ địa chỉ hiện tại để khách không còn thấy,
     *   nhưng vẫn giữ bản ghi cho đơn hàng lịch sử.
     */
    async deleteAddress(userId, addressId) {
        const transaction = await sequelize.transaction();
        try {
            const existing = await Address.findOne({
                where: {
                    address_id: addressId,
                    user_id: userId,
                    street_detail: { [Op.notLike]: `%${ARCHIVED_MARKER}` }
                },
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!existing) {
                const err = new Error('Không tìm thấy địa chỉ nhận hàng');
                err.status = 404;
                throw err;
            }

            const wasDefault = existing.is_default;
            const usedInOrdersCount = await Order.count({
                where: { address_id: addressId },
                transaction
            });

            if (usedInOrdersCount > 0) {
                existing.is_default = false;
                if (!existing.street_detail.endsWith(ARCHIVED_MARKER)) {
                    existing.street_detail = `${existing.street_detail}${ARCHIVED_MARKER}`;
                }
                await existing.save({ transaction });
            } else {
                await existing.destroy({ transaction });
            }

            if (wasDefault) {
                const nextLatest = await Address.findOne({
                    where: {
                        user_id: userId,
                        street_detail: { [Op.notLike]: `%${ARCHIVED_MARKER}` }
                    },
                    order: [['address_id', 'DESC']],
                    transaction
                });
                if (nextLatest) {
                    nextLatest.is_default = true;
                    await nextLatest.save({ transaction });
                }
            }

            await transaction.commit();
            return { message: 'Đã xóa địa chỉ nhận hàng thành công' };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = new AddressService();
