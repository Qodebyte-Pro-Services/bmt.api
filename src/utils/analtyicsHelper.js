const { Order, Expense, InstallmentPlan, InstallmentPayment, Customer, Variant, Product, InventoryLog, Category } = require('../models');
const { Op, fn, col } = require('sequelize');



function getDateRange(filter, customStart = null, customEnd = null) {
  const now = new Date();
  let start, end;

  switch (filter) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;

    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      break;

    case 'last7':
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;

    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom date range requires start_date and end_date');
      }
      start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  return { start, end };
};


async function getHourlyBreakdown(startDate, endDate) {

  const sales = await Order.findAll({
    where: {
      status: 'completed',
      createdAt: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      [fn('HOUR', col('createdAt')), 'hour'],
      [fn('SUM', col('total_amount')), 'income']
    ],
    group: [fn('HOUR', col('createdAt'))],
    raw: true
  });

 
  const expenses = await Expense.findAll({
    where: {
      status: 'approved',
      date: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      [fn('HOUR', col('createdAt')), 'hour'],
      [fn('SUM', col('expense_amount')), 'expense']
    ],
    group: [fn('HOUR', col('createdAt'))],
    raw: true
  });


  const salesMap = {};
  sales.forEach(s => salesMap[s.hour] = Number(s.income));

  const expenseMap = {};
  expenses.forEach(e => expenseMap[e.hour] = Number(e.expense));


  const hours = [];
  for (let i = 0; i < 24; i++) {
    const hourDate = new Date(startDate);
    hourDate.setHours(i, 0, 0, 0);

    const income = salesMap[i] || 0;
    const expense = expenseMap[i] || 0;

    if (income !== 0 || expense !== 0) {
  hours.push({
    period: hourDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    income: +income.toFixed(2),
    expense: +expense.toFixed(2),
    net: +(income - expense).toFixed(2)
  });
}

  }

  return hours;
};

async function getDailyBreakdown(startDate, endDate) {
  const sales = await Order.findAll({
    where: {
      status: 'completed',
      createdAt: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      [fn('DATE', col('createdAt')), 'date'],
      [fn('SUM', col('total_amount')), 'income']
    ],
    group: [fn('DATE', col('createdAt'))],
    raw: true
  });

  const expenses = await Expense.findAll({
    where: {
      status: 'approved',
      date: { [Op.between]: [startDate, endDate] }
    },
    attributes: [
      [fn('DATE', col('date')), 'date'],
      [fn('SUM', col('expense_amount')), 'expense']
    ],
    group: [fn('DATE', col('date'))],
    raw: true
  });

  const salesMap = {};
  sales.forEach(s => salesMap[s.date] = Number(s.income));

  const expenseMap = {};
  expenses.forEach(e => expenseMap[e.date] = Number(e.expense));

  const days = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const income = salesMap[dateKey] || 0;
    const expense = expenseMap[dateKey] || 0;

   if (income !== 0 || expense !== 0) {
  days.push({
    period: d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }),
    date: dateKey,
    income: +income.toFixed(2),
    expense: +expense.toFixed(2),
    net: +(income - expense).toFixed(2)
  });
}

  }

  return days;
}

function calculateStockPercentage(currentQty, threshold) {
  if (!threshold || threshold <= 0) return currentQty > 0 ? 100 : 0;
  const percentage = (currentQty / threshold) * 100;
  return Math.min(Math.round(percentage), 100);
}

function getStatusInfo(status) {
  const statusMap = {
    out_of_stock: { color: 'red', priority: 3, label: 'Out of Stock', icon: '❌', display: 'critical' },
    low_stock: { color: 'yellow', priority: 2, label: 'Low Stock', icon: '⚠️', display: 'warning' },
    in_stock: { color: 'green', priority: 1, label: 'In Stock', icon: '✅', display: 'normal' }
  };
  return statusMap[status] || statusMap.in_stock;
}

function getStockStatus(currentQty, threshold) {
  if (currentQty <= 0) return 'out_of_stock';
  if (currentQty <= threshold) return 'low_stock';
  return 'in_stock';
}

function calculateGrowth(current, previous) {
  if (!previous || previous === 0) return { formatted: current > 0 ? '+100%' : '0%', value: previous === 0 ? 100 : 0 };
  const growth = ((current - previous) / previous) * 100;
  const sign = growth >= 0 ? '+' : '';
  return { formatted: `${sign}${growth.toFixed(1)}%`, value: growth };
}

function getInstallmentStatus(plan) {
  const now = new Date();
  
  if (plan.status === 'completed') {
    return {
      status: 'completed',
      label: 'Completed',
      color: 'green',
      priority: 1,
      icon: '✅'
    };
  }
  
  if (plan.status === 'defaulted') {
    return {
      status: 'defaulted',
      label: 'Defaulted',
      color: 'red',
      priority: 4,
      icon: '❌'
    };
  }

 
  const nextDue = plan.InstallmentPayments?.find(p => p.status === 'pending');
  if (nextDue && new Date(nextDue.due_date) < now) {
    return {
      status: 'overdue',
      label: 'Overdue',
      color: 'red',
      priority: 3,
      icon: '⚠️'
    };
  }

 
  return {
    status: 'active',
    label: 'Active',
    color: 'blue',
    priority: 2,
    icon: '⏳'
  };
}

function getPaymentMethodInfo(method) {
  const methodMap = {
    credit: {
      label: 'Credit',
      color: 'orange',
      icon: '💳'
    },
    installment: {
      label: 'Installment',
      color: 'blue',
      icon: '📅'
    }
  };
  return methodMap[method] || { label: method, color: 'gray', icon: '💰' };
};

async function getStockAtDate(targetDate) {
  try {
   
    const variants = await Variant.findAll({
      where: { is_active: true },
      attributes: ['id', 'quantity', 'threshold', 'cost_price', 'selling_price', 'product_id'],
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
      raw: false
    });


    const variantStockMap = new Map();

    for (const variant of variants) {
     
      const logs = await InventoryLog.findAll({
        where: {
          variant_id: variant.id,
          created_at: { [Op.lte]: targetDate }
        },
        attributes: ['quantity', 'type', 'created_at'],
        order: [['created_at', 'DESC']],
        raw: true
      });

     
      let stockAtDate = variant.quantity;

   
      const logsAfterTarget = await InventoryLog.findAll({
        where: {
          variant_id: variant.id,
          created_at: { [Op.gt]: targetDate }
        },
        attributes: ['quantity'],
        raw: true
      });

      const totalChangeAfter = logsAfterTarget.reduce((sum, log) => sum + log.quantity, 0);
      stockAtDate = stockAtDate - totalChangeAfter;

      variantStockMap.set(variant.id, {
        quantity: Math.max(0, stockAtDate),
        variant: variant
      });
    }

    return { variants, variantStockMap };
  } catch (error) {
    console.error('❌ Error calculating stock at date:', error);
    throw error;
  }
};


async function getHourlyStockMovement(variantId, startDate, endDate) {
  // Normalize dates to ensure proper query range (set to start and end of day)
  const queryStart = new Date(startDate);
  queryStart.setHours(0, 0, 0, 0);
  
  const queryEnd = new Date(endDate);
  queryEnd.setHours(23, 59, 59, 999);

  const logs = await InventoryLog.findAll({
    where: {
      variant_id: variantId,
      created_at: { 
        [Op.gte]: queryStart,
        [Op.lte]: queryEnd
      }
    },
    attributes: ['id', 'quantity', 'type', 'reason', 'note', 'created_at', 'recorded_by'],
    order: [['created_at', 'ASC']],
    raw: true
  });

  
  const logsBeforeStart = await InventoryLog.findAll({
    where: {
      variant_id: variantId,
      created_at: { [Op.lt]: queryStart }
    },
    attributes: ['quantity'],
    raw: true
  });

  let startingStock = 0;
  logsBeforeStart.forEach(log => {
    startingStock += log.quantity;
  });

 
  const hourlyData = [];
  let currentStock = startingStock;
  let currentHour = new Date(startDate);
  currentHour.setMinutes(0, 0, 0);

  
  const logsByHour = {};
  logs.forEach(log => {
    const logTime = new Date(log.created_at);
    const hour = logTime.getHours();
    const dateKey = logTime.toISOString().split('T')[0];
    const hourKey = `${dateKey}_${hour}`;

    if (!logsByHour[hourKey]) {
      logsByHour[hourKey] = [];
    }
    logsByHour[hourKey].push(log);
  });

 
  for (let d = new Date(startDate); d <= endDate; d.setHours(d.getHours() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const hour = d.getHours();
    const hourKey = `${dateKey}_${hour}`;
    const hourLogs = logsByHour[hourKey] || [];

    let hourlyChange = 0;
    let details = [];

    hourLogs.forEach(log => {
      hourlyChange += log.quantity;
      details.push({
        type: log.type,
        quantity: log.quantity,
        reason: log.reason,
        note: log.note,
        timestamp: log.created_at
      });
    });

    const newStock = currentStock + hourlyChange;

    if (hourlyChange !== 0 || hourlyData.length === 0) {
      hourlyData.push({
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        timestamp: d.toISOString(),
        stock: newStock,
        change: hourlyChange,
        details: details,
        transaction_count: hourLogs.length
      });

      currentStock = newStock;
    }
  }

  return hourlyData;
}


async function getDailyStockMovement(variantId, startDate, endDate) {
  // Normalize dates to ensure proper query range
  const queryStart = new Date(startDate);
  queryStart.setHours(0, 0, 0, 0);
  
  const queryEnd = new Date(endDate);
  queryEnd.setHours(23, 59, 59, 999);

  const logs = await InventoryLog.findAll({
    where: {
      variant_id: variantId,
      created_at: { 
        [Op.gte]: queryStart,
        [Op.lte]: queryEnd
      }
    },
    attributes: ['id', 'quantity', 'type', 'reason', 'created_at'],
    order: [['created_at', 'ASC']],
    raw: true
  });

  const logsBeforeStart = await InventoryLog.findAll({
    where: {
      variant_id: variantId,
      created_at: { [Op.lt]: queryStart }
    },
    attributes: ['quantity'],
    raw: true
  });

  let startingStock = 0;
  logsBeforeStart.forEach(log => {
    startingStock += log.quantity;
  });


  const logsByDay = {};
  logs.forEach(log => {
    const logDate = new Date(log.created_at);
    const dateKey = logDate.toISOString().split('T')[0];

    if (!logsByDay[dateKey]) {
      logsByDay[dateKey] = [];
    }
    logsByDay[dateKey].push(log);
  });


  const dailyData = [];
  let currentStock = startingStock;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const dayLogs = logsByDay[dateKey] || [];

    let dailyChange = 0;
    let typeBreakdown = { restock: 0, sale: 0, adjustment: 0 };
    let details = [];

    dayLogs.forEach(log => {
      dailyChange += log.quantity;
      typeBreakdown[log.type]++;
      details.push({
        type: log.type,
        quantity: log.quantity,
        reason: log.reason,
        timestamp: log.created_at
      });
    });

    const newStock = currentStock + dailyChange;

    dailyData.push({
      date: dateKey,
      day_name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      stock: newStock,
      change: dailyChange,
      type_breakdown: typeBreakdown,
      transaction_count: dayLogs.length,
      details: details
    });

    currentStock = newStock;
  }

  return dailyData;
}


async function getWeeklyStockMovement(variantId, startDate, endDate) {
  // Normalize dates to ensure proper query range
  const queryStart = new Date(startDate);
  queryStart.setHours(0, 0, 0, 0);
  
  const queryEnd = new Date(endDate);
  queryEnd.setHours(23, 59, 59, 999);

  const logs = await InventoryLog.findAll({
    where: {
      variant_id: variantId,
      created_at: { 
        [Op.gte]: queryStart,
        [Op.lte]: queryEnd
      }
    },
    attributes: ['quantity', 'type', 'created_at'],
    raw: true
  });

  const logsBeforeStart = await InventoryLog.findAll({
    where: {
      variant_id: variantId,
      created_at: { [Op.lt]: queryStart }
    },
    attributes: ['quantity'],
    raw: true
  });

  let startingStock = 0;
  logsBeforeStart.forEach(log => {
    startingStock += log.quantity;
  });

  const logsByWeek = {};
  logs.forEach(log => {
    const logDate = new Date(log.created_at);
    const weekStart = new Date(logDate);
    weekStart.setDate(logDate.getDate() - logDate.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!logsByWeek[weekKey]) {
      logsByWeek[weekKey] = [];
    }
    logsByWeek[weekKey].push(log);
  });

  const weeklyData = [];
  let currentStock = startingStock;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    const weekLogs = logsByWeek[weekKey] || [];

    let weeklyChange = 0;
    let typeBreakdown = { restock: 0, sale: 0, adjustment: 0 };

    weekLogs.forEach(log => {
      weeklyChange += log.quantity;
      typeBreakdown[log.type]++;
    });

    const newStock = currentStock + weeklyChange;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    weeklyData.push({
      week_start: weekKey,
      week_end: weekEnd.toISOString().split('T')[0],
      week_range: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      stock: newStock,
      change: weeklyChange,
      type_breakdown: typeBreakdown,
      transaction_count: weekLogs.length
    });

    currentStock = newStock;
  }

  return weeklyData;
}




module.exports = {
  getDateRange,
  getHourlyBreakdown,
  getDailyBreakdown,
  calculateStockPercentage,
  getStockStatus,
  getStatusInfo,
  calculateGrowth,
  getInstallmentStatus,
    getPaymentMethodInfo,
    getStockAtDate,
    getHourlyStockMovement,
    getDailyStockMovement,
    getWeeklyStockMovement
};