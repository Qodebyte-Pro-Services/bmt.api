const { Role, sequelize, Admin } = require('../models');
const rateLimitMap = new Map();

function rateLimit(key, max = 5, windowMs = 60 * 1000) {
  const now = Date.now();
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, last: now });
  } else {
    const entry = rateLimitMap.get(key);
    if (now - entry.last > windowMs) {
      entry.count = 1;
      entry.last = now;
    } else {
      entry.count++;
    }
    if (entry.count > max) return false;
    rateLimitMap.set(key, entry);
  }
  return true;
}

exports.createRole = async (req , res) => {
  const t = await sequelize.transaction();

  try {
    const { role_name, permissions } = req.body;

  
    if (!rateLimit('createRole:' + role_name)) {
      return res.status(429).json({ message: "Too many attempts, try again later." });
    }

    
    if (!role_name) {
      return res.status(400).json({ message: "Role name is required." });
    }

   
    const existingRole = await Role.findOne({ where: { role_name }, transaction: t });
    if (existingRole) {
      await t.rollback();
      return res.status(400).json({ message: "Role with this name already exists." });
    }

    
    const newRole = await Role.create({
      role_name,
      permissions: permissions || null,
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({
      message: "Role created successfully.",
      role: newRole,
    });

  } catch (err) {
    await t.rollback();
    console.error('createRole error:', err);
    return res.status(500).json({ message: "Internal server error", error: err });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    let { page, limit } = req.query;

    page = parseInt(page) || 1;  
    limit = parseInt(limit) || 10; 
    const offset = (page - 1) * limit;

    const { count, rows } = await Role.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      message: "Roles fetched successfully",
      roles: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    console.error('getAllRoles error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err });
  }
};


exports.getRoleById = async (req, res) => {
  try {
    const { roles_id } = req.params;
    const role = await Role.findOne({ where: { roles_id } });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    return res.status(200).json({ message: 'Role fetched successfully', role });
  } catch (err) {
    console.error('getRoleById error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err });
  }
};


exports.getAdminsByRole = async (req, res) => {
  try {
    const { roles_id } = req.params;
    let { page, limit } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const offset = (page - 1) * limit;

 
    const role = await Role.findOne({ where: { roles_id } });
    if (!role) return res.status(404).json({ message: 'Role not found' });

   
    const { count, rows } = await Admin.findAndCountAll({
      where: { admin_role: roles_id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      message: 'Admins fetched successfully',
      admins: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    console.error('getAdminsByRole error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err });
  }
};

exports.unassignAdminRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { admin_id } = req.params;
    const admin = await Admin.findOne({ where: { admin_id }, transaction: t });
    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: 'Admin not found' });
    }

    await admin.update({ admin_role: null }, { transaction: t });
    await t.commit();
    return res.status(200).json({ message: 'Admin unassigned from role successfully' });
  } catch (err) {
    await t.rollback();
    console.error('unassignAdminRole error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err });
  }
};

exports.updateRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { roles_id } = req.params;
    const { role_name, permissions } = req.body;

    if (!role_name && !permissions) {
      return res.status(400).json({ message: 'At least one field must be provided to update.' });
    }

    const role = await Role.findOne({ where: { roles_id }, transaction: t });
    if (!role) {
      await t.rollback();
      return res.status(404).json({ message: 'Role not found.' });
    }

    await role.update(
      {
        role_name: role_name || role.role_name,
        permissions: permissions !== undefined ? permissions : role.permissions,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(200).json({ message: 'Role updated successfully', role });
  } catch (err) {
    await t.rollback();
    console.error('updateRole error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err });
  }
};


exports.deleteRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { roles_id } = req.params;
    const role = await Role.findOne({ where: { roles_id }, transaction: t });
    if (!role) {
      await t.rollback();
      return res.status(404).json({ message: 'Role not found' });
    }

   
    await Admin.update({ admin_role: null }, { where: { admin_role: roles_id }, transaction: t });

    await role.destroy({ transaction: t });
    await t.commit();
    return res.status(200).json({ message: 'Role deleted successfully' });
  } catch (err) {
    await t.rollback();
    console.error('deleteRole error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err });
  }
};

