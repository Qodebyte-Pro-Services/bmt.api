
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class ExpenseCategory extends Model {}

ExpenseCategory.init({
  expense_category_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
}, {
  sequelize,
  modelName: 'ExpenseCategory',
  tableName: 'expense_categories',
});

module.exports = ExpenseCategory;
