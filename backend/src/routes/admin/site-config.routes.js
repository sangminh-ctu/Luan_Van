const router = require('express').Router();
const service = require('../../services/site-config.service');
const { uploadBanner } = require('../../middlewares/banner-upload.middleware');
const handle = fn => async (req, res, next) => {
    try { res.json(await fn(req)); } catch (error) { next(error); }
};
router.get('/', handle(() => service.read()));
router.put('/', handle(req => service.save(req.body)));
router.post('/preview', handle(req => service.preview(req.body)));
router.post('/upload-banner', uploadBanner);
module.exports = router;
