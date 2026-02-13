
const {DataTypes, Model} = require('sequelize');
const sequelize = require('../config/db');


class Expense extends Model {}

Expense.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    expense_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    note: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expense_category_id: { type: DataTypes.UUID, allowNull: false },
    admin_id: { type: DataTypes.UUID, allowNull: false },
    payment_method: { type: DataTypes.ENUM('cash', 'credit_card', 'debit_card', 'bank_transfer', 'mobile_payment', 'other'), allowNull: false },
    payment_status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'pending' },
    expense_reciept_url: { type: DataTypes.STRING, allowNull: true },
    expense_approved_by: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
}, {
    sequelize,
    modelName: 'Expense',
    tableName: 'expenses',
    timestamps: true,
});


module.exports = Expense;