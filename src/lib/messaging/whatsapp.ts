const FB_API_VERSION = "v26.0";

// Meta WhatsApp Cloud API. Free-form text messages only work within the
// 24-hour customer service window (i.e. the lead messaged us recently).
// Reminders sent outside that window require a pre-approved Message
// Template — see docs/facebook-setup.md.
export async function sendWhatsapp(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return {
      ok: false,
      error: "WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set in .env.local",
    };
  }

  const toDigitsOnly = to.replace(/[^\d]/g, "");

  try {
    const res = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toDigitsOnly,
          type: "text",
          text: { body },
        }),
      }
    );
    const json = await res.json().catch(() => undefined);

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(json)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
