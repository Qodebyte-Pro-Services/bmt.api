const { Op } = require("sequelize");

function buildDateRange(period, start, end, cashier) {
  const where = { status: "completed" };
  const today = new Date();

  if (cashier && cashier !== "all") {
    where.admin_id = cashier;
  }

  let isLargeReport = false;

  switch (period) {
    case "day":
      where.createdAt = {
        [Op.between]: [
          new Date(today.setHours(0, 0, 0, 0)),
          new Date(today.setHours(23, 59, 59, 999))
        ]
      };
      break;

    case "month":
      where.createdAt = {
        [Op.between]: [
          new Date(today.getFullYear(), today.getMonth(), 1),
          new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
        ]
      };
      break;

    case "year":
      isLargeReport = true;
      where.createdAt = {
        [Op.between]: [
          new Date(today.getFullYear(), 0, 1),
          new Date(today.getFullYear(), 11, 31, 23, 59, 59)
        ]
      };
      break;

    case "custom":
      isLargeReport = true;
      where.createdAt = {
        [Op.between]: [
          new Date(start + "T00:00:00Z"),
          new Date(end + "T23:59:59Z")
        ]
      };
      break;
  }

  return { where, isLargeReport };
}

module.exports = { buildDateRange };
