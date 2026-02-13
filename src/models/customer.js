const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db'); 

class Customer extends Model {}

Customer.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: { isEmail: true },
  },
  is_walk_in: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    // Ensure proper type coercion for SQLite
    get() {
      const value = this.getDataValue('is_walk_in');
      return value === true || value === 1 || value === '1';
    },
    set(value) {
      this.setDataValue('is_walk_in', value === true || value === 1 || value === '1');
    },
  },
  is_deleted: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
},
deleted_at: {
  type: DataTypes.DATE,
  allowNull: true,
},

}, {
  sequelize,
  modelName: 'Customer',
  tableName: 'customers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Customer;
