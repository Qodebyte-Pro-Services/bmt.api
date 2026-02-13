const { Discount, Product, ProductDiscount, sequelize } = require("../models");




exports.createDiscount = async (req, res) => {
    try {
        const { name, discount_type, description, percentage, fixed_amount, start_date, end_date } = req.body;

      
        if (!name || !discount_type || !start_date || !end_date) {
            return res.status(400).json({ message: 'Missing required fields: name, discount_type, start_date, end_date.' });
        }

        if (!['fixed_amount', 'percentage'].includes(discount_type)) {
            return res.status(400).json({ message: 'Invalid discount_type. Must be "fixed_amount" or "percentage".' });
        }

        if (discount_type === 'percentage' && !percentage) {
            return res.status(400).json({ message: 'percentage is required when discount_type is "percentage".' });
        }

        if (discount_type === 'fixed_amount' && !fixed_amount) {
            return res.status(400).json({ message: 'fixed_amount is required when discount_type is "fixed_amount".' });
        }

        if (percentage && (percentage < 0 || percentage > 100)) {
            return res.status(400).json({ message: 'percentage must be between 0 and 100.' });
        }

        if (fixed_amount && fixed_amount <= 0) {
            return res.status(400).json({ message: 'fixed_amount must be greater than 0.' });
        }

        const existing = await Discount.findOne({ where: { name: name.trim() } });
        if (existing) {
            return res.status(409).json({ message: 'Discount name already exists.' });
        }

        const discount = await Discount.create({
            name: name.trim(),
            discount_type,
            percentage: discount_type === 'percentage' ? percentage : null,
            fixed_amount: discount_type === 'fixed_amount' ? fixed_amount : null,
            description,
            start_date,
            end_date
        });

        return res.status(201).json({ discount });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error.', error: error.message });
    }
};


exports.LinkDiscountTOProduct = async (req, res) => {
    try {
        const { product_id, discount_id } = req.body;

        const discount = await Discount.findByPk(discount_id);
        if (!discount) {
            return res.status(404).json({ message: 'Discount not found.' });
        }

        const product = await Product.findByPk(product_id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const existingLink = await ProductDiscount.findOne({ where: { product_id, discount_id } });
        if (existingLink) {
            return res.status(409).json({ message: 'Discount already linked to product.' });
        }

        await ProductDiscount.create({ product_id, discount_id });
        return res.status(200).json({ message: 'Discount linked to product successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.', error: err.message });
    }
};

exports.getDiscounts = async (req, res) => {
    try {
        const discounts = await Discount.findAll({
            order: [['created_at', 'DESC']]
        });
        return res.status(200).json({ discounts });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

exports.getListOfLinks = async (req, res) => {
    try {
        const links = await ProductDiscount.findAll({
            include: [
                { model: Product, as: 'product' },
                { model: Discount, as: 'discount' }
            ]
        });
        return res.status(200).json({ links });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error.', error: error.message });
    }
};



exports.updateDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, discount_type, description, percentage, fixed_amount, start_date, end_date } = req.body;

        const existing = await Discount.findByPk(id);
        if (!existing) {
            return res.status(404).json({ message: 'Discount not found.' });
        }

      
        if (name) {
            const existingName = await Discount.findOne({
                where: {
                    name: name.trim(),
                    id: { [Op.ne]: id }
                }
            });
            if (existingName) {
                return res.status(409).json({ message: 'Discount name already exists.' });
            }
        }

     
        if (discount_type && !['fixed_amount', 'percentage'].includes(discount_type)) {
            return res.status(400).json({ message: 'Invalid discount_type. Must be "fixed_amount" or "percentage".' });
        }

      
        if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
            return res.status(400).json({ message: 'percentage must be between 0 and 100.' });
        }
 
        if (fixed_amount !== undefined && fixed_amount <= 0) {
            return res.status(400).json({ message: 'fixed_amount must be greater than 0.' });
        }

      
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (discount_type) updateData.discount_type = discount_type;
        if (description !== undefined) updateData.description = description;
        if (percentage !== undefined) updateData.percentage = percentage;
        if (fixed_amount !== undefined) updateData.fixed_amount = fixed_amount;
        if (start_date) updateData.start_date = start_date;
        if (end_date) updateData.end_date = end_date;

        await Discount.update(updateData, { where: { id } });

        const updatedDiscount = await Discount.findByPk(id);
        return res.status(200).json({ discount: updatedDiscount });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

exports.deleteAndUnlinkDiscountAndProduct = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const discount = await Discount.findByPk(id, { transaction: t });
        if (!discount) {
            await t.rollback();
            return res.status(404).json({ message: 'Discount not found.' });
        }

      
        await ProductDiscount.destroy({ where: { discount_id: id }, transaction: t });

   
        await discount.destroy({ transaction: t });

        await t.commit();

        return res.status(200).json({ message: 'Discount deleted successfully.' });
    } catch (error) {
        console.error(error);
        await t.rollback();
        return res.status(500).json({ message: 'Server error.', error: error.message });
    }
};