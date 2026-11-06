const router = require('express').Router();
const service = require('../../services/site-config.service');
router.get('/spotlight', async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await service.publicSpotlight());
    } catch (error) { next(error); }
});
module.exports = router;
