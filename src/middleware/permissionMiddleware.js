const { Admin, Role } = require("../models");


module.exports = (requiredPermission) => async (req, res, next) => {
  try {
    const user = req.user; 

    if (!user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    
    if (user.userType === "admin") {
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

      const permissions =
        Array.isArray(admin.Role.permissions)
          ? admin.Role.permissions
          : typeof admin.Role.permissions === "string"
          ? admin.Role.permissions.split(",")
          : [];

      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({
          message: "Insufficient permissions.",
          required: requiredPermission,
          userPermissions: permissions,
        });
      }

      return next();
    }
    return res.status(403).json({ message: "Access denied." });
  } catch (error) {
    console.error("Permission middleware error:", error);
    return res.status(500).json({ message: "Permission verification failed." });
  }
};
