
const { ExpenseCategory, Expense } = require('../models');

exports.createExpenseCategory = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Category name is required' });
    }

    if (name.trim() === '') {
        return res.status(400).json({ message: 'Category name cannot be empty' });
    }

    try {
        const existing = await ExpenseCategory.findOne({ where: { name: name.trim() } });
        if (existing) {
            return res.status(409).json({ message: 'Category name already exists' });
        }
        const newCategory = await ExpenseCategory.create({ name: name.trim() });
        res.status(201).json(newCategory);
    } catch (error) {
        
        console.error('Error creating expense category:', error);
        res.status(500).json({ message: 'Error creating expense category', error: error.message });
    }
}


exports.getAllExpenseCategories = async (req, res) => {
    try {
        const categories = await ExpenseCategory.findAll();
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching expense categories:', error);
        res.status(500).json({ message: 'Error fetching expense categories', error: error.message });
    }
}

exports.getExpensesONCategory = async (req, res) => {
    const { expense_category_id } = req.params;
    const { page = 1, limit = 10, filter, status } = req.query;
    function getDateRange(filter) {
        const now = new Date();
        let start, end;
        switch (filter) {
            case 'today':
                start = new Date(now.setHours(0,0,0,0));
                end = new Date(now.setHours(23,59,59,999));
                break;
            case 'yesterday':
                start = new Date(now.setDate(now.getDate() - 1));
                start.setHours(0,0,0,0);
                end = new Date(start);
                end.setHours(23,59,59,999);
                break;
            case 'week':
                start = new Date(now);
                start.setDate(now.getDate() - now.getDay());
                start.setHours(0,0,0,0);
                end = new Date(now);
                end.setDate(start.getDate() + 6);
                end.setHours(23,59,59,999);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
            default:
                start = null;
                end = null;
        }
        return { start, end };
    }

    try {
        const category = await ExpenseCategory.findByPk(expense_category_id);
        if (!category) {
            return res.status(404).json({ message: 'Expense category not found' });
        }
        let where = { expense_category_id };
        if (status) where.status = status;
        if (filter) {
            const { start, end } = getDateRange(filter);
            if (start && end) {
                where.date = { $between: [start, end] };
            }
        }
        const offset = (page - 1) * limit;
        const { count, rows } = await Expense.findAndCountAll({
            where,
            include: [{ model: ExpenseCategory, as: 'category' }],
            offset: Number(offset),
            limit: Number(limit),
            order: [['date', 'DESC']]
        });
        res.status(200).json({
            category: { expense_category_id: category.expense_category_id, name: category.name },
            expenses: rows,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('Error fetching expenses for category:', error);
        res.status(500).json({ message: 'Error fetching expenses for category', error: error.message });
    }
}


exports.UpdateExpenseCategory = async (req, res) => {
    const { expense_category_id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Category name is required' });
    }
    if (name.trim() === '') {
        return res.status(400).json({ message: 'Category name cannot be empty' });  
    }

    try {
        const category = await ExpenseCategory.findByPk(expense_category_id);
        if (!category) {
            return res.status(404).json({ message: 'Expense category not found' });
        }
        const existing = await ExpenseCategory.findOne({ where: { name: name.trim() } });
        if (existing && existing.expense_category_id !== expense_category_id) {
            return res.status(409).json({ message: 'Category name already exists' });
        }
        category.name = name.trim();
        await category.save();
        res.status(200).json(category);
    } catch (error) {
        console.error('Error updating expense category:', error);
        res.status(500).json({ message: 'Error updating expense category', error: error.message });
    }
}

exports.deleteExpenseCategory = async (req, res) => {
    const { expense_category_id } = req.params;
    try {
        const category = await ExpenseCategory.findByPk(expense_category_id);
        if (!category) {
            return res.status(404).json({ message: 'Expense category not found' });
        }
        await category.destroy();
        res.status(200).json({ message: 'Expense category deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense category:', error);
        res.status(500).json({ message: 'Error deleting expense category', error: error.message });
    }
}



