const express = require("express");
const { upload } = require("../utils/uploads");
const  settingsController  = require("../controllers/settingsController");
const { requirePermission } = require("../utils/routeHelper");
const { ADMIN_MANAGEMENT } = require("../constants/permissions");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Admin settings management
 */

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get current settings
 *     tags: [Settings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   $ref: '#/components/schemas/Settings'
 *       404:
 *         description: Settings not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /settings:
 *   put:
 *     summary: Update site settings (Super Admin only)
 *     tags: [Settings]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               site_name:
 *                 type: string
 *               site_logo:
 *                 type: string
 *                 format: binary
 *               removeLogo:
 *                 type: boolean
 *                 description: Set true to remove the existing logo
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 settings:
 *                   $ref: '#/components/schemas/Settings'
 *       403:
 *         description: Forbidden, only Super Admin can update settings
 *       500:
 *         description: Internal server error
 */
router.get("/", ...requirePermission(ADMIN_MANAGEMENT.VIEW_SETTINGS), settingsController.getSettings);
router.put("/", ...requirePermission(ADMIN_MANAGEMENT.EDIT_SETTINGS), upload.single("site_logo"), settingsController.updateSettings);
module.exports = router;