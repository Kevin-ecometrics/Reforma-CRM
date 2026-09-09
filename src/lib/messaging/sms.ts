export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_SMS_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_SMS_NUMBER) {
    return {
      ok: false,
      error: "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_SMS_NUMBER not set in .env.local",
    };
  }

  try {
    // Lazy import: twilio's SDK does filesystem/network setup at import time,
    // no reason to pay that cost when SMS isn't configured.
    const twilio = (await import("twilio")).default;
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({ to, from: TWILIO_FROM_SMS_NUMBER, body });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
