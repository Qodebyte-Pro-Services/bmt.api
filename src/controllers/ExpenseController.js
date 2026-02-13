const { Expense, ExpenseCategory, Admin } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

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

async function getExpensesWithFilters(req, res, statusFilter = null) {
    try {
        const { page = 1, limit = 10, filter, admin_id } = req.query;
        const offset = (page - 1) * limit;
        
        let where = {};
        if (statusFilter) where.status = statusFilter;
        if (admin_id) where.admin_id = admin_id;
        
        if (filter) {
            const { start, end } = getDateRange(filter);
            if (start && end) {
                where.date = { [Op.between]: [start, end] };
            }
        }
        
        const { count, rows } = await Expense.findAndCountAll({
            where,
            include: [
                { model: ExpenseCategory, as: 'expense_category' },
                { model: Admin, as: 'admin', attributes: ['admin_id', 'email', 'full_name'] }
            ],
            offset: Number(offset),
            limit: Number(limit),
            order: [['date', 'DESC']]
        });
        
        res.status(200).json({
            success: true,
            expenses: rows,
            pagination: {
                total: count,
                page: Number(page),
                pages: Math.ceil(count / limit),
                limit: Number(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Error fetching expenses', error: error.message });
    }
}

exports.createExpense = async (req, res) => {
    const {
        expense_amount,
        note,
        date,
        expense_category_id,
        payment_method,
        payment_status,
    } = req.body;

    const admin_id = req.user.admin_id;

    if (!expense_amount || !expense_category_id || !payment_method) {
        return res.status(400).json({ 
            message: 'expense_amount, expense_category_id, and payment_method are required.' 
        });
    }

    if (isNaN(expense_amount) || Number(expense_amount) <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number.' });
    }

    try {
        const category = await ExpenseCategory.findByPk(expense_category_id);
        if (!category) {
            return res.status(404).json({ message: 'Expense category not found.' });
        }

        let expense_reciept_url = null;

        if (req.file) {
            const uploadsDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const fileName = `receipt-${Date.now()}-${req.file.originalname}`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, req.file.buffer);

            expense_reciept_url = `/uploads/${fileName}`;
        }
       
        const expense = await Expense.create({
            expense_amount: parseFloat(expense_amount),
            note,
            date: date || new Date(),
            expense_category_id,
            admin_id,
            payment_method,
            payment_status: payment_status || 'pending',
            expense_reciept_url,
            status: 'pending'
        });
        
        res.status(201).json({
            success: true,
            message: 'Expense created successfully',
            expense
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ message: 'Error creating expense', error: error.message });
    }
}

exports.getAllExpenses = async (req, res) => {
    await getExpensesWithFilters(req, res);
}

exports.getExpenseById = async (req, res) => {
    const { id } = req.params;
    try {
        const expense = await Expense.findByPk(id, {
            include: [
                { model: ExpenseCategory, as: 'expense_category' },
                { model: Admin, as: 'admin', attributes: ['admin_id', 'email', 'full_name'] }
            ]
        });
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        res.status(200).json({
            success: true,
            expense
        });
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ message: 'Error fetching expense', error: error.message });
    }
}

exports.getExpenseByAdminId = async (req, res) => {
    req.query.admin_id = req.params.admin_id;
    await getExpensesWithFilters(req, res);
}

exports.getPendingExpenses = async (req, res) => {
    await getExpensesWithFilters(req, res, 'pending');
}

exports.getApprovedExpenses = async (req, res) => {
    await getExpensesWithFilters(req, res, 'approved');
}

exports.getRejectedExpenses = async (req, res) => {
    await getExpensesWithFilters(req, res, 'rejected');
}

exports.updateExpenseStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const approverId = req.user.admin_id;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ 
            message: 'Invalid status. Only "approved" or "rejected" are allowed.' 
        });
    }

    try {
        const expense = await Expense.findByPk(id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        expense.status = status;
        expense.expense_approved_by = approverId;

        await expense.save();

        res.status(200).json({ 
            success: true,
            message: `Expense ${status} successfully`, 
            expense 
        });
    } catch (error) {
        console.error('Error updating expense status:', error);
        res.status(500).json({ 
            message: 'Error updating expense status', 
            error: error.message 
        });
    }
}

exports.deleteExpense = async (req, res) => {
    const { id } = req.params;
    try {
        const expense = await Expense.findByPk(id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        await expense.destroy();
        res.status(200).json({ 
            success: true,
            message: 'Expense deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Error deleting expense', error: error.message });
    }
}