const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class OTP extends Model {}

OTP.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  entity_id: { 
    type: DataTypes.UUID,
    allowNull: false,
  },
  entity_type: { 
    type: DataTypes.ENUM('Admin'),
    allowNull: false,
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  purpose: {
    type: DataTypes.ENUM(
      'register',
      'login',
      'login_approved',
      'reset_password'
    ),
    allowNull: false,
    defaultValue: 'register',
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of failed verification attempts'
  },
  max_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    comment: 'Maximum allowed failed attempts before OTP invalidation'
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Track if OTP has been successfully used'
  },
  login_attempt_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'login_attempts',
      key: 'login_attempt_id'
    },
    comment: 'Reference to login attempt for tracking'
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when OTP was successfully verified'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'OTP',
  tableName: 'otps',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['entity_id', 'purpose'],
      name: 'idx_entity_purpose'
    },
    {
      fields: ['login_attempt_id'],
      name: 'idx_login_attempt'
    },
    {
      fields: ['expires_at'],
      name: 'idx_expires_at'
    }
  ]
});

module.exports = OTP;