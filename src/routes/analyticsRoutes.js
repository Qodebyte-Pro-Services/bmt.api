const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requirePermission } = require('../utils/routeHelper');
const {
  SALES_PERMISSIONS,
  ADMIN_MANAGEMENT,
  FINANCIAL_PERMISSIONS,
  INVENTORY_MGT_PERMISSIONS
} = require('../constants/permissions');

router.get(
  '/dashboard-kpi',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getDashboardKPI
);

router.get(
  '/income-vs-expense',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getIncomeVsExpenseChart
);

router.get(
  '/stock-alerts',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getStockAlerts
);

router.get(
  '/fast-selling-variants',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getFastSellingVariants
);

router.get(
  '/due-installments',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getRecentDueInstallments
);

router.get(
  '/credit-installment-sales',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getCreditInstallmentSales
);

router.get(
  '/inventory-kpi',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getInventoryKPI
);

router.get(
  '/stock-movement-flow',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getAllStockMovementFlow
);

router.get(
  '/stock-movement-flow/:variant_id',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getStockMovementFlow
);

router.get(
  '/product-stock-movement/:product_id',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getProductStockMovementFlow
);

router.get(
  '/stock-distribution',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getStockDistribution
);

router.get(
  '/stock-by-category',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  analyticsController.getStockByCategory
);

router.get(
  '/sales-kpi',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.salesKpi
);

router.get(
  '/payment-methods',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getPaymentMethodAnalytics
);

router.get(
  '/sales-overtime',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getSalesOvertime
);

router.get(
  '/purchase-type-distribution',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getPurchaseTypeDistribution
);

router.get(
  '/top-selling-variants',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getTopSellingVariants
);

router.get(
  '/recent-approved-expenses',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  analyticsController.getRecentApprovedExpenses
);

router.get(
  '/expense-by-category',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  analyticsController.getExpenseByCategory
);

router.get(
  '/expense-kpi',
  ...requirePermission(FINANCIAL_PERMISSIONS.VIEW_EXPENSES),
  analyticsController.getExpenseKPI
);

router.get(
  '/customers-with-payment-methods',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getCustomersWithPaymentMethods
);

router.get(
  '/admin-count',
  ...requirePermission(ADMIN_MANAGEMENT.VIEW_ADMINS),
  analyticsController.getAdminCount
);

router.get(
  '/customer-kpi',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getCustomerKPI
);

module.exports = router;