const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token." });
      }

      
      if (payload.admin_id) {
        req.user = {
          admin_id: payload.admin_id,
          email: payload.email,
          role: payload.role || null,
          userType: "admin",
        };
      }else {
        return res.status(401).json({ message: "Invalid token payload." });
      }

      next();
    });
  } catch (error) {
    console.error("Token authentication error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

module.exports = { authenticateToken };
