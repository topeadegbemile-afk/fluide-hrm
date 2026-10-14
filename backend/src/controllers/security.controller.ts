import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  approveReplacementRequest, rejectReplacementRequest, getSecuritySettings, listDevices, listMyDevices, listOfficeOptions, listOffices, listReplacementRequests,
  listSecurityEvents, requestDeviceReplacement, revokeDevice, updateAttendanceEnforcement, updateOfficeNetworks, updateOfficeStatus,
} from "../services/security.service.js";

function fail(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("not found") ? 404 : message.includes("Configure approved") || message.includes("Assign an office") ? 409 : message.includes("permission") ? 403 : 400;
  res.status(status).json({ success: false, message, error: "SECURITY_REQUEST_FAILED" });
}

export async function offices(_req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Offices retrieved", data: await listOffices() }); }
  catch (error) { fail(res, error, "Unable to retrieve offices"); }
}
export async function officeOptions(_req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Office options retrieved", data: await listOfficeOptions() }); }
  catch (error) { fail(res, error, "Unable to retrieve office options"); }
}
export async function setOfficeNetworks(req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Office networks updated", data: await updateOfficeNetworks(req.user!.id, req.params.id as string, req.body.approvedNetworks) }); }
  catch (error) { fail(res, error, "Unable to update office networks"); }
}
export async function setOfficeStatus(req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Office status updated", data: await updateOfficeStatus(req.user!.id, req.params.id as string, req.body.isActive) }); }
  catch (error) { fail(res, error, "Unable to update office status"); }
}
export async function settings(_req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Security settings retrieved", data: await getSecuritySettings() }); }
  catch (error) { fail(res, error, "Unable to retrieve security settings"); }
}
export async function setEnforcement(req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Attendance enforcement updated", data: await updateAttendanceEnforcement(req.user!.id, req.body.enabled) }); }
  catch (error) { fail(res, error, "Unable to update attendance enforcement"); }
}
export async function events(_req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Security events retrieved", data: await listSecurityEvents() }); }
  catch (error) { fail(res, error, "Unable to retrieve security events"); }
}
export async function devices(_req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Active devices retrieved", data: await listDevices() }); }
  catch (error) { fail(res, error, "Unable to retrieve devices"); }
}
export async function myDevices(req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Your active devices retrieved", data: await listMyDevices(req.user!.id) }); }
  catch (error) { fail(res, error, "Unable to retrieve devices"); }
}
export async function removeDevice(req: AuthenticatedRequest, res: Response) {
  try { await revokeDevice(req.user!.id, req.params.id as string); res.json({ success: true, message: "Device revoked", data: null }); }
  catch (error) { fail(res, error, "Unable to revoke device"); }
}
export async function replacementRequests(_req: AuthenticatedRequest, res: Response) {
  try { res.json({ success: true, message: "Replacement requests retrieved", data: await listReplacementRequests() }); }
  catch (error) { fail(res, error, "Unable to retrieve replacement requests"); }
}
export async function approveReplacement(req: AuthenticatedRequest, res: Response) {
  try { await approveReplacementRequest(req.user!.id, req.params.id as string); res.json({ success: true, message: "Replacement approved; the old device was revoked", data: null }); }
  catch (error) { fail(res, error, "Unable to approve replacement request"); }
}
export async function rejectReplacement(req: AuthenticatedRequest, res: Response) {
  try { await rejectReplacementRequest(req.user!.id, req.params.id as string); res.json({ success: true, message: "Replacement request rejected", data: null }); }
  catch (error) { fail(res, error, "Unable to reject replacement request"); }
}
export async function createReplacementRequest(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.body.deviceId || typeof req.body.reason !== "string" || req.body.reason.trim().length < 5) throw new Error("Select a device and provide a reason of at least 5 characters");
    res.status(201).json({ success: true, message: "Replacement request submitted", data: await requestDeviceReplacement(req.user!.id, req.body.deviceId, req.body.reason.trim()) });
  } catch (error) { fail(res, error, "Unable to request device replacement"); }
}
