const cron = require("node-cron");
const processPendingReports = require("../jobs/processor");
const { Report } = require("../models");

module.exports = function startReportCron() {
  cron.schedule("*/1 * * * *", async () => {
    try {
      console.log("🕒 Running report processor...");
      
     
      const pendingCount = await Report.count({
        where: { status: "pending" }
      });

      if (pendingCount === 0) {
        console.log("📭 No pending reports to process");
        return;
      }

      console.log(`⏳ Found ${pendingCount} pending report(s). Processing...`);
      await processPendingReports();
      console.log("✅ Report processing cycle completed");

    } catch (err) {
      console.error("❌ Error in report processor cron:", err.message);
    }
  });
};