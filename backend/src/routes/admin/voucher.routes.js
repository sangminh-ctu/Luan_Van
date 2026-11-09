const router = require("express").Router();
const controller = require("../../controllers/admin/voucher.controller");
router.get("/", controller.list);
router.get("/:id", controller.detail);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.changeStatus);
router.delete("/:id", controller.remove);
module.exports = router;
