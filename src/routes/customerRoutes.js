const express = require("express");
const router = express.Router();
const CustomerController = require("../controllers/customerController");
const {requirePermission} = require("../utils/routeHelper");
const {CUSTOMER_PERMISSIONS} = require("../constants/permissions");


router.post("/",  ...requirePermission(CUSTOMER_PERMISSIONS.CREATE_CUSTOMER), CustomerController.addCustomer);
router.get("/",  ...requirePermission(CUSTOMER_PERMISSIONS.VIEW_CUSTOMER), CustomerController.listCustomers);
router.get('/:id/transactions', ...requirePermission(CUSTOMER_PERMISSIONS.VIEW_CUSTOMER_HISTORY), CustomerController.getCustomerTransactions);
router.get("/:id",  ...requirePermission(CUSTOMER_PERMISSIONS.VIEW_CUSTOMER), CustomerController.getCustomer);
router.patch("/",  ...requirePermission(CUSTOMER_PERMISSIONS.UPDATE_CUSTOMER), CustomerController.updateCustomer);
router.delete("/:id", ...requirePermission(CUSTOMER_PERMISSIONS.DELETE_CUSTOMER), CustomerController.deleteCustomer);

module.exports = router;