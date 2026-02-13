const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Role extends Model {}

Role.init({
        roles_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        role_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,

        },
        permissions: {
            type: DataTypes.JSON,
            allowNull: true,
        },
},
{
    sequelize,
    modelName: 'Role',
    tableName: 'roles',
    timestamps: true,
}
);

module.exports = Role;