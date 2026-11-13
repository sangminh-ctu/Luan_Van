const router = require("express").Router();
const { verifyToken } = require("../../middlewares/auth.middleware");
const service = require("../../services/membership.service");
router.get("/", verifyToken, async (req, res) =>
  res.json(await service.overview(req.user.user_id || req.user.id)),
);
module.exports = router;
