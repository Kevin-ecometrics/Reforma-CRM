import nodemailer from "nodemailer";

export interface EmailSendInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(input: EmailSendInput): Promise<{ ok: boolean; error?: string }> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return { ok: false, error: "SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM not set in .env.local" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
