const express = require("express");
const router = express.Router();
const RoleController = require("../controllers/roleController");
const { requirePermission } = require("../utils/routeHelper");
const { ADMIN_MANAGEMENT } = require("../constants/permissions");


/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role and admin management
 */

/**
 * @swagger
 * /roles/create-role:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               permissions:
 *                 type: object
 *                 additionalProperties: true
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 role:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Role name missing or already exists
 *       429:
 *         description: Too many attempts
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /roles/:
 *   get:
 *     summary: Get all roles with pagination
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /roles/{roles_id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roles_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Role fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 role:
 *                   $ref: '#/components/schemas/Role'
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /roles/admins/{roles_id}:
 *   get:
 *     summary: Get all admins assigned to a specific role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roles_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Admins fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 admins:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /roles/unassign-role/{admin_id}:
 *   post:
 *     summary: Unassign a role from an admin
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: admin_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Admin unassigned from role successfully
 *       404:
 *         description: Admin not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /roles/{roles_id}:
 *   patch:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roles_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               permissions:
 *                 type: object
 *                 additionalProperties: true
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 role:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: No fields provided for update
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /roles/{roles_id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roles_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */



router.post("/create-role", ...requirePermission(ADMIN_MANAGEMENT.CREATE_ROLE), RoleController.createRole);
router.get("/", ...requirePermission(ADMIN_MANAGEMENT.MANAGE_ROLES), RoleController.getAllRoles);
router.post("/unassign-role/:admin_id", ...requirePermission(ADMIN_MANAGEMENT.MANAGE_ROLES), RoleController.unassignAdminRole);
router.get("/admins/:roles_id", ...requirePermission(ADMIN_MANAGEMENT.MANAGE_ROLES), RoleController.getAdminsByRole);
router.get("/:roles_id", ...requirePermission(ADMIN_MANAGEMENT.MANAGE_ROLES), RoleController.getRoleById);
router.patch("/:roles_id", ...requirePermission(ADMIN_MANAGEMENT.MANAGE_ROLES), RoleController.updateRole);
router.delete("/:roles_id", ...requirePermission(ADMIN_MANAGEMENT.REMOVE_ROLE), RoleController.deleteRole);

module.exports = router; 