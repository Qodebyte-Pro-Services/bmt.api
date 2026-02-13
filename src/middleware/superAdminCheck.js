const { Admin, Role } = require("../models");

const requireSuperAdminForLoginAttempts = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const admin = await Admin.findOne({
      where: { admin_id: req.user.admin_id },
      include: [{
        model: Role,
        attributes: ["role_name"]
      }]
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const role = admin.Role?.role_name?.toUpperCase();

    if (!["SUPER ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({
        message: "Only Super Admins or Developers can manage login attempts.",
        requiredRole: "Super Admin or Developer",
        yourRole: admin.Role?.role_name || "Unknown"
      });
    }

  
    req.user.dbRole = admin.Role.role_name;

    next();
  } catch (error) {
    console.error("❌ Login attempt middleware error:", error);
    return res.status(500).json({ message: "Permission verification failed." });
  }
};

module.exports = { requireSuperAdminForLoginAttempts };
