import { generateMonthlyPayslips } from "./payroll.service.js";
import { notifyTodaysEmployeeCelebrations } from "./birthday.service.js";

export function startPayrollScheduler() {
  let running = false;
  let attemptedPeriod: string | null = null;
  const check = async () => {
    const now = new Date();
    if (running || now.getUTCDate() !== 1 || now.getUTCHours() < 2) return;
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const period = `${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, "0")}`;
    if (attemptedPeriod === period) return;
    running = true;
    try {
      const result = await generateMonthlyPayslips(period);
      attemptedPeriod = period;
      console.info("Automatic monthly payroll processed", result);
    } catch (error) {
      console.error("Automatic monthly payroll failed", error);
    } finally {
      running = false;
    }
  };

  void check();
  const timer = setInterval(() => void check(), 60 * 60 * 1000);
  timer.unref();
}

export function startBirthdayNotificationScheduler() {
  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try {
      const result = await notifyTodaysEmployeeCelebrations();
      if (result.employeesNotified) console.info("Employee celebration notifications delivered", result);
    } catch (error) {
      console.error("Employee celebration notifications failed", error);
    } finally {
      running = false;
    }
  };
  void check();
  const timer = setInterval(() => void check(), 15 * 60 * 1000);
  timer.unref();
}
