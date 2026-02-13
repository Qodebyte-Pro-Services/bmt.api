
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Product extends Model {}
Product.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  category_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  brand: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  base_sku: { type: DataTypes.STRING },
  image_url: { type: DataTypes.JSON },
  taxable: { type: DataTypes.BOOLEAN, defaultValue: false },
  threshold: { type: DataTypes.INTEGER },
  unit: { type: DataTypes.STRING(50) },
  hasVariation: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  modelName: 'Product',
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});



class Variant extends Model {}
Variant.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Product, key: 'id' } },
  attributes: { type: DataTypes.JSON, allowNull: false },
  cost_price: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  selling_price: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  threshold: { type: DataTypes.INTEGER },
  sku: { type: DataTypes.STRING, allowNull: false, unique: true },
  image_url: { type: DataTypes.JSON },
  expiry_date: { type: DataTypes.DATE },
   barcode: {
  type: DataTypes.STRING(100),
  allowNull: true,
  unique: true,
  validate: {
    notEmpty: true
  }
},
   is_active: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true,
    comment: 'Track if variant is available for sale'
  }
}, {
  sequelize,
  modelName: 'Variant',
  tableName: 'variants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
   indexes: [
    { fields: ['sku'] },
    { fields: ['barcode'] },
    { fields: ['product_id'] },
    { fields: ['product_id', 'barcode'], unique: true }
  ]
});

class InventoryLog extends Model {}
InventoryLog.init({
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    variant_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Variant, key: 'id' } },
    type: { 
        type: DataTypes.ENUM('restock', 'sale', 'adjustment'), 
        allowNull: false,
        validate: {
            isIn: [['restock', 'sale', 'adjustment']]
        }
    },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    note: { type: DataTypes.TEXT },
    recorded_by: { type: DataTypes.UUID },
  recorded_by_type: { type: DataTypes.ENUM('admin'), allowNull: false },
    reason: { 
        type: DataTypes.ENUM('increase', 'decrease'),
        allowNull: true,
        validate: {
            isIn: [['increase', 'decrease']]
        }
    },
}, {
    sequelize,
    modelName: 'InventoryLog',
    tableName: 'inventory_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});


class StockNotification extends Model {}
StockNotification.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  variant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: Variant, key: 'id' },
    onDelete: 'CASCADE'
  },
  notification_type: { type: DataTypes.STRING(50), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  read_at: { type: DataTypes.DATE },
  read_by: { type: DataTypes.STRING(50) }, 
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName: 'StockNotification',
  tableName: 'stock_notifications',
  timestamps: false
});



module.exports = { Product, Variant, InventoryLog, StockNotification };