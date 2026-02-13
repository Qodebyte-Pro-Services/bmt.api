
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');


class Attribute extends Model {}
Attribute.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
}, {
  sequelize,
  modelName: 'Attribute',
  tableName: 'attributes',
  timestamps: true,
});



class AttributeValue extends Model {}
AttributeValue.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  attribute_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Attribute, key: 'id' }
  },
  value: { type: DataTypes.STRING, allowNull: false },
}, {
    
  sequelize,
  modelName: 'AttributeValue',
  tableName: 'attribute_values',
  timestamps: true,
});





module.exports = { Attribute, AttributeValue };
