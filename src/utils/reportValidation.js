function validateSalesReportQuery(q) {
  const validPeriods = ["day", "week", "month", "year", "custom"];
  if (!validPeriods.includes(q.period)) {
    return { valid: false, error: "Invalid period" };
  }

  return { valid: true };
}

module.exports = { validateSalesReportQuery };
