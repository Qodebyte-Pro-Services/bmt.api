const {
  Order,
  OrderItem,
  OrderPayment,
  Variant,
  Product,
  Category,
  Customer,
  Admin,
  Report,
  sequelize,
  CreditAccount,
  InstallmentPlan
} = require("../models");

const { Op, fn, col, literal } = require("sequelize");
const { buildDateRange } = require("../utils/reportDates");


async function buildSalesReport(params, user) {
  const {
    period,
    start_date,
    end_date,
    summary,
    details,
    payment_methods,
    product_breakdown,
    cashier,
    page,
    pageSize,
    format,
    category_type
  } = params;

  const { where, isLargeReport } = buildDateRange(
    period,
    start_date,
    end_date,
    cashier
  );

  if (isLargeReport) {
    const rpt = await Report.create({
      created_by: user?.admin_id ?? null,
      params,
      format,
      status: "pending"
    });

    return {
      queued: true,
      report_id: rpt.id
    };
  }

  const report = {
    meta: {
      period,
      start_date,
      end_date,
      generated_at: new Date().toISOString(),
      cashier: cashier ?? "all"
    }
  };

  /* ---------------- SUMMARY ---------------- */
  if (summary === "true") {
    const [summaryRow] = await Order.findAll({
      where,
      attributes: [
        [fn("COUNT", col("Order.id")), "total_orders"],
        [fn("COALESCE", fn("SUM", col("subtotal")), 0), "subtotal"],
        [fn("COALESCE", fn("SUM", col("tax_total")), 0), "total_tax"],
        [fn("COALESCE", fn("SUM", col("discount_total")), 0), "total_discount"],
        [fn("COALESCE", fn("SUM", col("total_amount")), 0), "total_sales"]
      ],
      raw: true
    });

    const [cogsRow] = await OrderItem.findAll({
      include: [
        { model: Order, where, attributes: [] },
        { model: Variant, as: "variant", attributes: [] }
      ],
      attributes: [
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal("OrderItem.quantity * COALESCE(variant.cost_price,0)")
            ),
            0
          ),
          "total_cogs"
        ]
      ],
      raw: true,
      subQuery: false
    });

    report.summary = {
      ...summaryRow,
      total_cogs: Number(cogsRow?.total_cogs || 0),
      gross_profit:
        Number(summaryRow.total_sales || 0) -
        Number(cogsRow?.total_cogs || 0)
    };
  }

  /* ---------------- DETAILS ---------------- */
  if (details === "true") {
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        { model: Customer, attributes: ["id", "name", "email"] },
        { model: Admin, as: "admin", attributes: ["admin_id", "full_name"] },
        {
          model: OrderItem,
          as: "OrderItems",
          include: [{ model: Variant, as: "variant", attributes: ["id", "sku"] }]
        },
        { model: OrderPayment },
         { model: InstallmentPlan }, 
          { model: CreditAccount },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset
    });

    report.transactions = rows.map(o => {
      const order = o.get({ plain: true });

      return {
        id: order.id,
        timestamp: order.createdAt,
        customer: order.Customer,
        paymentMethod: order.OrderPayments?.[0]?.method ?? "cash",
        total: Number(order.total_amount),
        tax: Number(order.tax_total),
        discount: Number(order.discount_total),
        items: order.OrderItems.map(i => ({
          id: i.id,
          variantId: i.variant_id,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price)
        })),
         purchaseType: order.purchase_type === "online_order" ? "online" : "in-store",
  installmentPlan: order.InstallmentPlan
    ? {
        downPayment: Number(order.InstallmentPlan.down_payment),
        remainingBalance: Number(order.InstallmentPlan.remaining_balance)
      }
    : undefined,
  credit: order.CreditAccount
    ? {
        creditBalance: Number(order.CreditAccount.balance)
      }
    : undefined,
      };
    });

      const purchaseTypeCounts = {};
  let totalTx = 0;
  let installmentCount = 0;
  let totalInstallmentAmount = 0;
  let activeInstallments = 0;
  let creditCount = 0;
  let totalCreditValue = 0;
  let totalCreditBalance = 0;

  for (const t of report.transactions) {
    // Purchase type
    const type = t.purchaseType || t.purchase_type || 'in-store';
    purchaseTypeCounts[type] = (purchaseTypeCounts[type] || 0) + 1;
    totalTx++;

    // Installment stats
    if (t.paymentMethod === 'installment') {
      installmentCount++;
      totalInstallmentAmount += Number(t.total) || 0;
      if (t.installmentPlan && t.installmentPlan.remainingBalance > 0) {
        activeInstallments++;
      }
    }

    // Credit stats
    if (t.paymentMethod === 'credit') {
      creditCount++;
      totalCreditValue += Number(t.total) || 0;
      totalCreditBalance += t.credit?.creditBalance ? Number(t.credit.creditBalance) : 0;
    }
  }

  report.purchase_type_distribution = {
    distribution: purchaseTypeCounts,
    total_transactions: totalTx,
  };

  report.installment_stats = {
    count: installmentCount,
    total_value: totalInstallmentAmount,
    active: activeInstallments,
  };

  report.credit_stats = {
    count: creditCount,
    total_value: totalCreditValue,
    outstanding_balance: totalCreditBalance,
  };

    report.pagination = {
      page: Number(page),
      pageSize: limit,
      total: count,
      totalPages: Math.ceil(count / limit)
    };
  }

  /* ---------------- PAYMENT METHODS ---------------- */
  if (payment_methods === "true") {
    report.payment_methods = await OrderPayment.findAll({
      include: [{ model: Order, where, attributes: [] }],
      attributes: [
        "method",
        [fn("COUNT", col("OrderPayment.id")), "count"],
        [fn("SUM", col("amount")), "total"]
      ],
      group: ["method"],
      raw: true,
      subQuery: false
    });
  }

  /* ---------------- PRODUCT BREAKDOWN ---------------- */
  if (product_breakdown === "true") {
    report.product_breakdown = await OrderItem.findAll({
      include: [
        { model: Order, where, attributes: [] },
        { model: Variant, as: "variant", attributes: ["id", "sku"] }
      ],
      attributes: [
        "variant_id",
        [fn("SUM", col("OrderItem.quantity")), "total_qty"],
        [
          fn("SUM", literal("OrderItem.quantity * OrderItem.unit_price")),
          "total_sales"
        ]
      ],
      group: ["variant_id"],
      order: [[literal("total_sales"), "DESC"]],
      raw: true,
      subQuery: false
    });
  }

  return report;
}

module.exports = { buildSalesReport };
