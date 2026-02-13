
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');




class Discount extends Model {}
Discount.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  discount_type: {
     type: DataTypes.ENUM(
        'fixed_amount',
        'percentage'
      ),
      allowNull: false,
  },
  percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  fixed_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  start_date: { type: DataTypes.DATE },
  end_date: { type: DataTypes.DATE },
  description: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName: 'Discount',
  tableName: 'discounts',
  timestamps: false
});


class ProductDiscount extends Model {}
ProductDiscount.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  discount_id: { type: DataTypes.INTEGER, allowNull: false }
}, {
  sequelize,
  modelName: 'ProductDiscount',
  tableName: 'product_discounts',
  timestamps: false
});

class Tax extends Model {}
Tax.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  taxRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
}, {
  sequelize,
  modelName: 'Tax',
  tableName: 'taxes',
  timestamps: true
});




module.exports = { 
  Discount,
  ProductDiscount,
  Tax
};
