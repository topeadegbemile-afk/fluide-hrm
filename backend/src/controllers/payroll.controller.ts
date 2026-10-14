import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  generateMonthlyPayslips,
  getOwnPayrollPayslips,
  getPayrollEmployees,
  getPayrollPayslips,
  savePayrollConfiguration,
  getPayrollStandards,
  savePayrollStandards,
  getPayrollCurrencies,
  addPayrollCurrency,
  saveMonthlyPayrollDeductions,
} from "../services/payroll.service.js";

export async function listEmployees(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = typeof _req.query.period === "string" ? _req.query.period : new Date().toISOString().slice(0, 7);
    res.status(200).json({ success: true, message: "Payroll employees retrieved", data: await getPayrollEmployees(period) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve payroll employees";
    res.status(500).json({ success: false, message, error: "PAYROLL_EMPLOYEES_FETCH_FAILED" });
  }
}

export async function updateMonthlyDeductions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await saveMonthlyPayrollDeductions(req.params.employeeId as string, req.body);
    res.status(200).json({ success: true, message: "Monthly deductions saved", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save monthly deductions";
    const status = message === "Employee not found" ? 404 : 400;
    res.status(status).json({ success: false, message, error: "MONTHLY_DEDUCTIONS_SAVE_FAILED" });
  }
}

export async function listStandards(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try { res.status(200).json({ success: true, message: "Payroll standards retrieved", data: await getPayrollStandards() }); }
  catch { res.status(500).json({ success: false, message: "Unable to retrieve payroll standards", error: "PAYROLL_STANDARDS_FETCH_FAILED" }); }
}

export async function updateStandards(req: AuthenticatedRequest, res: Response): Promise<void> {
  try { res.status(200).json({ success: true, message: "Payroll standards saved", data: await savePayrollStandards(req.body) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to save payroll standards"; res.status(400).json({ success: false, message, error: "PAYROLL_STANDARDS_SAVE_FAILED" }); }
}

export async function listCurrencies(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try { res.status(200).json({ success: true, message: "Payroll currencies retrieved", data: await getPayrollCurrencies() }); }
  catch { res.status(500).json({ success: false, message: "Unable to retrieve payroll currencies", error: "PAYROLL_CURRENCIES_FETCH_FAILED" }); }
}

export async function createCurrency(req: AuthenticatedRequest, res: Response): Promise<void> {
  try { res.status(200).json({ success: true, message: "Payroll currency saved", data: await addPayrollCurrency(req.body.code) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to save payroll currency"; res.status(400).json({ success: false, message, error: "PAYROLL_CURRENCY_SAVE_FAILED" }); }
}

export async function updateConfiguration(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await savePayrollConfiguration(req.params.employeeId as string, req.user!.id, req.body);
    res.status(200).json({ success: true, message: "Payroll configuration saved", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save payroll configuration";
    const status = message === "Employee not found" ? 404 : 400;
    res.status(status).json({ success: false, message, error: "PAYROLL_CONFIGURATION_SAVE_FAILED" });
  }
}

export async function listPayslips(req: AuthenticatedRequest, res: Response): Promise<void> {
  const period = typeof req.query.period === "string" ? req.query.period : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    res.status(400).json({ success: false, message: "Choose a valid payroll month", error: "VALIDATION_ERROR" });
    return;
  }
  try {
    res.status(200).json({ success: true, message: "Payslips retrieved", data: await getPayrollPayslips(period) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve payslips";
    res.status(500).json({ success: false, message, error: "PAYROLL_PAYSLIPS_FETCH_FAILED" });
  }
}

export async function listOwnPayslips(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    res.status(200).json({ success: true, message: "Your payslips retrieved", data: await getOwnPayrollPayslips(req.user!.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve your payslips";
    const status = message.includes("not linked") ? 403 : 500;
    res.status(status).json({ success: false, message, error: status === 403 ? "EMPLOYEE_PROFILE_REQUIRED" : "PAYROLL_PAYSLIPS_FETCH_FAILED" });
  }
}

export async function generatePayslips(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await generateMonthlyPayslips(req.body.period);
    res.status(200).json({ success: true, message: "Monthly payroll processed", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate payslips";
    res.status(400).json({ success: false, message, error: "PAYROLL_GENERATION_FAILED" });
  }
}
