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

export async function sendAccountSetupEmail(email: string, token: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || "hello@fluidehomes.com";

  if (!host || !user || !password || !Number.isFinite(port)) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.");
  }

  const setupUrl = new URL("/set-password", process.env.FRONTEND_URL || "http://localhost:5173");
  setupUrl.searchParams.set("token", token);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: "Your Fluidé Homes account is ready",
    text: `Your Fluidé Homes account has been created.\n\nLogin email: ${email}\nSet your password using this one-time link (expires in 24 hours):\n${setupUrl}\n\nIf you were not expecting this email, contact your HR administrator.`,
    html: `<p>Your Fluidé Homes account has been created.</p><p><strong>Login email:</strong> ${escapeHtml(email)}</p><p><a href="${setupUrl.toString()}">Set your password</a></p><p>This one-time link expires in 24 hours. If you were not expecting this email, contact your HR administrator.</p>`,
  });
}
