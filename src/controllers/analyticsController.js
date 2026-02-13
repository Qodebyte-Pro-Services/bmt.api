
const { Order, Expense, Variant, Product, Category, OrderItem, InstallmentPlan, Customer, InstallmentPayment, CreditAccount, Admin, OrderPayment, Role, InventoryLog, ExpenseCategory } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { getDateRange, getHourlyBreakdown, getDailyBreakdown, getStatusInfo,  calculateGrowth, getInstallmentStatus, getPaymentMethodInfo, getStockAtDate, getHourlyStockMovement, getDailyStockMovement, getWeeklyStockMovement,getStockStatus  } = require('../utils/analtyicsHelper');


const generateHourlyData = (orders, startDate, endDate) => {
  const hourlyData = {};
  
  for (let i = 0; i < 24; i++) {
    hourlyData[i] = { amount: 0, count: 0 };
  }
  
  orders.forEach(order => {
    const hour = new Date(order.createdAt).getHours();
    hourlyData[hour].amount += parseFloat(order.total_amount || 0);
    hourlyData[hour].count += 1;
  });
  
  const result = [];
  for (let i = 0; i < 24; i++) {
    result.push({
      time: `${i.toString().padStart(2, '0')}:00`,
      amount: parseFloat(hourlyData[i].amount.toFixed(2)),
      count: hourlyData[i].count
    });
  }
  return result;
};

const generateDailyData = (orders, startDate, endDate) => {
  const dailyData = {};
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    dailyData[dateKey] = { amount: 0, count: 0 };
    current.setDate(current.getDate() + 1);
  }
  
  orders.forEach(order => {
    const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
    if (dailyData[dateKey]) {
      dailyData[dateKey].amount += parseFloat(order.total_amount || 0);
      dailyData[dateKey].count += 1;
    }
  });
  
  const result = [];
  Object.keys(dailyData).sort().forEach(date => {
    result.push({
      time: date,
      amount: parseFloat(dailyData[date].amount.toFixed(2)),
      count: dailyData[date].count
    });
  });
  return result;
};

const generateWeeklyData = (orders, startDate, endDate) => {
  const weeklyData = {};
  const current = new Date(startDate);
  current.setDate(current.getDate() - current.getDay());
  
  while (current <= endDate) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekKey = `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`;
    weeklyData[weekKey] = { amount: 0, count: 0 };
    current.setDate(current.getDate() + 7);
  }
  
  orders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    const weekStart = new Date(orderDate);
    weekStart.setDate(orderDate.getDate() - orderDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekKey = `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`;
    
    if (weeklyData[weekKey]) {
      weeklyData[weekKey].amount += parseFloat(order.total_amount || 0);
      weeklyData[weekKey].count += 1;
    }
  });
  
  const result = [];
  Object.keys(weeklyData).sort().forEach(week => {
    result.push({
      time: week,
      amount: parseFloat(weeklyData[week].amount.toFixed(2)),
      count: weeklyData[week].count
    });
  });
  return result;
};

const generateMonthlyData = (orders, startDate, endDate) => {
  const monthlyData = {};
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  
  while (current <= endDate) {
    const monthKey = current.toISOString().split('T')[0].substring(0, 7);
    monthlyData[monthKey] = { amount: 0, count: 0 };
    current.setMonth(current.getMonth() + 1);
  }
  
  orders.forEach(order => {
    const monthKey = new Date(order.createdAt).toISOString().split('T')[0].substring(0, 7);
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].amount += parseFloat(order.total_amount || 0);
      monthlyData[monthKey].count += 1;
    }
  });
  
  const result = [];
  Object.keys(monthlyData).sort().forEach(month => {
    result.push({
      time: month,
      amount: parseFloat(monthlyData[month].amount.toFixed(2)),
      count: monthlyData[month].count
    });
  });
  return result;
};





exports.getDashboardKPI = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date } = req.query;

    
    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

   
    const { start, end } = getDateRange(filter, start_date, end_date);


    const orderWhere = {
      status: 'completed',
      createdAt: { [Op.between]: [start, end] }
    };

    
    const expenseWhere = {
      status: 'approved',
      date: { [Op.between]: [start, end] }
    };

    
    const salesMetrics = await Order.findOne({
      where: orderWhere,
      attributes: [
        [fn('COUNT', col('id')), 'total_transactions'],
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'total_sales']
      ],
      raw: true
    });

const salesCount = parseInt(salesMetrics?.total_transactions || 0);
const totalSales = parseFloat(salesMetrics?.total_sales || 0);
    
const approvedExpensesMetrics = await Expense.findOne({
  where: expenseWhere,
  attributes: [
    [fn('COALESCE', fn('SUM', col('expense_amount')), 0), 'approved_expense']
  ],
  raw: true
});

const approvedExpense = parseFloat(approvedExpensesMetrics?.approved_expense || 0);

const totalExpense = approvedExpense;

    
    const netProfit = totalSales - approvedExpense;

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      kpi: {
        total_transactions: salesCount,
        total_sales: parseFloat(totalSales.toFixed(2)),
        total_expense: parseFloat(totalExpense.toFixed(2)),
        approved_expense: parseFloat(approvedExpense.toFixed(2)),
        net_profit: parseFloat(netProfit.toFixed(2))
      }
    });

  } catch (error) {
    console.error('❌ getDashboardKPI error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch KPI metrics', 
      details: error.message 
    });
  }
};

exports.getIncomeVsExpenseChart = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date } = req.query;

   
    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(filter, start_date, end_date);

    let chartData = [];

 
    if (filter === 'today' || filter === 'yesterday') {
      chartData = await getHourlyBreakdown(start, end);
    }
 
    else if (filter === 'last7') {
      chartData = await getDailyBreakdown(start, end);
    }
  
    else if (filter === 'thisMonth' || filter === 'lastMonth') {
      chartData = await getDailyBreakdown(start, end);
    }
   
    else if (filter === 'custom') {
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 2) {
        chartData = await getHourlyBreakdown(start, end);
      } else {
        chartData = await getDailyBreakdown(start, end);
      }
    }

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      chart_data: chartData
    });

  } catch (error) {
    console.error('❌ getIncomeVsExpenseChart error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch chart data', 
      details: error.message 
    });
  }
};


exports.getStockAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, filter = 'all', sort = 'priority' } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

 
    const variants = await Variant.findAll({
      where: { is_active: true },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'category_id', 'threshold'],
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        }
      ],
      attributes: ['id', 'product_id', 'sku', 'quantity', 'threshold', 'image_url'],
      raw: false
    });

 
    let alerts = variants.map(v => {
      const threshold = v.threshold || v.product?.threshold || 10;
      const currentQty = v.quantity || 0;
      const status = getStockStatus(currentQty, threshold);
      const statusInfo = getStatusInfo(status);

      return {
        id: v.id,
        name: v.sku,
        current: currentQty,
        min: threshold,
        status: statusInfo.display,
        image: Array.isArray(v.image_url) && v.image_url.length > 0
          ? v.image_url[0].url || v.image_url[0]
          : null
      };
    });


    if (filter === 'low_stock') alerts = alerts.filter(a => a.status === 'warning');
    else if (filter === 'out_of_stock') alerts = alerts.filter(a => a.status === 'critical');

    // Sort alerts
    if (sort === 'priority') alerts.sort((a, b) => {
      const priority = { critical: 2, warning: 1, normal: 0 };
      return (priority[b.status] || 0) - (priority[a.status] || 0);
    });
    else if (sort === 'qty') alerts.sort((a, b) => a.current - b.current);
    else if (sort === 'name') alerts.sort((a, b) => a.name.localeCompare(b.name));

   
    const paginatedAlerts = alerts.slice(offset, offset + limitNum);

    return res.status(200).json({
      success: true,
      alerts: paginatedAlerts,
      pagination: {
        total: alerts.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(alerts.length / limitNum)
      },
      summary: {
        total_alerts: alerts.length,
        out_of_stock_count: alerts.filter(a => a.status === 'critical').length,
        low_stock_count: alerts.filter(a => a.status === 'warning').length
      }
    });
  } catch (error) {
    console.error('❌ getStockAlerts error:', error);
    return res.status(500).json({
      error: 'Failed to fetch stock alerts',
      details: error.message
    });
  }
};

exports.getFastSellingVariants = async (req, res) => {
  try {
    const { limit = 5, period = 'this_month', compare_period = 'previous' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 5, 50);

    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

   
    switch (period) {
      case 'today':
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        previousStart = new Date(currentStart);
        previousStart.setDate(currentStart.getDate() - 1);
        previousEnd = new Date(previousStart);
        previousEnd.setHours(23, 59, 59, 999);
        break;

      case 'this_week':
        currentStart = new Date(now);
        currentStart.setDate(now.getDate() - now.getDay());
        currentStart.setHours(0, 0, 0, 0);
        currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 6);
        currentEnd.setHours(23, 59, 59, 999);
        previousStart = new Date(currentStart);
        previousStart.setDate(currentStart.getDate() - 7);
        previousEnd = new Date(previousStart);
        previousEnd.setDate(previousStart.getDate() + 6);
        previousEnd.setHours(23, 59, 59, 999);
        break;

      case 'this_month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;

      case 'this_year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;

      case 'all':
      default:
        currentStart = new Date('2000-01-01');
        currentEnd = now;
        previousStart = new Date('2000-01-01');
        previousEnd = new Date('2000-01-01');
        break;
    }

   
    const currentSales = await OrderItem.findAll({
      attributes: [
        'variant_id',
        [fn('SUM', col('quantity')), 'total_sold'],
        [fn('COALESCE', fn('SUM', col('total_price')), 0), 'total_revenue']
      ],
      include: [
        {
          model: Order,
          where: {
            status: 'completed',
            createdAt: { [Op.between]: [currentStart, currentEnd] }
          },
          attributes: [],
          required: true
        }
      ],
      group: ['variant_id'],
      subQuery: false,
      raw: true,
      order: [[literal('total_sold'), 'DESC']],
      limit: limitNum
    });

    if (currentSales.length === 0) {
      return res.status(200).json({
        success: true,
        period,
        top_selling_variants: [],
        summary: {
          total_variants: 0,
          total_sold: 0,
          total_revenue: 0,
          average_revenue_per_variant: 0
        }
      });
    }

    
    const variantIds = currentSales.map(s => s.variant_id);

    const variants = await Variant.findAll({
      where: { id: variantIds },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'category_id'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

  
    const variantMap = new Map(variants.map(v => [v.id, v]));


    let previousSalesMap = new Map();
    if (period !== 'all' && compare_period === 'previous') {
      const previousSales = await OrderItem.findAll({
        attributes: [
          'variant_id',
          [fn('SUM', col('quantity')), 'total_sold']
        ],
        include: [
          {
            model: Order,
            where: {
              status: 'completed',
              createdAt: { [Op.between]: [previousStart, previousEnd] }
            },
            attributes: [],
            required: true
          }
        ],
        where: { variant_id: variantIds },
        group: ['variant_id'],
        subQuery: false,
        raw: true
      });

      previousSalesMap = new Map(
        previousSales.map(s => [s.variant_id, parseInt(s.total_sold, 10)])
      );
    }

   
    const topSellingVariants = currentSales.map(sale => {
      const variant = variantMap.get(sale.variant_id);
      if (!variant) return null;

      const currentSold = parseInt(sale.total_sold, 10);
      const previousSold = previousSalesMap.get(sale.variant_id) || 0;
      const growthObj = calculateGrowth(currentSold, previousSold);
            

   
      const revenue = parseFloat(sale.total_revenue || 0);
      const formattedRevenue = `NGN ${revenue.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;

      return {
        variant_id: variant.id,
        sku: variant.sku,
        total_sold: currentSold,
        total_revenue: revenue,
        revenue_formatted: formattedRevenue,
        growth: growthObj.formatted,
        growth_percentage: growthObj.value,
        product: {
          id: variant.product?.id,
          name: variant.product?.name,
          brand: variant.product?.brand,
          category: {
            id: variant.product?.category?.id,
            name: variant.product?.category?.name
          }
        },
        variant_details: {
          attributes: variant.attributes,
          cost_price: parseFloat(variant.cost_price),
          selling_price: parseFloat(variant.selling_price),
          threshold: variant.threshold,
          current_stock: variant.quantity,
          is_active: variant.is_active
        },
        image_url: Array.isArray(variant.image_url) && variant.image_url.length > 0
          ? variant.image_url[0].url || variant.image_url[0]
          : null,
        images: Array.isArray(variant.image_url) ? variant.image_url : [],
        profit_per_unit: parseFloat(variant.selling_price) - parseFloat(variant.cost_price),
        total_profit: (parseFloat(variant.selling_price) - parseFloat(variant.cost_price)) * currentSold
      };
    }).filter(item => item !== null);

   
    const totalSold = topSellingVariants.reduce((sum, v) => sum + v.total_sold, 0);
    const totalRevenue = topSellingVariants.reduce((sum, v) => sum + v.total_revenue, 0);

    return res.status(200).json({
      success: true,
      period,
      compare_period,
      date_range: {
        start: currentStart,
        end: currentEnd
      },
      top_selling_variants: topSellingVariants,
      summary: {
        total_variants: topSellingVariants.length,
        total_sold: totalSold,
        total_revenue: totalRevenue,
        average_revenue_per_variant: topSellingVariants.length > 0
          ? (totalRevenue / topSellingVariants.length).toFixed(2)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ getFastSellingVariants error:', error);
    return res.status(500).json({
      error: 'Failed to fetch fast selling variants',
      details: error.message
    });
  }
};

exports.getRecentDueInstallments = async (req, res) => {
  try {
    const { days = 30, page = 1, limit = 20, filter = 'all', sort = 'due_date' } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;
    const daysAhead = Math.max(parseInt(days, 10) || 30, 1);

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

   
    const plans = await InstallmentPlan.findAll({
      where: {
        status: { [Op.in]: ['active'] }
      },
      include: [
        {
          model: Customer,
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Order,
          attributes: ['id', 'total_amount', 'createdAt']
        },
        {
          model: InstallmentPayment,
          as: 'InstallmentPayments',
          attributes: ['id', 'payment_number', 'amount', 'due_date', 'status', 'paid_at'],
          order: [['payment_number', 'ASC']]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    
    let dueInstallments = [];

    plans.forEach(plan => {
      const pendingPayments = plan.InstallmentPayments.filter(p => p.status === 'pending');

      pendingPayments.forEach(payment => {
        const dueDate = new Date(payment.due_date);
        const isOverdue = dueDate < now;
        const isDueSoon = dueDate >= now && dueDate <= futureDate;

       
        if (filter === 'overdue' && !isOverdue) return;
        if (filter === 'due_soon' && !isDueSoon) return;

        const statusInfo = getInstallmentStatus(plan);

        dueInstallments.push({
          plan_id: plan.id,
          order_id: plan.order_id,
          customer: {
            id: plan.Customer?.id,
            name: plan.Customer?.name,
            email: plan.Customer?.email,
            phone: plan.Customer?.phone
          },
          payment_details: {
            payment_number: payment.payment_number,
            total_payments: plan.number_of_payments,
            amount_due: parseFloat(payment.amount),
            due_date: payment.due_date,
            days_until_due: Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)),
            is_overdue: isOverdue
          },
          plan_details: {
            total_amount: parseFloat(plan.total_amount),
            down_payment: parseFloat(plan.down_payment),
            remaining_balance: parseFloat(plan.remaining_balance),
            payment_frequency: plan.payment_frequency,
            start_date: plan.start_date,
            status: statusInfo.status,
            status_label: statusInfo.label,
            status_color: statusInfo.color,
            status_icon: statusInfo.icon,
            priority: statusInfo.priority
          },
          progress: {
            payments_completed: plan.InstallmentPayments.filter(p => p.status === 'paid').length,
            total_payments: plan.number_of_payments,
            completion_percentage: Math.round(
              (plan.InstallmentPayments.filter(p => p.status === 'paid').length / plan.number_of_payments) * 100
            )
          }
        });
      });
    });

  
    if (sort === 'due_date') {
      dueInstallments.sort((a, b) => {
       
        const aIsOverdue = a.payment_details.is_overdue ? 0 : 1;
        const bIsOverdue = b.payment_details.is_overdue ? 0 : 1;
        if (aIsOverdue !== bIsOverdue) return aIsOverdue - bIsOverdue;
        return new Date(a.payment_details.due_date) - new Date(b.payment_details.due_date);
      });
    } else if (sort === 'amount') {
      dueInstallments.sort((a, b) => b.payment_details.amount_due - a.payment_details.amount_due);
    } else if (sort === 'customer') {
      dueInstallments.sort((a, b) => a.customer.name.localeCompare(b.customer.name));
    }

   
    const paginatedData = dueInstallments.slice(offset, offset + limitNum);

  
    const totalDueAmount = dueInstallments.reduce((sum, item) => sum + item.payment_details.amount_due, 0);
    const overdueCount = dueInstallments.filter(item => item.payment_details.is_overdue).length;
    const dueSoonCount = dueInstallments.filter(item => !item.payment_details.is_overdue).length;

    return res.status(200).json({
      success: true,
      filter,
      look_ahead_days: daysAhead,
      due_installments: paginatedData,
      pagination: {
        total: dueInstallments.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(dueInstallments.length / limitNum)
      },
      summary: {
        total_due_installments: dueInstallments.length,
        total_amount_due: parseFloat(totalDueAmount.toFixed(2)),
        overdue_count: overdueCount,
        due_soon_count: dueSoonCount,
        overdue_amount: parseFloat(
          dueInstallments
            .filter(item => item.payment_details.is_overdue)
            .reduce((sum, item) => sum + item.payment_details.amount_due, 0)
            .toFixed(2)
        )
      }
    });

  } catch (error) {
    console.error('❌ getRecentDueInstallments error:', error);
    return res.status(500).json({
      error: 'Failed to fetch due installments',
      details: error.message
    });
  }
};

exports.getCreditInstallmentSales = async (req, res) => {
  try {
    const { method = 'both', page = 1, limit = 20, period = 'all', sort = 'date' } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    const now = new Date();
    let dateWhere = {};

   
    switch (period) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        dateWhere.created_at = { [Op.between]: [todayStart, todayEnd] };
        break;
      case 'this_week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        dateWhere.created_at = { [Op.between]: [weekStart, weekEnd] };
        break;
      case 'this_month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        dateWhere.created_at = { [Op.between]: [monthStart, monthEnd] };
        break;
      case 'all':
      default:
        break;
    }

    let orders = [];

 
    if (method === 'credit' || method === 'both') {
      const creditOrders = await Order.findAll({
        where: {
          id: {
            [Op.in]: (await CreditAccount.findAll({
              attributes: ['order_id'],
              raw: true
            })).map(ca => ca.order_id)
          },
          status: 'completed',
          ...dateWhere
        },
        include: [
          {
            model: Customer,
            attributes: ['id', 'name', 'email', 'phone']
          },
          {
            model: Admin,
            as: 'admin',
            attributes: ['admin_id', 'full_name', 'email']
          },
          {
            model: CreditAccount,
            as: 'credit_account',
            attributes: ['id', 'credit_type', 'amount_paid', 'balance', 'issued_at']
          },
          {
            model: OrderItem,
            attributes: ['id', 'quantity', 'unit_price', 'total_price'],
            include: [
              {
                model: Variant,
                as: 'variant',
                attributes: ['id', 'sku', 'product_id'],
                include: [
                  {
                    model: Product,
                    as: 'product',
                    attributes: ['id', 'name', 'brand']
                  }
                ]
              }
            ]
          }
        ]
      });

      orders = orders.concat(creditOrders.map(order => ({
        ...order.toJSON(),
        payment_method: 'credit',
        payment_method_info: getPaymentMethodInfo('credit')
      })));
    }

   
    if (method === 'installment' || method === 'both') {
      const installmentOrders = await Order.findAll({
        where: {
          id: {
            [Op.in]: (await InstallmentPlan.findAll({
              attributes: ['order_id'],
              raw: true
            })).map(ip => ip.order_id)
          },
          status: 'completed',
          ...dateWhere
        },
        include: [
          {
            model: Customer,
            attributes: ['id', 'name', 'email', 'phone']
          },
          {
            model: Admin,
            as: 'admin',
            attributes: ['admin_id', 'full_name', 'email']
          },
          {
            model: InstallmentPlan,
            as: 'installment_plan',
            attributes: ['id', 'payment_frequency', 'number_of_payments', 'remaining_balance', 'status']
          },
          {
            model: OrderItem,
            attributes: ['id', 'quantity', 'unit_price', 'total_price'],
            include: [
              {
                model: Variant,
                as: 'variant',
                attributes: ['id', 'sku', 'product_id'],
                include: [
                  {
                    model: Product,
                    as: 'product',
                    attributes: ['id', 'name', 'brand']
                  }
                ]
              }
            ]
          }
        ]
      });

      orders = orders.concat(installmentOrders.map(order => ({
        ...order.toJSON(),
        payment_method: 'installment',
        payment_method_info: getPaymentMethodInfo('installment')
      })));
    }

   
    if (sort === 'date') {
      orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === 'amount') {
      orders.sort((a, b) => b.total_amount - a.total_amount);
    } else if (sort === 'customer') {
      orders.sort((a, b) => a.Customer?.name.localeCompare(b.Customer?.name || ''));
    }

    
    const paginatedOrders = orders.slice(offset, offset + limitNum);

   
    const formattedOrders = paginatedOrders.map(order => ({
      order_id: order.id,
      order_date: order.createdAt,
      customer: {
        id: order.Customer?.id,
        name: order.Customer?.name,
        email: order.Customer?.email,
        phone: order.Customer?.phone
      },
      cashier: {
        id: order.admin?.id,
        name: order.admin?.admin_name,
        email: order.admin?.email
      },
      order_summary: {
        subtotal: parseFloat(order.subtotal),
        tax: parseFloat(order.tax_total),
        discount: parseFloat(order.discount_total),
        coupon: parseFloat(order.coupon_total),
        total_amount: parseFloat(order.total_amount)
      },
      payment_method: order.payment_method,
      payment_method_info: order.payment_method_info,
      payment_terms: order.payment_method === 'credit'
        ? {
          type: order.CreditAccount?.credit_type,
          amount_paid: parseFloat(order.CreditAccount?.amount_paid || 0),
          balance_due: parseFloat(order.CreditAccount?.balance || 0),
          issued_date: order.CreditAccount?.issued_at
        }
        : {
          frequency: order.InstallmentPlan?.payment_frequency,
          number_of_payments: order.InstallmentPlan?.number_of_payments,
          remaining_balance: parseFloat(order.InstallmentPlan?.remaining_balance || 0),
          status: order.InstallmentPlan?.status
        },
      items_count: order.OrderItems?.length || 0,
      items: order.OrderItems?.map(item => ({
        variant_id: item.variant?.id,
        sku: item.variant?.sku,
        product_name: item.variant?.product?.name,
        brand: item.variant?.product?.brand,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.total_price)
      })) || []
    }));

   
    const totalSales = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
    const creditSalesCount = orders.filter(o => o.payment_method === 'credit').length;
    const installmentSalesCount = orders.filter(o => o.payment_method === 'installment').length;

    return res.status(200).json({
      success: true,
      filter: { method, period },
      sales: formattedOrders,
      pagination: {
        total: orders.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(orders.length / limitNum)
      },
      summary: {
        total_sales: parseFloat(totalSales.toFixed(2)),
        total_transactions: orders.length,
        credit_sales: creditSalesCount,
        installment_sales: installmentSalesCount,
        credit_sales_amount: parseFloat(
          orders
            .filter(o => o.payment_method === 'credit')
            .reduce((sum, o) => sum + parseFloat(o.total_amount), 0)
            .toFixed(2)
        ),
        installment_sales_amount: parseFloat(
          orders
            .filter(o => o.payment_method === 'installment')
            .reduce((sum, o) => sum + parseFloat(o.total_amount), 0)
            .toFixed(2)
        )
      }
    });

  } catch (error) {
    console.error('❌ getCreditInstallmentSales error:', error);
    return res.status(500).json({
      error: 'Failed to fetch credit/installment sales',
      details: error.message
    });
  }
};
exports.getInventoryKPI = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date, compare = 'false' } = req.query;
    const shouldCompare = compare === 'true';

   
    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

   
    const now = new Date();
    let periodStart, periodEnd, previousStart, previousEnd;

    switch (filter) {
      case 'today':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        previousStart = new Date(periodStart);
        previousStart.setDate(periodStart.getDate() - 1);
        previousEnd = new Date(previousStart);
        previousEnd.setHours(23, 59, 59, 999);
        break;

      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        periodStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        periodEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        previousStart = new Date(periodStart);
        previousStart.setDate(periodStart.getDate() - 1);
        previousEnd = new Date(previousStart);
        previousEnd.setHours(23, 59, 59, 999);
        break;

      case 'last7':
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        periodStart = new Date(periodEnd);
        periodStart.setDate(periodEnd.getDate() - 6);
        periodStart.setHours(0, 0, 0, 0);
        previousStart = new Date(periodStart);
        previousStart.setDate(periodStart.getDate() - 7);
        previousEnd = new Date(previousStart);
        previousEnd.setDate(periodStart.getDate() - 1);
        previousEnd.setHours(23, 59, 59, 999);
        break;

      case 'thisMonth':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;

      case 'lastMonth':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
        break;

      case 'custom':
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'Custom filter requires start_date and end_date' });
        }
        periodStart = new Date(start_date);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(end_date);
        periodEnd.setHours(23, 59, 59, 999);
        previousStart = new Date(periodStart);
        const daysDiff = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
        previousStart.setDate(periodStart.getDate() - daysDiff);
        previousEnd = new Date(periodStart);
        previousEnd.setDate(periodStart.getDate() - 1);
        previousEnd.setHours(23, 59, 59, 999);
        break;
    }

    const { variants: variantsEndPeriod, variantStockMap: stockMapEndPeriod } = 
      await getStockAtDate(periodEnd);

   
    const { variantStockMap: stockMapStartPeriod } = 
      await getStockAtDate(periodStart);

   
    let totalStock = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inventorySellValue = 0;
    let inventoryCostValue = 0;

    variantsEndPeriod.forEach(variant => {
      const stockData = stockMapEndPeriod.get(variant.id);
      if (!stockData) return;

      const quantity = stockData.quantity;
      const threshold = variant.threshold || 0;
      const sellingPrice = parseFloat(variant.selling_price) || 0;
      const costPrice = parseFloat(variant.cost_price) || 0;

      totalStock += quantity;
      inventorySellValue += quantity * sellingPrice;
      inventoryCostValue += quantity * costPrice;

      const status = getStockStatus(quantity, threshold);
      if (status === 'in_stock') inStockCount++;
      else if (status === 'low_stock') lowStockCount++;
      else if (status === 'out_of_stock') outOfStockCount++;
    });

   
    let previousKpis = null;
    if (shouldCompare) {
      let prevTotalStock = 0;
      let prevInStockCount = 0;
      let prevLowStockCount = 0;
      let prevOutOfStockCount = 0;
      let prevInventorySellValue = 0;
      let prevInventoryCostValue = 0;

      variantsEndPeriod.forEach(variant => {
        const stockData = stockMapStartPeriod.get(variant.id);
        if (!stockData) return;

        const quantity = stockData.quantity;
        const threshold = variant.threshold || 0;
        const sellingPrice = parseFloat(variant.selling_price) || 0;
        const costPrice = parseFloat(variant.cost_price) || 0;

        prevTotalStock += quantity;
        prevInventorySellValue += quantity * sellingPrice;
        prevInventoryCostValue += quantity * costPrice;

        const status = getStockStatus(quantity, threshold);
        if (status === 'in_stock') prevInStockCount++;
        else if (status === 'low_stock') prevLowStockCount++;
        else if (status === 'out_of_stock') prevOutOfStockCount++;
      });

      previousKpis = {
        total_stock: prevTotalStock,
        in_stock_count: prevInStockCount,
        low_stock_count: prevLowStockCount,
        out_of_stock_count: prevOutOfStockCount,
        inventory_sell_value: parseFloat(prevInventorySellValue.toFixed(2)),
        inventory_cost_value: parseFloat(prevInventoryCostValue.toFixed(2))
      };
    }

    
    const calculateChange = (current, previous) => {
      if (!previous || previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(2));
    };

    const currentKpis = {
      total_stock: totalStock,
      in_stock_count: inStockCount,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      inventory_sell_value: parseFloat(inventorySellValue.toFixed(2)),
      inventory_cost_value: parseFloat(inventoryCostValue.toFixed(2)),
      inventory_profit_value: parseFloat((inventorySellValue - inventoryCostValue).toFixed(2)),
      total_variants: variantsEndPeriod.length
    };

    const growth = shouldCompare && previousKpis ? {
      total_stock_change: calculateChange(currentKpis.total_stock, previousKpis.total_stock),
      in_stock_change: currentKpis.in_stock_count - previousKpis.in_stock_count,
      low_stock_change: currentKpis.low_stock_count - previousKpis.low_stock_count,
      out_of_stock_change: currentKpis.out_of_stock_count - previousKpis.out_of_stock_count,
      sell_value_change: calculateChange(currentKpis.inventory_sell_value, previousKpis.inventory_sell_value),
      cost_value_change: calculateChange(currentKpis.inventory_cost_value, previousKpis.inventory_cost_value)
    } : null;

    return res.status(200).json({
      success: true,
      filter,
      period: { start: periodStart, end: periodEnd },
      kpi: currentKpis,
      ...(shouldCompare && previousKpis && { previous: previousKpis, growth })
    });

  } catch (error) {
    console.error('❌ getInventoryKPI error:', error);
    return res.status(500).json({
      error: 'Failed to fetch inventory KPI',
      details: error.message
    });
  }
};

exports.getAllStockMovementFlow = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date, granularity } = req.query;

  
    const { start, end } = getDateRange(filter, start_date, end_date);

   
    let selectedGranularity = granularity;
    if (!selectedGranularity) {
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) selectedGranularity = 'hourly';
      else if (daysDiff <= 31) selectedGranularity = 'daily';
      else selectedGranularity = 'weekly';
    }

 
    const variants = await Variant.findAll({
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'category_id'],
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        }
      ]
    });

    if (!variants.length) {
      return res.status(200).json({
        success: true,
        movement_data: [],
        summary: {},
        statistics: {}
      });
    }

    const allMovementData = [];

    for (const variant of variants) {
      let movementData = [];

  
      if (selectedGranularity === 'hourly') {
        movementData = await getHourlyStockMovement(variant.id, start, end);
      } else if (selectedGranularity === 'daily') {
        movementData = await getDailyStockMovement(variant.id, start, end);
      } else if (selectedGranularity === 'weekly') {
        movementData = await getWeeklyStockMovement(variant.id, start, end);
      }

     
      const formattedMovement = movementData.map(d => ({
        time:
          selectedGranularity === 'hourly'
            ? d.time
            : selectedGranularity === 'daily'
            ? d.day_name
            : d.week_range,
        stock: d.stock,
        change: d.change ?? 0
      }));

     
      const stockValues = formattedMovement.map(d => d.stock);
      const startingStock = formattedMovement.length
        ? formattedMovement[0].stock - formattedMovement[0].change
        : variant.quantity;
      const endingStock = formattedMovement.length
        ? formattedMovement[formattedMovement.length - 1].stock
        : variant.quantity;

      allMovementData.push({
        variant: {
          id: variant.id,
          sku: variant.sku,
          threshold: variant.threshold,
          product: {
            id: variant.product?.id,
            name: variant.product?.name,
            brand: variant.product?.brand,
            category: {
              id: variant.product?.category?.id,
              name: variant.product?.category?.name
            }
          }
        },
        movement_data: formattedMovement,
        summary: {
          starting_stock: startingStock,
          ending_stock: endingStock,
          net_change: endingStock - startingStock,
          max_stock: Math.max(...stockValues, variant.quantity),
          min_stock: Math.min(...stockValues, variant.quantity),
          average_stock: formattedMovement.length
            ? (stockValues.reduce((a, b) => a + b, 0) / stockValues.length).toFixed(2)
            : variant.quantity,
          total_transactions: movementData.reduce((sum, d) => sum + (d.transaction_count || 0), 0),
          current_status: getStockStatus(endingStock, variant.threshold)
        },
        statistics: {
          stock_increases: formattedMovement.filter(d => d.change > 0).length,
          stock_decreases: formattedMovement.filter(d => d.change < 0).length,
          no_change_periods: formattedMovement.filter(d => d.change === 0).length,
          total_increase_quantity: formattedMovement
            .filter(d => d.change > 0)
            .reduce((sum, d) => sum + d.change, 0),
          total_decrease_quantity: Math.abs(
            formattedMovement.filter(d => d.change < 0).reduce((sum, d) => sum + d.change, 0)
          )
        }
      });
    }

    return res.status(200).json({
      success: true,
      filter,
      granularity: selectedGranularity,
      period: { start, end },
      movement_data: allMovementData
    });
  } catch (error) {
    console.error('❌ getAllStockMovementFlow error:', error);
    return res.status(500).json({
      error: 'Failed to fetch all stock movement flow',
      details: error.message
    });
  }
};

exports.getStockMovementFlow = async (req, res) => {
  try {
    const { variant_id } = req.params;
    const { filter = 'today', start_date, end_date, granularity } = req.query;

   
    const variant = await Variant.findByPk(variant_id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'category_id'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    
    const { start, end } = getDateRange(filter, start_date, end_date);

   
    let selectedGranularity = granularity;
    if (!selectedGranularity) {
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) selectedGranularity = 'hourly';
      else if (daysDiff <= 31) selectedGranularity = 'daily';
      else selectedGranularity = 'weekly';
    }

   
    let movementData = [];
    if (selectedGranularity === 'hourly') {
      movementData = await getHourlyStockMovement(variant_id, start, end);
    } else if (selectedGranularity === 'daily') {
      movementData = await getDailyStockMovement(variant_id, start, end);
    } else if (selectedGranularity === 'weekly') {
      movementData = await getWeeklyStockMovement(variant_id, start, end);
    }

    if (movementData.length === 0) {
      return res.status(200).json({
        success: true,
        variant: {
          id: variant.id,
          sku: variant.sku,
          product: {
            id: variant.product?.id,
            name: variant.product?.name,
            brand: variant.product?.brand,
            category: {
              id: variant.product?.category?.id,
              name: variant.product?.category?.name
            }
          }
        },
        filter,
        granularity: selectedGranularity,
        period: { start, end },
        movement_data: [],
        summary: {
          starting_stock: variant.quantity,
          ending_stock: variant.quantity,
          net_change: 0,
          max_stock: variant.quantity,
          min_stock: variant.quantity,
          total_transactions: 0,
          threshold: variant.threshold
        }
      });
    }

   
    const stockValues = movementData.map(d => d.stock);
    const maxStock = Math.max(...stockValues);
    const minStock = Math.min(...stockValues);
    const startingStock = movementData[0].stock - movementData[0].change;
    const endingStock = movementData[movementData.length - 1].stock;
    const totalTransactions = movementData.reduce((sum, d) => sum + d.transaction_count, 0);

   
    const currentStatus = getStockStatus(endingStock, variant.threshold);

    return res.status(200).json({
      success: true,
      variant: {
        id: variant.id,
        sku: variant.sku,
        product: {
          id: variant.product?.id,
          name: variant.product?.name,
          brand: variant.product?.brand,
          category: {
            id: variant.product?.category?.id,
            name: variant.product?.category?.name
          }
        },
        threshold: variant.threshold
      },
      filter,
      granularity: selectedGranularity,
      period: { start, end },
      movement_data: movementData,
      summary: {
        starting_stock: startingStock,
        ending_stock: endingStock,
        net_change: endingStock - startingStock,
        max_stock: maxStock,
        min_stock: minStock,
        average_stock: (stockValues.reduce((a, b) => a + b, 0) / stockValues.length).toFixed(2),
        total_transactions: totalTransactions,
        threshold: variant.threshold,
        current_status: currentStatus
      },
      statistics: {
        stock_increases: movementData.filter(d => d.change > 0).length,
        stock_decreases: movementData.filter(d => d.change < 0).length,
        no_change_periods: movementData.filter(d => d.change === 0).length,
        total_increase_quantity: movementData.filter(d => d.change > 0).reduce((sum, d) => sum + d.change, 0),
        total_decrease_quantity: Math.abs(movementData.filter(d => d.change < 0).reduce((sum, d) => sum + d.change, 0))
      }
    });

  } catch (error) {
    console.error('❌ getStockMovementFlow error:', error);
    return res.status(500).json({
      error: 'Failed to fetch stock movement flow',
      details: error.message
    });
  }
};

exports.getProductStockMovementFlow = async (req, res) => {
  try {
    const { product_id } = req.params;
    const { filter = 'today', start_date, end_date, granularity } = req.query;

    const { start, end } = getDateRange(filter, start_date, end_date);

    let selectedGranularity = granularity;
    if (!selectedGranularity) {
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) selectedGranularity = 'hourly';
      else if (daysDiff <= 31) selectedGranularity = 'daily';
      else selectedGranularity = 'weekly';
    }

   
    const product = await Product.findByPk(product_id, {
      attributes: ['id', 'name', 'brand'],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Variant,
          as: 'variants',
          attributes: ['id', 'sku', 'quantity', 'threshold']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.variants?.length) {
      return res.status(200).json({
        success: true,
        product,
        filter,
        granularity: selectedGranularity,
        period: { start, end },
        variants_movement: [],
        combined_summary: {
          total_variants: 0,
          total_stock: 0,
          total_transactions: 0,
          net_change: 0
        }
      });
    }

    const getMovementByGranularity = async (variantId) => {
      if (selectedGranularity === 'hourly') {
        return getHourlyStockMovement(variantId, start, end);
      }
      if (selectedGranularity === 'daily') {
        return getDailyStockMovement(variantId, start, end);
      }
      return getWeeklyStockMovement(variantId, start, end);
    };

   
    const variantsMovement = await Promise.all(
      product.variants.map(async (variant) => {
        const rawMovement = await getMovementByGranularity(variant.id);

        const movements = rawMovement.map(d => ({
          date:
            selectedGranularity === 'hourly'
              ? d.time
              : selectedGranularity === 'daily'
              ? d.day_name
              : d.week_range,
          stock: d.stock,
          change: d.change ?? 0,
          transaction_count: d.transaction_count || 0
        }));

        const startingStock = movements.length
          ? movements[0].stock - movements[0].change
          : variant.quantity;

        const endingStock = movements.length
          ? movements[movements.length - 1].stock
          : variant.quantity;

        return {
          variant_id: variant.id,
          sku: variant.sku,
          movements,
          summary: {
            starting_stock: startingStock,
            ending_stock: endingStock,
            net_change: endingStock - startingStock
          }
        };
      })
    );

 
    const combinedSummary = variantsMovement.reduce(
      (acc, v) => {
        acc.total_variants += 1;
        acc.total_stock += v.summary.ending_stock;
        acc.total_transactions += v.movements.reduce(
          (s, m) => s + m.transaction_count,
          0
        );
        acc.net_change += v.summary.net_change;
        return acc;
      },
      {
        total_variants: 0,
        total_stock: 0,
        total_transactions: 0,
        net_change: 0
      }
    );

  
    return res.status(200).json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category
      },
      filter,
      granularity: selectedGranularity,
      period: { start, end },
      variants_movement: variantsMovement,
      combined_summary: combinedSummary
    });

  } catch (error) {
    console.error('❌ getProductStockMovementFlow error:', error);
    return res.status(500).json({
      error: 'Failed to fetch product stock movement',
      details: error.message
    });
  }
};


exports.getStockDistribution = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date } = req.query;

    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(filter, start_date, end_date);

   
    const variants = await Variant.findAll({
      where: { is_active: true },
      attributes: ['id', 'quantity', 'threshold', 'product_id'],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category_id'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      raw: false
    });

    if (variants.length === 0) {
      return res.status(200).json({
        success: true,
        filter,
        period: { start, end },
        distribution: [
          {
            label: 'In Stock',
            count: 0,
            percentage: 0,
            stroke: '#10b981',
            dot: 'bg-green-500',
            description: 'Adequate stock levels'
          },
          {
            label: 'Low Stock',
            count: 0,
            percentage: 0,
            stroke: '#f59e0b',
            dot: 'bg-yellow-400',
            description: 'Below minimum threshold'
          },
          {
            label: 'Out of Stock',
            count: 0,
            percentage: 0,
            stroke: '#ef4444',
            dot: 'bg-red-500',
            description: 'Requires immediate restocking'
          }
        ],
        summary: {
          total_variants: 0,
          in_stock_count: 0,
          low_stock_count: 0,
          out_of_stock_count: 0
        }
      });
    }


    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStock = 0;
    let totalVariants = variants.length;

    const detailedBreakdown = {};

    variants.forEach(variant => {
      const quantity = variant.quantity || 0;
      const threshold = variant.threshold || 0;
      totalStock += quantity;

     
      const status = getStockStatus(quantity, threshold);

      if (status === 'in_stock') {
        inStockCount++;
      } else if (status === 'low_stock') {
        lowStockCount++;
      } else if (status === 'out_of_stock') {
        outOfStockCount++;
      }

    
      if (!detailedBreakdown[status]) {
        detailedBreakdown[status] = {
          variants: [],
          total_quantity: 0,
          categories: {}
        };
      }

      detailedBreakdown[status].variants.push({
        variant_id: variant.id,
        product_name: variant.product?.name,
        sku: variant.sku,
        quantity,
        threshold,
        category: variant.product?.category?.name
      });

      detailedBreakdown[status].total_quantity += quantity;

      
      const categoryName = variant.product?.category?.name || 'Uncategorized';
      if (!detailedBreakdown[status].categories[categoryName]) {
        detailedBreakdown[status].categories[categoryName] = 0;
      }
      detailedBreakdown[status].categories[categoryName]++;
    });

  
    const inStockPercentage = totalVariants > 0 ? ((inStockCount / totalVariants) * 100).toFixed(1) : 0;
    const lowStockPercentage = totalVariants > 0 ? ((lowStockCount / totalVariants) * 100).toFixed(1) : 0;
    const outOfStockPercentage = totalVariants > 0 ? ((outOfStockCount / totalVariants) * 100).toFixed(1) : 0;

    const distribution = [
      {
        label: 'In Stock',
        count: inStockCount,
        percentage: parseFloat(inStockPercentage),
        stroke: '#10b981',
        dot: 'bg-green-500',
        description: 'Adequate stock levels',
        total_quantity: detailedBreakdown['in_stock']?.total_quantity || 0,
        breakdown_by_category: detailedBreakdown['in_stock']?.categories || {}
      },
      {
        label: 'Low Stock',
        count: lowStockCount,
        percentage: parseFloat(lowStockPercentage),
        stroke: '#f59e0b',
        dot: 'bg-yellow-400',
        description: 'Below minimum threshold',
        total_quantity: detailedBreakdown['low_stock']?.total_quantity || 0,
        breakdown_by_category: detailedBreakdown['low_stock']?.categories || {}
      },
      {
        label: 'Out of Stock',
        count: outOfStockCount,
        percentage: parseFloat(outOfStockPercentage),
        stroke: '#ef4444',
        dot: 'bg-red-500',
        description: 'Requires immediate restocking',
        total_quantity: detailedBreakdown['out_of_stock']?.total_quantity || 0,
        breakdown_by_category: detailedBreakdown['out_of_stock']?.categories || {}
      }
    ];

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      distribution,
      summary: {
        total_variants: totalVariants,
        total_stock: totalStock,
        in_stock_count: inStockCount,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        in_stock_percentage: parseFloat(inStockPercentage),
        low_stock_percentage: parseFloat(lowStockPercentage),
        out_of_stock_percentage: parseFloat(outOfStockPercentage)
      }
    });

  } catch (error) {
    console.error('❌ getStockDistribution error:', error);
    return res.status(500).json({
      error: 'Failed to fetch stock distribution',
      details: error.message
    });
  }
};

exports.getStockByCategory = async (req, res) => {
  try {
    const { 
      filter = 'today', 
      start_date, 
      end_date, 
      sort = 'stock',
      limit = 10
    } = req.query;

    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(filter, start_date, end_date);
    const limitNum = Math.min(parseInt(limit, 10) || 10, 50);

   
    const variants = await Variant.findAll({
      where: { is_active: true },
      attributes: ['id', 'quantity', 'threshold', 'product_id', 'selling_price', 'cost_price'],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category_id'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      raw: false
    });

    if (variants.length === 0) {
      return res.status(200).json({
        success: true,
        filter,
        period: { start, end },
        category_stock: [],
        summary: {
          total_categories: 0,
          total_stock: 0,
          total_variants: 0,
          total_sell_value: 0,
          total_cost_value: 0
        }
      });
    }

   
    const categoryMap = new Map();

    variants.forEach(variant => {
      const categoryName = variant.product?.category?.name || 'Uncategorized';
      const categoryId = variant.product?.category?.id;
      const quantity = variant.quantity || 0;
      const sellingPrice = parseFloat(variant.selling_price) || 0;
      const costPrice = parseFloat(variant.cost_price) || 0;
      const threshold = variant.threshold || 0;

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category_id: categoryId,
          category: categoryName,
          stock: 0,
          variant_count: 0,
          in_stock_count: 0,
          low_stock_count: 0,
          out_of_stock_count: 0,
          sell_value: 0,
          cost_value: 0,
          variants: []
        });
      }

      const catData = categoryMap.get(categoryName);
      catData.stock += quantity;
      catData.variant_count += 1;
      catData.sell_value += quantity * sellingPrice;
      catData.cost_value += quantity * costPrice;

   
      const status = getStockStatus(quantity, threshold);
      if (status === 'in_stock') catData.in_stock_count++;
      else if (status === 'low_stock') catData.low_stock_count++;
      else if (status === 'out_of_stock') catData.out_of_stock_count++;

      catData.variants.push({
        variant_id: variant.id,
        sku: variant.sku,
        quantity,
        status
      });
    });

   
    let categoryStockData = Array.from(categoryMap.values());

    if (sort === 'name') {
      categoryStockData.sort((a, b) => a.category.localeCompare(b.category));
    } else {
    
      categoryStockData.sort((a, b) => b.stock - a.stock);
    }

  
    const topCategories = categoryStockData.slice(0, limitNum);

   
    const formattedData = topCategories.map(cat => ({
      category: cat.category,
      category_id: cat.category_id,
      stock: cat.stock,
      variant_count: cat.variant_count,
      in_stock_count: cat.in_stock_count,
      low_stock_count: cat.low_stock_count,
      out_of_stock_count: cat.out_of_stock_count,
      sell_value: parseFloat(cat.sell_value.toFixed(2)),
      cost_value: parseFloat(cat.cost_value.toFixed(2)),
      profit_value: parseFloat((cat.sell_value - cat.cost_value).toFixed(2))
    }));

 
    const totalStock = categoryStockData.reduce((sum, cat) => sum + cat.stock, 0);
    const totalSellValue = categoryStockData.reduce((sum, cat) => sum + cat.sell_value, 0);
    const totalCostValue = categoryStockData.reduce((sum, cat) => sum + cat.cost_value, 0);
    const totalVariants = categoryStockData.reduce((sum, cat) => sum + cat.variant_count, 0);

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      sort,
      category_stock: formattedData,
      summary: {
        total_categories: categoryStockData.length,
        displayed_categories: formattedData.length,
        total_stock: totalStock,
        total_variants: totalVariants,
        total_sell_value: parseFloat(totalSellValue.toFixed(2)),
        total_cost_value: parseFloat(totalCostValue.toFixed(2)),
        total_profit_value: parseFloat((totalSellValue - totalCostValue).toFixed(2)),
        average_stock_per_category: (totalStock / categoryStockData.length).toFixed(2)
      }
    });

  } catch (error) {
    console.error('❌ getStockByCategory error:', error);
    return res.status(500).json({
      error: 'Failed to fetch stock by category',
      details: error.message
    });
  }
};
const getSalesDateRange = (filter, start_date, end_date) => {
  const now = new Date();
  
  switch (filter) {
    case "today":
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return [todayStart, todayEnd];
      
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return [yesterdayStart, yesterdayEnd];
      
    case "last7days":
      const start7 = new Date(now);
      start7.setDate(now.getDate() - 6);
      start7.setHours(0, 0, 0, 0);
      const end7 = new Date(now);
      end7.setHours(23, 59, 59, 999);
      return [start7, end7];
      
    case "thisMonth":
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return [monthStart, monthEnd];
      
    case "lastMonth":
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return [lastMonthStart, lastMonthEnd];
      
    case "custom":
      if (!start_date || !end_date) {
        return [new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date()];
      }
      const customStart = new Date(start_date);
      customStart.setHours(0, 0, 0, 0);
      const customEnd = new Date(end_date);
      customEnd.setHours(23, 59, 59, 999);
      return [customStart, customEnd];
      
    default:
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return [defaultStart, defaultEnd];
  }
};

exports.salesKpi = async (req, res) => {
  try {
    const { filter = "today", start_date, end_date } = req.query;
    const [start, end] = getSalesDateRange(filter, start_date, end_date);

 
    const summary = await Order.findOne({
      attributes: [
        [fn("COUNT", col("Order.id")), "total_sales_count"],
        [fn("COALESCE", fn("SUM", col("total_amount")), 0), "total_sales_amount"],
        [fn("COALESCE", fn("SUM", col("discount_total")), 0), "total_discount_amount"],
        [fn("COALESCE", fn("SUM", col("tax_total")), 0), "total_tax_amount"],
        [fn("COALESCE", fn("SUM", col("subtotal")), 0), "subtotal"]
      ],
      where: {
        createdAt: { [Op.between]: [start, end] },
        status: "completed"
      },
      raw: true,
    });

  
    const purchaseTypes = await Order.findAll({
      attributes: [
        "purchase_type",
        [fn("COUNT", col("Order.id")), "count"],
        [fn("COALESCE", fn("SUM", col("total_amount")), 0), "total_amount"]
      ],
      where: {
        createdAt: { [Op.between]: [start, end] },
        status: "completed"
      },
      group: ["purchase_type"],
      raw: true,
    });

    const purchaseTypeDistribution = {};
    let totalPurchaseTransactions = 0;
    purchaseTypes.forEach(p => {
      purchaseTypeDistribution[p.purchase_type] = {
        count: Number(p.count),
        total_amount: parseFloat(p.total_amount || 0)
      };
      totalPurchaseTransactions += Number(p.count);
    });

 
    const payments = await OrderPayment.findAll({
      attributes: [
        "method",
        [fn("COUNT", col("OrderPayment.id")), "count"],
        [fn("COALESCE", fn("SUM", col("amount")), 0), "total_amount"]
      ],
      include: [{
        model: Order,
        where: {
          createdAt: { [Op.between]: [start, end] },
          status: "completed"
        },
        attributes: [],
        required: true
      }],
      group: ["method"],
      raw: true,
    });

    const paymentDistribution = {};
    let totalPaymentTransactions = 0;
    let fullCreditCount = 0;
    let partialCreditCount = 0;

  
    for (const p of payments) {
      const method = p.method;
      const count = Number(p.count);
      const totalAmount = parseFloat(p.total_amount || 0);

      paymentDistribution[method] = {
        count,
        total_amount: totalAmount,
        percentage: totalPaymentTransactions > 0 
          ? ((count / totalPaymentTransactions) * 100).toFixed(2)
          : 0
      };

      totalPaymentTransactions += count;

     
      if (method === "credit") {
      
        const creditOrders = await Order.findAll({
          where: {
            createdAt: { [Op.between]: [start, end] },
            status: "completed",
            id: {
              [Op.in]: (await CreditAccount.findAll({
                attributes: ['order_id'],
                raw: true
              })).map(ca => ca.order_id)
            }
          },
          include: [{
            model: CreditAccount,
            as: 'credit_account',
            attributes: ['credit_type', 'total_amount', 'amount_paid']
          }],
          raw: true
        });

        fullCreditCount = creditOrders.filter(
          o => o['CreditAccount.credit_type'] === 'full'
        ).length;

        partialCreditCount = creditOrders.filter(
          o => o['CreditAccount.credit_type'] === 'partial'
        ).length;

        paymentDistribution[method].full_credit = fullCreditCount;
        paymentDistribution[method].partial_credit = partialCreditCount;
      }
    }

   
    Object.keys(paymentDistribution).forEach(method => {
      paymentDistribution[method].percentage = totalPaymentTransactions > 0
        ? ((paymentDistribution[method].count / totalPaymentTransactions) * 100).toFixed(2)
        : 0;
    });

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      summary: {
        total_transactions: parseInt(summary?.total_sales_count || 0),
        total_sales_amount: parseFloat(summary?.total_sales_amount || 0),
        subtotal: parseFloat(summary?.subtotal || 0),
        total_tax: parseFloat(summary?.total_tax_amount || 0),
        total_discount: parseFloat(summary?.total_discount_amount || 0),
        average_transaction_value: parseInt(summary?.total_sales_count || 0) > 0
          ? (parseFloat(summary?.total_sales_amount || 0) / parseInt(summary?.total_sales_count || 0)).toFixed(2)
          : 0
      },
      purchase_types: {
        distribution: purchaseTypeDistribution,
        total_transactions: totalPurchaseTransactions
      },
      payment_methods: {
        distribution: paymentDistribution,
        total_transactions: totalPaymentTransactions,
        credit_breakdown: {
          full_credit: fullCreditCount,
          partial_credit: partialCreditCount,
          total_credit: fullCreditCount + partialCreditCount
        }
      }
    });

  } catch (err) {
    console.error("❌ salesKpi error:", err);
    return res.status(500).json({
      error: "Failed to fetch sales KPI",
      details: err.message
    });
  }
};


exports.getPaymentMethodAnalytics = async (req, res) => {
  try {
    const { filter = "today", start_date, end_date } = req.query;
    const [start, end] = getSalesDateRange(filter, start_date, end_date);

   
    const paymentRecords = await OrderPayment.findAll({
      attributes: [
        'id',
        'method',
        'amount',
        'reference',
        [fn('COUNT', col('id')), 'count']
      ],
      include: [{
        model: Order,
        where: {
          created_at: { [Op.between]: [start, end] },
          status: "completed"
        },
        attributes: ['id', 'total_amount', 'created_at'],
        required: true
      }],
      group: ['method'],
      subQuery: false,
      raw: true
    });

    
    const transactions = await OrderPayment.findAll({
      include: [{
        model: Order,
        where: {
          created_at: { [Op.between]: [start, end] },
          status: "completed"
        },
        attributes: ['id', 'total_amount', 'created_at'],
        required: true
      }],
      attributes: ['id', 'method', 'amount', 'reference'],
      order: [['id', 'DESC']],
      limit: 100,
      raw: true
    });

   
    const methodSummary = {};
    transactions.forEach(t => {
      if (!methodSummary[t.method]) {
        methodSummary[t.method] = {
          count: 0,
          total_amount: 0,
          transactions: []
        };
      }
      methodSummary[t.method].count++;
      methodSummary[t.method].total_amount += parseFloat(t.amount);
      methodSummary[t.method].transactions.push({
        transaction_id: t.id,
        amount: parseFloat(t.amount),
        reference: t.reference,
        order_date: t['Order.createdAt']
      });
    });


    const formattedMethods = Object.keys(methodSummary).map(method => ({
      method,
      count: methodSummary[method].count,
      total_amount: parseFloat(methodSummary[method].total_amount.toFixed(2)),
      average_transaction: parseFloat(
        (methodSummary[method].total_amount / methodSummary[method].count).toFixed(2)
      ),
      percentage: paymentRecords.length > 0
        ? ((methodSummary[method].count / transactions.length) * 100).toFixed(2)
        : 0,
      sample_transactions: methodSummary[method].transactions.slice(0, 5)
    }));

    const totalAmount = formattedMethods.reduce((sum, m) => sum + m.total_amount, 0);

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      payment_methods: formattedMethods,
      summary: {
        total_transactions: transactions.length,
        total_amount: parseFloat(totalAmount.toFixed(2)),
        payment_methods_count: formattedMethods.length,
        most_used_method: formattedMethods.length > 0
          ? formattedMethods.reduce((max, m) => m.count > max.count ? m : max)
          : null
      }
    });

  } catch (err) {
    console.error("❌ getPaymentMethodAnalytics error:", err);
    return res.status(500).json({
      error: "Failed to fetch payment method analytics",
      details: err.message
    });
  }
};

exports.getSalesOvertime = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date, granularity } = req.query;

    // Map frontend filter names to backend filter names
    const filterMap = {
      'thisWeek': 'last7',
      'thisMonth': 'thisMonth',
      'thisYear': 'thisYear',
      'today': 'today',
      'yesterday': 'yesterday',
      'last7': 'last7',
      'lastMonth': 'lastMonth',
      'custom': 'custom'
    };

    const mappedFilter = filterMap[filter] || filter;
    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'thisYear', 'custom'];
    if (!validFilters.includes(mappedFilter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

  
    const { start, end } = getDateRange(mappedFilter, start_date, end_date);


    let selectedGranularity = granularity;
    if (!selectedGranularity) {
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) selectedGranularity = 'hourly';
      else if (daysDiff <= 31) selectedGranularity = 'daily';
      else if (daysDiff <= 365) selectedGranularity = 'weekly';
      else selectedGranularity = 'monthly';
    }

    
    const orders = await Order.findAll({
      where: {
        status: 'completed',
        createdAt: { [Op.between]: [start, end] }
      },
      attributes: ['id', 'total_amount', 'subtotal', 'tax_total', 'discount_total', 'createdAt'],
      order: [['createdAt', 'ASC']],
      raw: true
    });

    if (orders.length === 0) {
      return res.status(200).json({
        success: true,
        filter,
        granularity: selectedGranularity,
        period: { start, end },
        chart_data: [],
        summary: {
          total_transactions: 0,
          total_sales_amount: 0,
          total_tax: 0,
          total_discount: 0,
          average_transaction_value: 0,
          average_hourly_transactions: 0,
          average_hourly_revenue: 0,
          peak_time: null
        }
      });
    }

    let chartData = [];

   
    if (selectedGranularity === 'hourly') {
      chartData = generateHourlyData(orders, start, end);
    } else if (selectedGranularity === 'daily') {
      chartData = generateDailyData(orders, start, end);
    } else if (selectedGranularity === 'weekly') {
      chartData = generateWeeklyData(orders, start, end);
    } else if (selectedGranularity === 'monthly') {
      chartData = generateMonthlyData(orders, start, end);
    }

   
    const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const totalTax = orders.reduce((sum, o) => sum + parseFloat(o.tax_total || 0), 0);
    const totalDiscount = orders.reduce((sum, o) => sum + parseFloat(o.discount_total || 0), 0);
    const avgTransactionValue = orders.length > 0 ? totalAmount / orders.length : 0;

    
    const peakTime = chartData.length > 0 
      ? chartData.reduce((max, item) => item.amount > max.amount ? item : max)
      : null;

   
    const hoursDiff = Math.ceil((end - start) / (1000 * 60 * 60));
    const avgHourlyTransactions = (orders.length / hoursDiff).toFixed(2);
    const avgHourlyRevenue = (totalAmount / hoursDiff).toFixed(2);

    return res.status(200).json({
      success: true,
      filter,
      granularity: selectedGranularity,
      period: { start, end },
      chart_data: chartData,
      summary: {
        total_transactions: orders.length,
        total_sales_amount: parseFloat(totalAmount.toFixed(2)),
        total_tax: parseFloat(totalTax.toFixed(2)),
        total_discount: parseFloat(totalDiscount.toFixed(2)),
        average_transaction_value: parseFloat(avgTransactionValue.toFixed(2)),
        average_hourly_transactions: parseFloat(avgHourlyTransactions),
        average_hourly_revenue: parseFloat(avgHourlyRevenue),
        peak_time: peakTime ? {
          time: peakTime.time,
          amount: peakTime.amount,
          count: peakTime.count
        } : null
      }
    });

  } catch (error) {
    console.error('❌ getSalesOvertime error:', error);
    return res.status(500).json({
      error: 'Failed to fetch sales overtime data',
      details: error.message
    });
  }
};

exports.getPurchaseTypeDistribution = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date } = req.query;

     const filterMap = {
      'thisWeek': 'last7',
      'thisMonth': 'thisMonth',
      'thisYear': 'thisYear',
      'today': 'today',
      'yesterday': 'yesterday',
      'last7': 'last7',
      'lastMonth': 'lastMonth',
      'custom': 'custom'
    };

    const mappedFilter = filterMap[filter] || filter;
    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(mappedFilter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(mappedFilter, start_date, end_date);

  
    const purchaseTypes = await Order.findAll({
      attributes: [
        'purchase_type',
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'total_amount']
      ],
      where: {
        status: 'completed',
        createdAt: { [Op.between]: [start, end] }
      },
      group: ['purchase_type'],
      raw: true
    });

    if (purchaseTypes.length === 0) {
      return res.status(200).json({
        success: true,
        filter,
        period: { start, end },
        chart_data: [],
        summary: {
          total_transactions: 0,
          total_sales_amount: 0,
          purchase_types: {}
        }
      });
    }

   
    const totalTransactions = purchaseTypes.reduce((sum, pt) => sum + Number(pt.count), 0);
    const totalSalesAmount = purchaseTypes.reduce((sum, pt) => sum + parseFloat(pt.total_amount || 0), 0);

   
    const chartData = purchaseTypes.map(pt => {
      const count = Number(pt.count);
      const percentage = totalTransactions > 0 
        ? ((count / totalTransactions) * 100).toFixed(1)
        : '0';
      
      const displayName = pt.purchase_type === 'in_store' 
        ? 'In-Store' 
        : pt.purchase_type === 'online_order'
        ? 'Online Order'
        : pt.purchase_type;

      const color = pt.purchase_type === 'in_store' 
        ? '#3b82f6' 
        : '#10b981';

      return {
        name: displayName,
        value: count,
        percentage,
        color,
        purchase_type: pt.purchase_type,
        total_amount: parseFloat(pt.total_amount || 0),
        average_transaction: count > 0 
          ? parseFloat((parseFloat(pt.total_amount || 0) / count).toFixed(2))
          : 0
      };
    });

   
    const purchaseTypeSummary = {};
    chartData.forEach(item => {
      purchaseTypeSummary[item.purchase_type] = {
        count: item.value,
        percentage: parseFloat(item.percentage),
        total_amount: item.total_amount,
        average_transaction: item.average_transaction
      };
    });

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      chart_data: chartData,
      summary: {
        total_transactions: totalTransactions,
        total_sales_amount: parseFloat(totalSalesAmount.toFixed(2)),
        purchase_types: purchaseTypeSummary
      }
    });

  } catch (error) {
    console.error('❌ getPurchaseTypeDistribution error:', error);
    return res.status(500).json({
      error: 'Failed to fetch purchase type distribution',
      details: error.message
    });
  }
};

exports.getTopSellingVariants = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date, limit = 5 } = req.query;

        const filterMap = {
      'thisWeek': 'last7',
      'thisMonth': 'thisMonth',
      'thisYear': 'thisYear',
      'today': 'today',
      'yesterday': 'yesterday',
      'last7': 'last7',
      'lastMonth': 'lastMonth',
      'custom': 'custom'
    };
    const mappedFilter = filterMap[filter] || filter;

    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(mappedFilter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(mappedFilter, start_date, end_date);
    const limitNum = Math.min(parseInt(limit, 10) || 5, 20);

   
    const topVariants = await OrderItem.findAll({
      attributes: [
        'variant_id',
        [fn('SUM', col('quantity')), 'total_quantity'],
        [fn('COALESCE', fn('SUM', col('total_price')), 0), 'total_revenue'],
        [fn('COUNT', col('OrderItem.id')), 'total_orders'],
        [fn('AVG', col('unit_price')), 'average_price']
      ],
      include: [
        {
          model: Order,
          where: {
            status: 'completed',
            createdAt: { [Op.between]: [start, end] }
          },
          attributes: [],
          required: true
        }
      ],
      group: ['variant_id'],
      subQuery: false,
      raw: true,
      order: [[literal('total_revenue'), 'DESC']],
      limit: limitNum
    });

    if (topVariants.length === 0) {
      return res.status(200).json({
        success: true,
        filter,
        period: { start, end },
        top_variants: [],
        summary: {
          total_variants: 0,
          total_quantity_sold: 0,
          total_revenue: 0,
          average_revenue_per_variant: 0
        }
      });
    }


    const variantIds = topVariants.map(v => v.variant_id);
    const variants = await Variant.findAll({
      where: { id: variantIds },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'category_id'],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      attributes: ['id', 'sku', 'image_url', 'cost_price', 'selling_price']
    });

  
    const variantMap = new Map(variants.map(v => [v.id, v]));

    
    const formattedVariants = topVariants.map((sale, index) => {
      const variant = variantMap.get(sale.variant_id);
      if (!variant) return null;

      const totalQuantity = parseInt(sale.total_quantity, 10);
      const totalRevenue = parseFloat(sale.total_revenue || 0);
      const totalOrders = parseInt(sale.total_orders, 10);
      const avgPrice = parseFloat(sale.average_price || 0);
      const costPrice = parseFloat(variant.cost_price || 0);
      const sellingPrice = parseFloat(variant.selling_price || 0);

      const totalCost = costPrice * totalQuantity;
      const totalProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

      return {
        rank: index + 1,
        variant_id: variant.id,
        sku: variant.sku,
        product: {
          id: variant.product?.id,
          name: variant.product?.name,
          brand: variant.product?.brand,
          category: {
            id: variant.product?.category?.id,
            name: variant.product?.category?.name
          }
        },
        image: Array.isArray(variant.image_url) && variant.image_url.length > 0
          ? variant.image_url[0].url || variant.image_url[0]
          : null,
        sales_metrics: {
          total_quantity: totalQuantity,
          total_revenue: parseFloat(totalRevenue.toFixed(2)),
          total_orders: totalOrders,
          average_price: parseFloat(avgPrice.toFixed(2)),
          revenue_per_order: parseFloat((totalRevenue / totalOrders).toFixed(2))
        },
        profit_metrics: {
          unit_cost: parseFloat(costPrice.toFixed(2)),
          unit_selling_price: parseFloat(sellingPrice.toFixed(2)),
          unit_profit: parseFloat((sellingPrice - costPrice).toFixed(2)),
          total_cost: parseFloat(totalCost.toFixed(2)),
          total_profit: parseFloat(totalProfit.toFixed(2)),
          profit_margin_percent: parseFloat(profitMargin)
        }
      };
    }).filter(item => item !== null);

   
    const totalQuantitySold = formattedVariants.reduce((sum, v) => sum + v.sales_metrics.total_quantity, 0);
    const totalRevenue = formattedVariants.reduce((sum, v) => sum + v.sales_metrics.total_revenue, 0);
    const totalProfit = formattedVariants.reduce((sum, v) => sum + v.profit_metrics.total_profit, 0);
    const totalOrders = formattedVariants.reduce((sum, v) => sum + v.sales_metrics.total_orders, 0);

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      top_variants: formattedVariants,
      summary: {
        total_variants: formattedVariants.length,
        total_quantity_sold: totalQuantitySold,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_profit: parseFloat(totalProfit.toFixed(2)),
        total_orders: totalOrders,
        average_revenue_per_variant: formattedVariants.length > 0 
          ? parseFloat((totalRevenue / formattedVariants.length).toFixed(2))
          : 0,
        average_profit_per_variant: formattedVariants.length > 0 
          ? parseFloat((totalProfit / formattedVariants.length).toFixed(2))
          : 0,
        average_profit_margin: formattedVariants.length > 0
          ? parseFloat(
              (formattedVariants.reduce((sum, v) => sum + parseFloat(v.profit_metrics.profit_margin_percent), 0) / formattedVariants.length).toFixed(2)
            )
          : 0
      }
    });

  } catch (error) {
    console.error('❌ getTopSellingVariants error:', error);
    return res.status(500).json({
      error: 'Failed to fetch top selling variants',
      details: error.message
    });
  }
};


exports.getRecentApprovedExpenses = async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 5, 20);
    const offset = (pageNum - 1) * limitNum;

 
    const { count, rows } = await Expense.findAndCountAll({
      where: {
        status: 'approved'
      },
      include: [
        {
          model: ExpenseCategory,
          as: 'expense_category',
          attributes: ['expense_category_id', 'name']
        },
        {
          model: Admin,
          as: 'admin',
          attributes: ['admin_id', 'full_name', 'email']
        }
      ],
      attributes: [
        'id',
        'expense_amount',
        'note',
        'date',
        'payment_method',
        'expense_reciept_url',
        'expense_approved_by',
        'createdAt'
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      raw: false
    });

   
    const formattedExpenses = rows.map(expense => ({
      expense_id: expense.id,
      category: {
        id: expense.expense_category?.expense_category_id,
        name: expense.expense_category?.name
      },
      amount: parseFloat(expense.expense_amount),
      description: expense.note,
      date: expense.date,
      payment_method: expense.payment_method,
      receipt_url: expense.expense_reciept_url,
      recorded_by: {
        id: expense.admin?.admin_id,
        name: expense.admin?.admin_name,
        email: expense.admin?.email
      },
      approved_at: expense.createdAt
    }));

 
    const totalApprovedAmount = formattedExpenses.reduce(
      (sum, exp) => sum + exp.amount,
      0
    );

    return res.status(200).json({
      success: true,
      recent_expenses: formattedExpenses,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      },
      summary: {
        total_recent_expenses: formattedExpenses.length,
        total_recent_amount: parseFloat(totalApprovedAmount.toFixed(2)),
        average_expense: formattedExpenses.length > 0
          ? parseFloat((totalApprovedAmount / formattedExpenses.length).toFixed(2))
          : 0
      }
    });

  } catch (error) {
    console.error('❌ getRecentApprovedExpenses error:', error);
    return res.status(500).json({
      error: 'Failed to fetch recent approved expenses',
      details: error.message
    });
  }
};

exports.getExpenseByCategory = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date } = req.query;

    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(filter, start_date, end_date);

  
    const expensesByCategory = await Expense.findAll({
      where: {
        status: 'approved',
        date: { [Op.between]: [start, end] }
      },
      include: [
        {
          model: ExpenseCategory,
          as: 'expense_category',
          attributes: ['expense_category_id', 'name']
        }
      ],
      attributes: [
        'expense_category_id',
        [fn('COUNT', col('id')), 'expense_count'],
        [fn('COALESCE', fn('SUM', col('expense_amount')), 0), 'total_amount']
      ],
      group: ['expense_category_id'],
      subQuery: false,
      raw: false,
      order: [[literal('total_amount'), 'DESC']]
    });

    if (expensesByCategory.length === 0) {
      return res.status(200).json({
        success: true,
        filter,
        period: { start, end },
        chart_data: [],
        summary: {
          total_categories: 0,
          total_expenses: 0,
          total_amount: 0
        }
      });
    }

   
    const totalAmount = expensesByCategory.reduce(
      (sum, cat) => sum + parseFloat(cat.dataValues.total_amount || 0),
      0
    );

  
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
      '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#6366f1'
    ];

  
    const chartData = expensesByCategory.map((cat, index) => {
      const amount = parseFloat(cat.dataValues.total_amount || 0);
      const count = parseInt(cat.dataValues.expense_count || 0);
      const percentage = totalAmount > 0 
        ? ((amount / totalAmount) * 100).toFixed(1)
        : '0';

      return {
        name: cat.expense_category?.name || 'Unknown',
        category_id: cat.expense_category?.expense_category_id,
        value: count,
        amount: parseFloat(amount.toFixed(2)),
        percentage: parseFloat(percentage),
        color: colors[index % colors.length],
        average_expense: count > 0 
          ? parseFloat((amount / count).toFixed(2))
          : 0
      };
    });


    const totalExpenses = expensesByCategory.reduce(
      (sum, cat) => sum + parseInt(cat.dataValues.expense_count || 0),
      0
    );

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      chart_data: chartData,
      summary: {
        total_categories: chartData.length,
        total_expenses: totalExpenses,
        total_amount: parseFloat(totalAmount.toFixed(2)),
        average_expense_per_category: chartData.length > 0
          ? parseFloat((totalAmount / chartData.length).toFixed(2))
          : 0,
        highest_category: chartData.length > 0 ? chartData[0] : null,
        lowest_category: chartData.length > 0 ? chartData[chartData.length - 1] : null
      }
    });

  } catch (error) {
    console.error('❌ getExpenseByCategory error:', error);
    return res.status(500).json({
      error: 'Failed to fetch expense by category',
      details: error.message
    });
  }
};

exports.getExpenseKPI = async (req, res) => {
  try {
    const { filter = 'today', start_date, end_date } = req.query;

    const validFilters = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: 'Invalid filter value' });
    }

    const { start, end } = getDateRange(filter, start_date, end_date);

   
    const expenseMetrics = await Expense.findOne({
      where: {
        status: 'approved',
        date: { [Op.between]: [start, end] }
      },
      attributes: [
        [fn('COUNT', col('id')), 'total_expenses'],
        [fn('COALESCE', fn('SUM', col('expense_amount')), 0), 'total_expense_amount']
      ],
      raw: true
    });

    const totalExpenses = parseInt(expenseMetrics?.total_expenses || 0);
    const totalExpenseAmount = parseFloat(expenseMetrics?.total_expense_amount || 0);

   
    const salesMetrics = await Order.findOne({
      where: {
        status: 'completed',
        createdAt: { [Op.between]: [start, end] }
      },
      attributes: [
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'total_sales'],
        [fn('COALESCE', fn('SUM', col('tax_total')), 0), 'total_tax'],
        [fn('COALESCE', fn('SUM', col('discount_total')), 0), 'total_discount']
      ],
      raw: true
    });

    const totalRevenue = parseFloat(salesMetrics?.total_sales || 0);
    const totalTax = parseFloat(salesMetrics?.total_tax || 0);
    const totalDiscount = parseFloat(salesMetrics?.total_discount || 0);

  
    const expenseCategories = await Expense.findAll({
      where: {
        status: 'approved',
        date: { [Op.between]: [start, end] }
      },
      include: [
        {
          model: ExpenseCategory,
          as: 'expense_category',
          attributes: ['expense_category_id', 'name']
        }
      ],
      attributes: ['expense_category_id'],
      group: ['expense_category_id'],
      raw: true
    });

    const categoryCount = expenseCategories.length;

  
    const netProfit = totalRevenue - totalExpenseAmount;
    const grossProfit = totalRevenue;
    const profitMargin = totalRevenue > 0 
      ? ((netProfit / totalRevenue) * 100).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      filter,
      period: { start, end },
      kpi: {
        total_expenses: totalExpenses,
        total_expense_amount: parseFloat(totalExpenseAmount.toFixed(2)),
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_tax: parseFloat(totalTax.toFixed(2)),
        total_discount: parseFloat(totalDiscount.toFixed(2)),
        category_count: categoryCount,
        net_profit: parseFloat(netProfit.toFixed(2)),
        gross_profit: parseFloat(grossProfit.toFixed(2)),
        profit_margin_percent: parseFloat(profitMargin),
        expense_to_revenue_ratio: totalRevenue > 0 
          ? ((totalExpenseAmount / totalRevenue) * 100).toFixed(2)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ getExpenseKPI error:', error);
    return res.status(500).json({
      error: 'Failed to fetch expense KPI',
      details: error.message
    });
  }
};

exports.getCustomersWithPaymentMethods = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'transactions', payment_type = 'all', purchase_type = 'all' } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

   
    const { rows } = await Customer.findAndCountAll({
     
      include: [
        {
          model: Order,
          attributes: ['id', 'total_amount', 'status', 'purchase_type', 'createdAt'],
          where: { status: 'completed' },
          required: false,
          include: [
            {
              model: OrderPayment,
              attributes: ['id', 'method', 'amount', 'status'],
              required: false
            }
          ]
        },
        {
          model: CreditAccount,
          attributes: ['id', 'total_amount', 'amount_paid', 'balance', 'credit_type'],
          required: false
        },
        {
          model: InstallmentPlan,
          attributes: ['id', 'total_amount', 'remaining_balance', 'status'],
          required: false
        }
      ],
      attributes: ['id', 'name', 'email', 'phone', 'is_walk_in', 'created_at'],
      subQuery: false,
      raw: false
    });

  
    const processedCustomers = rows.map(customer => {
      const orders = customer.Orders || [];
      const creditAccounts = customer.CreditAccounts || [];
      const installmentPlans = customer.InstallmentPlans || [];

      const totalTransactions = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

      let paymentMethods = [];
      let paymentStatus = 'normal';
      let hasNormalPayments = false;
      let hasInstallmentPayments = false;
      let hasCreditPayments = false;

      orders.forEach(order => {
        if (order.OrderPayments && order.OrderPayments.length > 0) {
          order.OrderPayments.forEach(payment => {
            if (payment.method === 'cash' || payment.method === 'card' || payment.method === 'transfer') {
              hasNormalPayments = true;
              if (!paymentMethods.includes('normal')) {
                paymentMethods.push('normal');
              }
            }
            if (payment.method === 'installment') {
              hasInstallmentPayments = true;
              if (!paymentMethods.includes('installment')) {
                paymentMethods.push('installment');
              }
            }
            if (payment.method === 'credit') {
              hasCreditPayments = true;
              if (!paymentMethods.includes('credit')) {
                paymentMethods.push('credit');
              }
            }
          });
        }
      });

      if (creditAccounts.length > 0) {
        hasCreditPayments = true;
        if (!paymentMethods.includes('credit')) {
          paymentMethods.push('credit');
        }
      }

      if (installmentPlans.length > 0) {
        hasInstallmentPayments = true;
        if (!paymentMethods.includes('installment')) {
          paymentMethods.push('installment');
        }
      }

      if (paymentMethods.length > 1) {
        paymentStatus = 'mixed';
      } else if (hasCreditPayments) {
        paymentStatus = 'credit';
      } else if (hasInstallmentPayments) {
        paymentStatus = 'installment';
      } else {
        paymentStatus = 'normal';
      }

      const paidInstallmentAmount = installmentPlans.reduce((sum, plan) => {
        return sum + (parseFloat(plan.total_amount || 0) - parseFloat(plan.remaining_balance || 0));
      }, 0);

      const creditRevenue = creditAccounts.reduce((sum, acc) => {
        return sum + parseFloat(acc.amount_paid || 0);
      }, 0);

      const totalCustomerRevenue = totalRevenue + paidInstallmentAmount;

      const inStoreCount = orders.filter(o => o.purchase_type === 'in_store').length;
      const onlineCount = orders.filter(o => o.purchase_type === 'online_order').length;

      return {
        customer_id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        is_walk_in: customer.is_walk_in,
        customer_since: customer.created_at,
        payment_status: paymentStatus,
        payment_methods: paymentMethods,
        transaction_data: {
          total_transactions: totalTransactions,
          total_cash_transactions: orders.filter(o => !creditAccounts.length && !installmentPlans.length).length,
          total_credit_accounts: creditAccounts.length,
          total_installment_plans: installmentPlans.length,
          in_store_purchases: inStoreCount,
          online_purchases: onlineCount
        },
        revenue_data: {
          from_regular_sales: parseFloat(totalRevenue.toFixed(2)),
          from_installments: parseFloat(paidInstallmentAmount.toFixed(2)),
          from_credit: parseFloat(creditRevenue.toFixed(2)),
          total_revenue: parseFloat(totalCustomerRevenue.toFixed(2))
        },
        credit_details: creditAccounts.length > 0 ? {
          total_accounts: creditAccounts.length,
          full_credit_count: creditAccounts.filter(c => c.credit_type === 'full').length,
          partial_credit_count: creditAccounts.filter(c => c.credit_type === 'partial').length,
          total_credited: parseFloat(
            creditAccounts.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0).toFixed(2)
          ),
          total_paid: parseFloat(creditRevenue.toFixed(2)),
          outstanding_balance: parseFloat(
            creditAccounts.reduce((sum, c) => sum + parseFloat(c.balance || 0), 0).toFixed(2)
          )
        } : null,
        installment_details: installmentPlans.length > 0 ? {
          active_plans: installmentPlans.filter(p => p.status === 'active').length,
          completed_plans: installmentPlans.filter(p => p.status === 'completed').length,
          defaulted_plans: installmentPlans.filter(p => p.status === 'defaulted').length,
          total_outstanding: parseFloat(
            installmentPlans.reduce((sum, p) => sum + parseFloat(p.remaining_balance || 0), 0).toFixed(2)
          )
        } : null
      };
    });

 
    const filteredCustomers = processedCustomers.filter(customer => {
    
      if (payment_type !== 'all') {
  if (!customer.payment_methods.includes(payment_type)) {
    return false;
  }
}

      
    
      if (purchase_type !== 'all') {
        const { in_store_purchases, online_purchases } = customer.transaction_data;
        if (purchase_type === 'in_store' && in_store_purchases === 0) {
          return false;
        }
        if (purchase_type === 'online_order' && online_purchases === 0) {
          return false;
        }
      }
      
      return true;
    });


    if (sort === 'revenue') {
      filteredCustomers.sort((a, b) => b.revenue_data.total_revenue - a.revenue_data.total_revenue);
    } else if (sort === 'name') {
      filteredCustomers.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filteredCustomers.sort((a, b) => b.transaction_data.total_transactions - a.transaction_data.total_transactions);
    }

    
    const offset = (pageNum - 1) * limitNum;
    const paginatedCustomers = filteredCustomers.slice(offset, offset + limitNum);

    const totalCustomerRevenue = paginatedCustomers.reduce((sum, c) => sum + c.revenue_data.total_revenue, 0);
    const totalTransactions = paginatedCustomers.reduce((sum, c) => sum + c.transaction_data.total_transactions, 0);

    return res.status(200).json({
      success: true,
      customers: paginatedCustomers,
      pagination: {
        total: filteredCustomers.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(filteredCustomers.length / limitNum)
      },
      filters: {
        payment_type,
        purchase_type,
        sort
      },
      summary: {
        total_customers_found: paginatedCustomers.length,
        total_revenue: parseFloat(totalCustomerRevenue.toFixed(2)),
        total_transactions: totalTransactions,
        average_revenue_per_customer: paginatedCustomers.length > 0
          ? parseFloat((totalCustomerRevenue / paginatedCustomers.length).toFixed(2))
          : 0,
        customers_by_payment_status: {
          normal: paginatedCustomers.filter(c => c.payment_status === 'normal').length,
          credit: paginatedCustomers.filter(c => c.payment_status === 'credit').length,
          installment: paginatedCustomers.filter(c => c.payment_status === 'installment').length,
          mixed: paginatedCustomers.filter(c => c.payment_status === 'mixed').length
        },
        customers_by_purchase_type: {
          in_store: paginatedCustomers.filter(c => c.transaction_data.in_store_purchases > 0).length,
          online: paginatedCustomers.filter(c => c.transaction_data.online_purchases > 0).length
        }
      }
    });

  } catch (error) {
    console.error('❌ getCustomersWithPaymentMethods error:', error);
    return res.status(500).json({
      error: 'Failed to fetch customers with payment methods',
      details: error.message
    });
  }
};

exports.getAdminCount = async (req, res) => {
  try {
  
    const totalAdmins = await Admin.count();

   
    const superAdminCount = await Admin.count({
      include: [
        {
          model: Role,
          where: { role_name: 'Super Admin' },
          attributes: [],
          required: true
        }
      ]
    });

   
    const nonSuperAdminCount = totalAdmins - superAdminCount;

   
    const adminsByRole = await Admin.findAll({
      attributes: [
        [fn('COUNT', col('Admin.admin_id')), 'count']
      ],
      include: [
        {
          model: Role,
          attributes: ['roles_id', 'role_name'],
          required: true
        }
      ],
      group: ['Role.roles_id', 'Role.role_name'],
      raw: true,
      subQuery: false
    });

   
    const verifiedAdmins = await Admin.count({
      where: { isVerified: true }
    });

    const unverifiedAdmins = await Admin.count({
      where: { isVerified: false }
    });

   
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeAdmins = await Admin.count({
      where: {
        last_login: { [Op.gte]: thirtyDaysAgo }
      }
    });

    return res.status(200).json({
      success: true,
      admin_count: {
        total_admins: totalAdmins,
        super_admins: superAdminCount,
        non_super_admins: nonSuperAdminCount,
        verified_admins: verifiedAdmins,
        unverified_admins: unverifiedAdmins,
        active_admins_30days: activeAdmins,
        inactive_admins_30days: totalAdmins - activeAdmins
      },
      admins_by_role: adminsByRole.map(role => ({
        role_name: role['Role.role_name'],
        role_id: role['Role.roles_id'],
        count: parseInt(role.count)
      })),
      summary: {
        admin_utilization_percentage: totalAdmins > 0 
          ? ((verifiedAdmins / totalAdmins) * 100).toFixed(2)
          : 0,
        super_admin_percentage: totalAdmins > 0
          ? ((superAdminCount / totalAdmins) * 100).toFixed(2)
          : 0,
        activity_rate_30days: totalAdmins > 0
          ? ((activeAdmins / totalAdmins) * 100).toFixed(2)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ getAdminCount error:', error);
    return res.status(500).json({
      error: 'Failed to fetch admin count',
      details: error.message
    });
  }
};

exports.getCustomerKPI = async (req, res) => {
  try {
  
    const totalCustomers = await Customer.count({
      where: {
        is_walk_in: { [Op.ne]: true }
      }
    });

   
    const creditCustomers = await Customer.count({
      distinct: true,
      col: 'id',
      include: [
        {
          model: CreditAccount,
          attributes: [],
          required: true
        }
      ]
    });

  
    const installmentCustomers = await Customer.count({
      distinct: true,
      col: 'id',
      include: [
        {
          model: InstallmentPlan,
          attributes: [],
          required: true
        }
      ]
    });

  
    const onlineCustomers = await Customer.count({
      distinct: true,
      col: 'id',
      include: [
        {
          model: Order,
          where: {
            purchase_type: 'online_order',
            status: 'completed'
          },
          attributes: [],
          required: true
        }
      ]
    });

   
    const walkInCount = await Customer.count({
      where: {
        is_walk_in: true
      }
    });

   
    const totalTransactions = await Order.count({
      where: { status: 'completed' }
    });

  
    const totalRevenueData = await Order.findOne({
      where: { status: 'completed' },
      attributes: [
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'total']
      ],
      raw: true
    });

    const totalRevenue = parseFloat(totalRevenueData?.total || 0);

   
    const avgTransactionValue = totalTransactions > 0 
      ? (totalRevenue / totalTransactions).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      kpi: {
        total_customers: totalCustomers,
        credit_customers: creditCustomers,
        installment_customers: installmentCustomers,
        online_customers: onlineCustomers,
        walk_in_customers: walkInCount,
        total_transactions: totalTransactions,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        average_transaction_value: parseFloat(avgTransactionValue)
      },
      summary: {
        unique_paying_customers: totalCustomers + walkInCount,
        credit_adoption_rate: totalCustomers > 0 
          ? ((creditCustomers / totalCustomers) * 100).toFixed(2)
          : 0,
        installment_adoption_rate: totalCustomers > 0
          ? ((installmentCustomers / totalCustomers) * 100).toFixed(2)
          : 0,
        online_adoption_rate: totalCustomers > 0
          ? ((onlineCustomers / totalCustomers) * 100).toFixed(2)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ getCustomerKPI error:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer KPI',
      details: error.message
    });
  }
};

