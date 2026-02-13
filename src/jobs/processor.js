const { Report } = require("../models");
const generateSalesReport = require("./generateSalesReport");

module.exports = async function processPendingReports() {
  try {
    const reports = await Report.findAll({
      where: { status: "pending" },
      limit: 3,
      order: [["created_at", "ASC"]], 
    });

    if (reports.length === 0) {
      console.log("📭 No pending reports found");
      return;
    }

    console.log(`⏳ Processing ${reports.length} pending report(s)...`);

    for (const report of reports) {
      try {
        console.log(`🔄 Processing report ${report.id}...`);
        
       
        await report.update({
          processing_started_at: new Date()
        });

        const filePath = await generateSalesReport(report.params);

        await report.update({
          status: "completed",
          result_path: filePath,
          processing_completed_at: new Date()
        });

        console.log(`✅ Report ${report.id} completed successfully`);
      } catch (err) {
        console.error(`❌ Report ${report.id} failed:`, err.message);

        await report.update({
          status: "failed",
          error: err.message,
          processing_completed_at: new Date()
        });
      }
    }

    console.log("✅ Report processing cycle finished");

  } catch (err) {
    console.error("❌ Critical error in processPendingReports:", err.message);
  }
};