const { Admin, Role } = require("../models");

module.exports = (requiredPermissions) => async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (user.userType !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const admin = await Admin.findOne({
      where: { admin_id: user.admin_id },
      include: [
        {
          model: Role,
          attributes: ["role_name", "permissions"],
        },
      ],
    });

    if (!admin || !admin.Role) {
      return res.status(403).json({ message: "Admin role not found." });
    }

  
    let permissions = [];
    if (Array.isArray(admin.Role.permissions)) {
      permissions = admin.Role.permissions;
    } else if (typeof admin.Role.permissions === "string") {
      try {
        permissions = JSON.parse(admin.Role.permissions);
        if (!Array.isArray(permissions)) permissions = [];
      } catch {
        permissions = admin.Role.permissions.split(",").map((p) => p.trim());
      }
    }

  
    const required = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

   
    const missing = required.filter((perm) => !permissions.includes(perm));

    if (missing.length > 0) {
      return res.status(403).json({
        message: "Insufficient permissions.",
        missingPermissions: missing,
        userPermissions: permissions,
      });
    }

    return next();
  } catch (err) {
    console.error("Permission middleware error:", err);
    return res.status(500).json({ message: "Permission verification failed." });
  }
};
