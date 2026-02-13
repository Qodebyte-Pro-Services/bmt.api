const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { Op, fn, col, literal } = require("sequelize");
const {
  Order,
  OrderItem,
  Variant,
  Product,
  Category,
  Customer,
  Admin,
} = require("../models");

module.exports = async function generateSalesReport(params) {
  const {
    period = "day",
    start_date,
    end_date,
    summary = "true",
    details = "false",
    payment_methods = "false",
    product_breakdown = "false",
    category_type,
    cashier,
    format = "json",
  } = params;

  const today = new Date();
  let where = { status: "completed" };

  if (cashier && cashier !== "all") {
    where.admin_id = cashier;
  }

  if (start_date && end_date) {
    where.created_at = { [Op.between]: [new Date(start_date), new Date(end_date)] };
  } else if (period === "day") {
    const s = new Date(); 
    s.setHours(0, 0, 0, 0);
    const e = new Date(); 
    e.setHours(23, 59, 59, 999);
    where.created_at = { [Op.between]: [s, e] };
  }

  let categoryJoin = [];
  if (category_type) {
    categoryJoin = [{
      model: OrderItem,
      as: "OrderItems",
      include: [{
        model: Variant,
        as: "variant",
        include: [{
          model: Product,
          include: [{
            model: Category,
            where: { category_name: { [Op.iLike]: `%${category_type}%` } }
          }]
        }]
      }]
    }];
  }

  const summaryData = {};

  if (summary === "true") {
    const [s] = await Order.findAll({
      where,
      include: categoryJoin,
      attributes: [
        [fn("COUNT", col("Order.id")), "total_orders"],
        [fn("SUM", col("total_amount")), "total_sales"],
      ],
      raw: true
    });

    summaryData.total_orders = Number(s.total_orders || 0);
    summaryData.total_sales = Number(s.total_sales || 0);
  }

  const reportObj = {
    generated_at: new Date().toISOString(),
    period,
    summary: summaryData
  };

  const reportsDir = path.join(process.cwd(), "storage", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  if (format === "json") {
    const fileName = `sales-${Date.now()}.json`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(reportObj, null, 2));
    console.log(`✅ JSON report saved to: ${filePath}`);
    return filePath;
  }

 
  const fileName = `sales-${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30 });
      const stream = fs.createWriteStream(filePath);
      
      doc.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', () => {
        console.log(`✅ PDF report saved to: ${filePath}`);
        resolve(filePath);
      });

      doc.pipe(stream);
      doc.fontSize(18).text("Sales Report", { align: "center" });
      doc.moveDown();
      
      Object.entries(summaryData).forEach(([k, v]) => {
        doc.fontSize(12).text(`${k}: ${v}`);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};