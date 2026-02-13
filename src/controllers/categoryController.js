const { Category, Product, Variant, InventoryLog } = require('../models');
const { Op } = require('sequelize');

exports.createCategory = async (req, res) => {
    try {
        const {name} = req.body;
        if (!name) {
            return res.status(400).json({message: 'Category name is required'});
        }
        const existing = await Category.findOne({where: {name: name.trim()}});
        if (existing) {
            return res.status(409).json({message: 'Category name already exists'});
        }
        const newCategory = await Category.create({name: name.trim()});
        res.status(201).json(newCategory);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({message: 'Error creating category', error: error.message});
    }
}

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({message: 'Error fetching categories', error: error.message});
    }
}

exports.getProductsForCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const products = await Category.findByPk(id, {
            include: [{
                model: Product,
                as: 'products',
                include: [
                    {
                        model: Variant,
                        as: 'variants'
                    }
                ]
            }]
        });
        
        if (!products) {
            return res.status(404).json({message: 'Category not found'});
        }
        
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products for category:', error);
        res.status(500).json({message: 'Error fetching products for category', error: error.message});
    }
}

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const {name} = req.body;
        if (!name) {
            return res.status(400).json({message: 'Category name is required'});
        }
        
        const existing = await Category.findOne({
            where: {
                name: name.trim(),
                id: { [Op.ne]: id }
            }
        });
        if (existing) {
            return res.status(409).json({message: 'Category name already exists'});
        }
        
        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({message: 'Category not found'});
        }
        
        await category.update({name: name.trim()});
        res.status(200).json(category);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({message: 'Error updating category', error: error.message});
    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id, {
            include: [{
                model: Product,
                as: 'products',
                include: [
                    {
                        model: Variant,
                        as: 'variants'
                    }
                ]
            }]
        });
        
        if (!category) {
            return res.status(404).json({message: 'Category not found'});
        }
        
     
        for (const product of category.products) {
            for (const variant of product.variants) {
                await InventoryLog.destroy({where: {variant_id: variant.id}});  
                await variant.destroy();
            }
            await product.destroy();
        }

        await category.destroy();
        res.status(200).json({message: 'Category and all associated products deleted successfully'});
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({message: 'Error deleting category', error: error.message});
    }
}