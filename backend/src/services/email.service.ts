import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password || !Number.isFinite(port)) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.");
  }
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
}

function getEmailSender() {
  const configuredSender = process.env.SMTP_FROM || "hello@fluidehomes.com";
  const mailbox = configuredSender.match(/<([^<>]+)>/)?.[1] ?? configuredSender;
  return `Fluidé Homes Workspace <${mailbox.trim()}>`;
}

function createPayslipPdf(payslip: {
  employeeName: string;
  employeeNumber: string;
  period: string;
  currency: string;
  basicSalary: string;
  benefits: { name: string; amount: string }[];
  grossPay: string;
  deductions: { name: string; amount: string }[];
  totalDeductions: string;
  netPay: string;
}) {
  const format = (value: string) => `${payslip.currency} ${new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;
  const lines = [
    "FLUIDE HOMES - PAYSLIP", `Period: ${payslip.period}`, `Employee: ${payslip.employeeName}`,
    `Employee number: ${payslip.employeeNumber}`, "", "EARNINGS", `Basic salary: ${format(payslip.basicSalary)}`,
    ...payslip.benefits.map((item) => `${item.name}: ${format(item.amount)}`), `Gross earnings: ${format(payslip.grossPay)}`,
    "", "DEDUCTIONS", ...payslip.deductions.map((item) => `${item.name}: -${format(item.amount)}`),
    `Total deductions: ${format(payslip.totalDeductions)}`, "", `NET PAY: ${format(payslip.netPay)}`,
  ];
  const escapePdf = (value: string) => value.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, "\\$&");
  const commands = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL", ...lines.flatMap((line, index) => index === 0 ? [`(${escapePdf(line)}) Tj`] : ["T*", `(${escapePdf(line)}) Tj`]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(commands, "ascii")} >>\nstream\n${commands}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}

export async function sendAccountSetupEmail(email: string, token: string) {
  const from = getEmailSender();

  const setupUrl = new URL("/set-password", process.env.FRONTEND_URL || "http://localhost:5173");
  setupUrl.searchParams.set("token", token);

  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: email,
    subject: "Your Fluidé Homes account is ready",
    text: `Your Fluidé Homes account has been created.\n\nLogin email: ${email}\nSet your password using this one-time link (expires in 24 hours):\n${setupUrl}\n\nIf you were not expecting this email, contact your HR administrator.`,
    html: `<p>Your Fluidé Homes account has been created.</p><p><strong>Login email:</strong> ${escapeHtml(email)}</p><p><a href="${setupUrl.toString()}">Set your password</a></p><p>This one-time link expires in 24 hours. If you were not expecting this email, contact your HR administrator.</p>`,
  });
}

export async function sendPolicyAnnouncementEmail(
  email: string,
  firstName: string | null,
  policy: { id: string; title: string; summary: string | null },
) {
  const from = getEmailSender();
  const policyUrl = new URL("/policy", process.env.FRONTEND_URL || "http://localhost:5173");
  policyUrl.searchParams.set("article", policy.id);
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const preview = policy.summary?.trim();
  const safeTitle = escapeHtml(policy.title);
  const safeGreeting = escapeHtml(greeting);
  const safePreview = preview ? `<p>${escapeHtml(preview)}</p>` : "";
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: email,
    subject: `New policy: ${policy.title}`,
    text: `${greeting}\n\nA new company policy has been published: ${policy.title}.${preview ? `\n\n${preview}` : ""}\n\nPlease review it in your Fluidé Homes dashboard:\n${policyUrl}\n\nThank you,\nFluidé Homes People. Appraisals. Progress.`,
    html: `<div style="font-family:Arial,sans-serif;color:#262626;line-height:1.6;max-width:600px;margin:auto"><p>${safeGreeting}</p><p>A new company policy has been published and is ready for you to review.</p><div style="background:#f6f4fa;border-radius:12px;padding:20px;margin:24px 0"><p style="margin:0 0 8px;color:#6f42c1;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">NEW POLICY</p><h1 style="font-size:22px;line-height:1.3;margin:0">${safeTitle}</h1>${safePreview}</div><p><a href="${policyUrl.toString()}" style="display:inline-block;background:#6f42c1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View policy in your dashboard</a></p><p>Thank you,<br/>Fluidé Homes People. Appraisals. Progress.</p></div>`,
  });
}

export async function sendPayslipEmail(payslip: {
  id: string;
  employeeName: string;
  employeeNumber: string;
  recipientEmail: string;
  recipientEmails?: string[];
  period: string;
  currency: string;
  basicSalary: string;
  benefits: { name: string; amount: string }[];
  grossPay: string;
  deductions: { name: string; amount: string }[];
  totalDeductions: string;
  netPay: string;
}) {
  const from = getEmailSender();
  const transporter = createTransporter();
  const format = (value: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency: payslip.currency }).format(Number(value));
  const safeName = escapeHtml(payslip.employeeName);
  const benefitsRows = payslip.benefits.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:right">${format(item.amount)}</td></tr>`).join("");
  const deductionRows = payslip.deductions.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:right">${format(item.amount)}</td></tr>`).join("");
  const payslipUrl = new URL("/payroll", process.env.FRONTEND_URL || "http://localhost:5173");
  const breakdown = [
    `Basic salary: ${format(payslip.basicSalary)}`,
    ...payslip.benefits.map((item) => `${item.name}: ${format(item.amount)}`),
    `Gross salary: ${format(payslip.grossPay)}`,
    ...payslip.deductions.map((item) => `${item.name}: -${format(item.amount)}`),
    `Total deductions: ${format(payslip.totalDeductions)}`,
    `Net pay: ${format(payslip.netPay)}`,
  ].join("\n");

  await transporter.sendMail({
    from,
    to: payslip.recipientEmails?.length ? payslip.recipientEmails : payslip.recipientEmail,
    subject: `Your payslip for ${payslip.period}`,
    attachments: [{ filename: `payslip-${payslip.period}-${payslip.employeeNumber}.pdf`, content: createPayslipPdf(payslip), contentType: "application/pdf" }],
    text: `Hi ${payslip.employeeName},\n\nYour payslip for ${payslip.period} is ready.\nEmployee number: ${payslip.employeeNumber}\n\n${breakdown}\n\nView and print your payslip securely in Fluidé Homes HRM:\n${payslipUrl}\n\nPeople. Appraisals. Progress.`,
    html: `<div style="font-family:Arial,sans-serif;color:#263249;line-height:1.6;max-width:620px;margin:auto"><p>Hi ${safeName},</p><p>Your payslip for <strong>${escapeHtml(payslip.period)}</strong> is ready.</p><p style="color:#667085;font-size:13px">Employee number: ${escapeHtml(payslip.employeeNumber)}</p><table style="width:100%;border-collapse:collapse;margin:18px 0"><tbody><tr><td style="padding:9px;border-bottom:1px solid #e5e7eb">Basic salary</td><td style="padding:9px;border-bottom:1px solid #e5e7eb;text-align:right">${format(payslip.basicSalary)}</td></tr>${benefitsRows}<tr><td style="padding:9px;border-top:1px solid #d0d5dd;font-weight:bold">Gross salary</td><td style="padding:9px;border-top:1px solid #d0d5dd;text-align:right;font-weight:bold">${format(payslip.grossPay)}</td></tr>${deductionRows}<tr><td style="padding:9px;border-top:1px solid #d0d5dd">Total deductions</td><td style="padding:9px;border-top:1px solid #d0d5dd;text-align:right">${format(payslip.totalDeductions)}</td></tr><tr><td style="padding:12px;border-top:2px solid #263249;font-size:18px;font-weight:bold">Net pay</td><td style="padding:12px;border-top:2px solid #263249;text-align:right;font-size:18px;font-weight:bold">${format(payslip.netPay)}</td></tr></tbody></table><p><a href="${payslipUrl.toString()}" style="display:inline-block;background:#6f42c1;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:bold">View and print payslip</a></p><p>People. Appraisals. Progress.</p></div>`,
  });
}

export async function sendEmployeeInformationReviewEmail(input: {
  email: string;
  firstName: string;
  status: "APPROVED" | "REJECTED";
  comment?: string | null;
}) {
  const from = getEmailSender();
  const transporter = createTransporter();
  const approved = input.status === "APPROVED";
  const subject = `Your employee information was ${approved ? "approved" : "returned for updates"}`;
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hello,";
  const details = input.comment?.trim() ? `\n\nHR comment: ${input.comment.trim()}` : "";
  const safeGreeting = escapeHtml(greeting);
  const safeComment = input.comment?.trim() ? `<p><strong>HR comment:</strong> ${escapeHtml(input.comment.trim())}</p>` : "";
  const statusText = approved ? "Your employee information has been reviewed and approved." : "Your employee information was reviewed and needs updates. Please review the HR comment and update your information in the dashboard.";
  const personalInfoUrl = new URL("/my-information", process.env.FRONTEND_URL || "http://localhost:5173");
  await transporter.sendMail({
    from,
    to: input.email,
    subject,
    text: `${greeting}\n\n${statusText}${details}\n\nView your information: ${personalInfoUrl}\n\nFluidé Homes People. Appraisals. Progress.`,
    html: `<div style="font-family:Arial,sans-serif;color:#263249;line-height:1.6;max-width:600px;margin:auto"><p>${safeGreeting}</p><p>${statusText}</p>${safeComment}<p><a href="${personalInfoUrl.toString()}" style="display:inline-block;background:#263a68;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:bold">View my information</a></p><p>Fluidé Homes People. Appraisals. Progress.</p></div>`,
  });
}
