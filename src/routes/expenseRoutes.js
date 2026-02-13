const express = require('express');
const router = express.Router();
const ExpenseCategoryController = require('../controllers/ExpenseCategoryController');
const ExpenseController = require('../controllers/ExpenseController');
const { requirePermission} = require('../utils/routeHelper');
const { FINANCIAL_PERMISSIONS } = require('../constants/permissions');
const { upload } = require('../utils/uploads');


router.post(
  '/',
  ...requirePermission(FINANCIAL_PERMISSIONS.CREATE_EXPENSE),
  upload.single('expense_reciept_url'),
  ExpenseController.createExpense
);


router.post(
  '/categories',
  ...requirePermission(FINANCIAL_PERMISSIONS.CREATE_EXPENSE_CATEGORY),
  ExpenseCategoryController.createExpenseCategory
);




router.get(
  '/categories',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSE_CATEGORY),
  ExpenseCategoryController.getAllExpenseCategories
);

router.get(
  '/',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  ExpenseController.getAllExpenses
);

router.get(
  '/categories/:expense_category_id',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSE_CATEGORY),
  ExpenseCategoryController.getExpensesONCategory
);

router.get(
  '/status/pending',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  ExpenseController.getPendingExpenses
);

router.get(
  '/status/approved',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  ExpenseController.getApprovedExpenses
);
router.get(
  '/status/rejected',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  ExpenseController.getRejectedExpenses
);

router.get(
  '/admin/:admin_id',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  ExpenseController.getExpenseByAdminId
);

router.get(
  '/:id',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  ExpenseController.getExpenseById
);

router.put(
  '/categories/:expense_category_id',
  ...requirePermission(FINANCIAL_PERMISSIONS.UPDATE_EXPENSE_CATEGORY),
  ExpenseCategoryController.UpdateExpenseCategory
);

router.put(
  '/:id/status',
  ...requirePermission(FINANCIAL_PERMISSIONS.APPROVE_EXPENSE),
  ExpenseController.updateExpenseStatus
);

router.delete(
  '/categories/:expense_category_id',
  ...requirePermission(FINANCIAL_PERMISSIONS.DELETE_EXPENSE_CATEGORY),
  ExpenseCategoryController.deleteExpenseCategory
);

router.put(
  '/:id/status',
  ...requirePermission(FINANCIAL_PERMISSIONS.APPROVE_EXPENSE),
  ExpenseController.updateExpenseStatus
);

module.exports = router;