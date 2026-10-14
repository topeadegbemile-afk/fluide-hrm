import "dotenv/config";
import app from "./app.js";
import { startBirthdayNotificationScheduler, startPayrollScheduler } from "./services/payroll-scheduler.service.js";

const PORT = process.env.PORT || 5000;
startPayrollScheduler();
startBirthdayNotificationScheduler();

app.listen(PORT, () => {
  console.log(`Fluidé HRM API running on port ${PORT}`);
});
