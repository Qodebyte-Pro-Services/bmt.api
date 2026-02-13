const { authenticateToken } = require("../middleware/authorization");
const permissionMiddleware = require("../middleware/permissionMiddleware");


const requirePermission = (permission) => [
  authenticateToken,
  permissionMiddleware(permission),
];

const requireAuthOnly = () => [authenticateToken];

const requireAuth = requireAuthOnly;
const requirePermissionOnly = requirePermission;

module.exports = {
  requirePermission,
  requirePermissionOnly,
  requireAuth,
  requireAuthOnly,
};
