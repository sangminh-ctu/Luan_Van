const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { invalid } = require('../services/site-config.validation');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }).single('image');

function imageExtension(buffer) {
    if (buffer.length < 12) return null;
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
    if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    return null;
}

async function saveBanner(req, res, next) {
    try {
        if (!req.file) throw invalid('Vui lòng chọn ảnh banner.');
        const ext = imageExtension(req.file.buffer);
        const types = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        if (!ext || req.file.mimetype !== types[ext]) throw invalid('Chỉ nhận ảnh JPG, PNG hoặc WebP hợp lệ.');
        const dir = path.join(__dirname, '../../uploads/banners');
        await fs.mkdir(dir, { recursive: true });
        const filename = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
        await fs.writeFile(path.join(dir, filename), req.file.buffer, { flag: 'wx' });
        res.status(201).json({ banner_url: `/uploads/banners/${filename}` });
    } catch (error) { next(error); }
}

function uploadBanner(req, res, next) {
    upload(req, res, error => {
        if (error) return next(invalid(error.code === 'LIMIT_FILE_SIZE' ? 'Banner tối đa 5 MB.' : 'Dữ liệu tải ảnh không hợp lệ.'));
        saveBanner(req, res, next);
    });
}

module.exports = { uploadBanner, imageExtension };
