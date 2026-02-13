const { Admin, Role } = require("../models");


const requireSuperAdminForLoginAttempts = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Authentication required." });
    }

  
    const admin = await Admin.findOne({
      where: { admin_id: user.admin_id },
      include: [{
        model: Role,
        attributes: ["role_name"]
      }]
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

  
    if (admin.Role?.role_name !== "Super Admin") {
      return res.status(403).json({
        message: "Only Super Admins can manage login attempts.",
        requiredRole: "Super Admin",
        yourRole: admin.Role?.role_name || "Unknown"
      });
    }


    req.user.role = admin.Role?.role_name;

    next();
  } catch (error) {
    console.error("❌ Login attempt middleware error:", error);
    return res.status(500).json({ message: "Permission verification failed." });
  }
};

module.exports = { requireSuperAdminForLoginAttempts };