const supplierService = require('../../services/admin/supplier.service');

exports.getAll = async (req, res, next) => {
    try {
        const result = await supplierService.getAll(req.query);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

exports.getOptions = async (req, res, next) => {
    try {
        const options = await supplierService.getOptions();
        res.status(200).json(options);
    } catch (error) {
        next(error);
    }
};

exports.getById = async (req, res, next) => {
    try {
        const supplier = await supplierService.getById(req.params.id);
        res.status(200).json(supplier);
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const supplier = await supplierService.create(req.body);
        res.status(201).json(supplier);
    } catch (error) {
        next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const supplier = await supplierService.update(req.params.id, req.body);
        res.status(200).json(supplier);
    } catch (error) {
        next(error);
    }
};

exports.delete = async (req, res, next) => {
    try {
        const result = await supplierService.delete(req.params.id);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
