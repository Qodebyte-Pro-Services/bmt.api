const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Category extends Model {}
Category.init({
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    created_at:{type:DataTypes.DATE},
    updated_at:{type:DataTypes.DATE}
}, {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
})


module.exports = Category
