
const express = require('express');
const router = express.Router();
const authController = require('../controllers/adminAuth');
const { ADMIN_MANAGEMENT } = require('../constants/permissions');
const { requirePermission, requireAuth } = require('../utils/routeHelper');
const { requireSuperAdminForLoginAttempts } = require('../middleware/superAdminCheck');
const { LOGIN_ATTEMPT_PERMISSIONS } = require('../constants/permissions');
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management and authentication
 */


router.post('/create', authController.AdminRegister);

router.post('/login', authController.login);

router.post('/resend-otp', authController.resendAdminOtp);

router.post('/verify', authController.verifyAdminOtp);

router.post('/verify-approved-login', authController.verifyApprovedLoginOtp);

router.post('/reset-password', authController.resetAdminPassword);

router.post('/forgot-password', authController.forgotAdminPassword);

router.post('/add-admin', 
  ...requirePermission(ADMIN_MANAGEMENT.CREATE_ADMIN), 
  authController.addAdmin
);

router.post('/login-attempts/:id/approve', 
  ...requirePermission(LOGIN_ATTEMPT_PERMISSIONS.APPROVE_LOGIN_ATTEMPT),
  requireSuperAdminForLoginAttempts,
  authController.approveLoginAttempt
);

router.post('/login-attempts/:id/reject', 
  ...requirePermission(LOGIN_ATTEMPT_PERMISSIONS.REJECT_LOGIN_ATTEMPT),
  requireSuperAdminForLoginAttempts,
  authController.rejectLoginAttempt
);




router.get('/login-attempts', 
  ...requirePermission(LOGIN_ATTEMPT_PERMISSIONS.VIEW_LOGIN_ATTEMPTS),
  requireSuperAdminForLoginAttempts,
  authController.getLoginAttempts
);

router.get("/", ...requirePermission(ADMIN_MANAGEMENT.VIEW_ADMINS), authController.getAdmins);

router.get('/mini-admin-list', ...requirePermission(ADMIN_MANAGEMENT.VIEW_ADMINS), authController.getMiniAdminData);

router.get("/:admin_id", ...requireAuth(), authController.getAdminById);


router.put("/edit", ...requirePermission(ADMIN_MANAGEMENT.EDIT_ADMIN), authController.updateAdminById);

router.put("/profile", ...requireAuth(), authController.updateAdmin);

router.put("/credentials", ...requirePermission(ADMIN_MANAGEMENT.EDIT_ADMIN), authController.changeAdminPasswordById);

router.put("/password", ...requireAuth(), authController.changeAdminPassword); 

router.delete("/:admin_id", ...requireAuth(), authController.deleteAdmin);

module.exports = router;
