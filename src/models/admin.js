const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Admin extends Model {}

Admin.init({
  admin_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,  
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  admin_role: {
    type: DataTypes.UUID,  
    references: {
      model: "roles",
      key: "roles_id",
    },
    onDelete: "SET NULL",
    allowNull: true,
  },
    email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: {
      name: 'idx_admin_email',
      msg: 'Email must be unique'
    },
    validate: { isEmail: true },
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: {
      name: 'idx_admin_username',
      msg: 'Username must be unique'
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: {
      name: 'idx_admin_phone',
      msg: 'Phone must be unique'
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  login_success_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  twoFa_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  sequelize,
  modelName: 'Admin',
  tableName: 'admins',
  timestamps: true,
});

module.exports = Admin;