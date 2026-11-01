const router = require("express").Router();
const service = require("../../services/flash-sale.service");
router.get("/", async (req, res) => res.json(await service.list(req.query)));
router.get("/:id", async (req, res) =>
  res.json(await service.detail(req.params.id)),
);
router.post("/", async (req, res) =>
  res
    .status(201)
    .json(await service.save(null, req.body, req.user.user_id || req.user.id)),
);
router.put("/:id", async (req, res) =>
  res.json(await service.save(req.params.id, req.body)),
);
for (const action of ["publish", "cancel", "end"]) {
  router.post("/:id/" + action, async (req, res) =>
    res.json(await service.action(req.params.id, action)),
  );
}
router.delete("/:id", async (req, res) =>
  res.json(await service.action(req.params.id, "delete")),
);
module.exports = router;
