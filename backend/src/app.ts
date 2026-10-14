import "dotenv/config";
import employeeRoutes from "./routes/employee.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import positionRoutes from "./routes/position.routes.js";

import express from "express";
import helmet from "helmet";
import cors from "cors";
import ipaddr from "ipaddr.js";

import authRoutes from "./routes/auth.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import appraisalRoutes from "./routes/appraisal.routes.js";
import celebrationRoutes from "./routes/celebration.routes.js";
import organogramRoutes from "./routes/organogram.routes.js";
import userRoutes from "./routes/user.routes.js";
import roleRoutes from "./routes/role.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reportRoutes from "./routes/report.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import handbookRoutes from "./routes/handbook.routes.js";
import collaborationRoutes from "./routes/collaboration.routes.js";
import securityRoutes from "./routes/security.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import { auditSuccessfulMutation } from "./middleware/audit.middleware.js";

const app = express();

// Trust only explicitly configured reverse proxies. Do not trust arbitrary X-Forwarded-For headers.
const trustedProxyRanges = (process.env.TRUSTED_PROXY_IPS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
for (const range of trustedProxyRanges) {
  const [address, prefix] = range.includes("/") ? ipaddr.parseCIDR(range) : [ipaddr.parse(range), undefined] as const;
  if (prefix === 0) throw new Error("TRUSTED_PROXY_IPS cannot contain an unrestricted network");
  if (!["unicast", "private", "uniqueLocal"].includes(address.range())) throw new Error("TRUSTED_PROXY_IPS must contain verified unicast proxy addresses");
}
app.set("trust proxy", trustedProxyRanges.length ? trustedProxyRanges : false);

// Security
app.use(helmet());

// CORS
const allowedOrigins = [
  "https://hrm.fluidehomes.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
// Request body parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(auditSuccessfulMutation);

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Fluidé Homes HRM API is running",
    data: {
      service: "fluide-hrm-backend",
      environment: process.env.NODE_ENV || "development",
    },
  });
});

// Authentication routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/leaves", leaveRoutes);
app.use("/api/v1/appraisals", appraisalRoutes);
app.use("/api/v1/celebrations", celebrationRoutes);
app.use("/api/v1/organogram", organogramRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/audit-logs", auditRoutes);
app.use("/api/v1/handbook", handbookRoutes);
app.use("/api/v1/collaboration", collaborationRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/positions", positionRoutes);
app.use("/api/v1/security", securityRoutes);
app.use("/api/v1/payroll", payrollRoutes);
export default app;
