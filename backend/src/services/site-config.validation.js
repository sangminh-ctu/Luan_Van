function invalid(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function ids(value, max, label) {
    if (!Array.isArray(value) || value.length > max || value.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) {
        throw invalid(`${label}: tối đa ${max} ID nguyên dương.`);
    }
    if (new Set(value).size !== value.length) throw invalid(`${label} không được trùng lặp.`);
    return value;
}

function validateConfig(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Cấu hình không hợp lệ.');
    const text = (key, max, required = false) => {
        const value = input[key];
        if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
            throw invalid(`${key}: ${required ? 'bắt buộc, ' : ''}tối đa ${max} ký tự.`);
        }
        return value.trim();
    };
    const data = {
        title: text('title', 150, true),
        banner_alt: text('banner_alt', 200),
        manual_tab_label: text('manual_tab_label', 80, true),
        banner_url: input.banner_url === '' ? null : input.banner_url,
        is_active: input.is_active,
        book_ids: ids(input.book_ids, 10, 'Sách tuyển chọn'),
        category_ids: ids(input.category_ids, 6, 'Danh mục')
    };
    if (typeof data.is_active !== 'boolean') throw invalid('Trạng thái bật/tắt không hợp lệ.');
    if (data.banner_url !== null && (typeof data.banner_url !== 'string' || !/^\/uploads\/banners\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(data.banner_url))) {
        throw invalid('Banner phải là ảnh được tải lên hệ thống.');
    }
    if (data.is_active && !data.book_ids.length && !data.category_ids.length) throw invalid('Hãy chọn ít nhất một sách hoặc danh mục trước khi bật khối.');
    return data;
}

module.exports = { invalid, ids, validateConfig };
