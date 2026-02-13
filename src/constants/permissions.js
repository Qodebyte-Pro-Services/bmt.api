const ADMIN_MANAGEMENT = {
  CREATE_ADMIN: 'create_admin',
  EDIT_ADMIN: 'edit_admin',
  DELETE_ADMIN: 'delete_admin',
  ASSIGN_ROLES: 'assign_roles', 
  VIEW_ADMIN_LOGS: 'view_admin_logs',
  MANAGE_ROLES_PERMISSIONS: 'manage_roles_permissions',
  CREATE_ROLE: 'create_role',
  REMOVE_ROLE: 'remove_role',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_REPORTS: 'manage_reports',
  VIEW_ADMINS: 'view_admins',
  VIEW_ADMIN_PROFILE: 'view_admin_profile',
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',
};

const PRODUCT_PERMISSIONS = {
  CREATE_PRODUCT: 'create_product',
  VIEW_PRODUCT: 'view_product',
  VIEW_PRODUCTS: 'view_products',
  UPDATE_PRODUCT: 'update_product',
  DELETE_PRODUCT: 'delete_product',
  MANAGE_VARIANTS: 'manage_variants',
  MANAGE_CATEGORIES: 'manage_categories',
  MANAGE_ATTRIBUTES: 'manage_attributes',
  CREATE_PRODUCT_CATEGORIES: 'create_product_categories',
  VIEW_PRODUCT_CATEGORIES: 'view_product_categories',
  UPDATE_PRODUCT_CATEGORIES: 'update_product_categories',
  DELETE_PRODUCT_CATEGORIES: 'delete_product_categories',
  CREATE_PRODUCT_ATTRIBUTES: 'create_product_attributes',
  CREATE_ATTRIBUTE_AND_VALUES: 'create_attribute_and_values',
  CREATE_ATTRIBUTE_VALUES: 'create_attribute_values',
  VIEW_PRODUCT_ATTRIBUTES: 'view_product_attributes',
  UPDATE_PRODUCT_ATTRIBUTES: 'update_product_attributes',
  DELETE_PRODUCT_ATTRIBUTES: 'delete_product_attributes',
  DELETE_ATTRIBUTE_VALUES: 'delete_attribute_values',
  CREATE_PRODUCT_VARIANTS: 'create_product_variants',
  VIEW_PRODUCT_VARIANTS: 'view_product_variants',
  UPDATE_PRODUCT_VARIANTS: 'update_product_variants',
  DELETE_PRODUCT_VARIANTS: 'delete_product_variants',
};

const SALES_PERMISSIONS = {
  CREATE_SALE: 'create_sale',
  VIEW_SALES: 'view_sales',
  MANAGE_ORDERS: 'manage_orders',
  DELETE_ORDERS: 'delete_orders',
  VIEW_ORDERS: 'view_orders',
  CREATE_ORDER: 'create_order',
  VIEW_ANALYTICS: 'view_analytics',
};

const DISCOUNT_PERMISSIONS = {
  CREATE_DISCOUNT: 'create_discount',
  VIEW_DISCOUNTS: 'view_discounts',
  UPDATE_DISCOUNT: 'update_discount',
  DELETE_DISCOUNT: 'delete_discount',
  LINK_DISCOUNT: 'link_discount',
};

const TAX_PERMISSIONS = {
  CREATE_TAX: 'create_tax',
  VIEW_TAXES: 'view_taxes',
  UPDATE_TAX: 'update_tax',
  DELETE_TAX: 'delete_tax',
};

const STAFF_PERMISSIONS = {
  CREATE_STAFF: 'create_staff',
  VIEW_STAFF: 'view_staff',
  UPDATE_STAFF: 'update_staff',
  DELETE_STAFF: 'delete_staff',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_ROLES: 'manage_roles',
  VIEW_ROLES: 'view_roles',
  VIEW_LOGIN_HISTORY: 'view_login_history',
};

const CUSTOMER_PERMISSIONS = {
  CREATE_CUSTOMER: 'create_customer',
  VIEW_CUSTOMER: 'view_customer',
  UPDATE_CUSTOMER: 'update_customer',
  DELETE_CUSTOMER: 'delete_customer',
  VIEW_CUSTOMER_HISTORY: 'view_customer_history',
};

const FINANCIAL_PERMISSIONS = {
  CREATE_EXPENSE_CATEGORY: 'create_expense_category',
  VIEW_EXPENSE_CATEGORY: 'view_expense_category',
  UPDATE_EXPENSE_CATEGORY: 'update_expense_category',
  DELETE_EXPENSE_CATEGORY: 'delete_expense_category',
  CREATE_EXPENSE: 'create_expense',
  VIEW_EXPENSES: 'view_expenses',
  UPDATE_EXPENSE: 'update_expense',
  DELETE_EXPENSE: 'delete_expense',
  APPROVE_EXPENSE: 'approve_expense',
  REJECT_EXPENSE: 'reject_expense',
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',
};

const INVENTORY_MGT_PERMISSIONS = {
  VIEW_INVENTORY: 'view_inventory',
  ADJUST_INVENTORY: 'adjust_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
};

const LOGIN_ATTEMPT_PERMISSIONS = {
  VIEW_LOGIN_ATTEMPTS: 'view_login_attempts',
  APPROVE_LOGIN_ATTEMPT: 'approve_login_attempt',
  REJECT_LOGIN_ATTEMPT: 'reject_login_attempt',
  MANAGE_LOGIN_ATTEMPTS: 'manage_login_attempts',
};

const CATEGORY_ATTRIBUTE_PERMISSIONS = {
  MANAGE_CATEGORIES: 'manage_categories',
  MANAGE_ATTRIBUTES: 'manage_attributes',
}

const ALL_PERMISSIONS = {
  ...ADMIN_MANAGEMENT,
  ...SALES_PERMISSIONS,
  ...PRODUCT_PERMISSIONS,
  ...STAFF_PERMISSIONS,
  ...CUSTOMER_PERMISSIONS,
  ...FINANCIAL_PERMISSIONS,
  ...INVENTORY_MGT_PERMISSIONS,
  ...LOGIN_ATTEMPT_PERMISSIONS,
  ...DISCOUNT_PERMISSIONS,
  ...TAX_PERMISSIONS,
  ...CATEGORY_ATTRIBUTE_PERMISSIONS,
};

module.exports = {
  ALL_PERMISSIONS,
  ADMIN_MANAGEMENT,
  SALES_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  STAFF_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  FINANCIAL_PERMISSIONS,
  INVENTORY_MGT_PERMISSIONS,
  LOGIN_ATTEMPT_PERMISSIONS,
  DISCOUNT_PERMISSIONS,
  TAX_PERMISSIONS,
  CATEGORY_ATTRIBUTE_PERMISSIONS,
};