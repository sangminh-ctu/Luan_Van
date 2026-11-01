const router = require("express").Router();
const service = require("../../services/flash-sale.service");
router.get("/current", async (req, res) =>
  res.json(await service.current(req.query)),
);
module.exports = router;
