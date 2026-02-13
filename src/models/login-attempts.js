const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class LoginAttempt extends Model {}

LoginAttempt.init({
  login_attempt_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  admin_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  device: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  ip_address: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  status: {
    type: DataTypes.ENUM("pending", "approved", "rejected", "completed"),
    defaultValue: "pending",
  },

  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'admin_id'
    }
  },

  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  rejected_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, { 
  sequelize,
  modelName: 'LoginAttempt',
  tableName: 'login_attempts',
  timestamps: true,
});

module.exports = LoginAttempt;