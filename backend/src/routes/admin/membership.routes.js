const router = require("express").Router();
const service = require("../../services/membership.service");
router.get("/", async (req, res) => res.json({ tiers: await service.list() }));
router.put("/", async (req, res) => res.json(await service.save(req.body)));
module.exports = router;
