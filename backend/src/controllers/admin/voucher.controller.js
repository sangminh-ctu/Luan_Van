const service = require("../../services/admin/voucher.service");

exports.list = async (req, res) => res.json(await service.list(req.query));
exports.detail = async (req, res) =>
  res.json(await service.detail(req.params.id));
exports.create = async (req, res) =>
  res.status(201).json(await service.save(null, req.body));
exports.update = async (req, res) =>
  res.json(await service.save(req.params.id, req.body));
exports.changeStatus = async (req, res) =>
  res.json(await service.changeStatus(req.params.id, req.body));
exports.remove = async (req, res) =>
  res.json(await service.remove(req.params.id));
