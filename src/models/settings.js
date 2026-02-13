const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Settings extends Model {}

Settings.init(
  {
    settings_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    site_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Big Men Transaction Apparel",
    },
    site_logo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    owner_first_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    owner_last_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    owner_email: {
       type: DataTypes.STRING,
      allowNull: true,
    },
      company_email: {
       type: DataTypes.STRING,
      allowNull: true,
    },
    company_phone: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
    },
    company_address: {
       type: DataTypes.STRING,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "admins", key: "admin_id" },
      onDelete: "CASCADE",
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "admins", key: "admin_id" },
      onDelete: "SET NULL",
    },
  },
  {
    sequelize,
    modelName: "Settings",
    tableName: "settings",
    timestamps: true,
  }
);

module.exports = Settings;