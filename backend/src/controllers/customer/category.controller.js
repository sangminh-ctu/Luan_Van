const catalogService = require('../../services/customer/catalog.service');

exports.getCategories = async (req, res, next) => {
    try {
        const categories = await catalogService.getCategories();
        res.status(200).json(categories);
    } catch (error) {
        next(error);
    }
};
