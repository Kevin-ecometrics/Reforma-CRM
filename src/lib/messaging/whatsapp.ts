const FB_API_VERSION = "v26.0";

export interface WhatsappSendResult {
  ok: boolean;
  error?: string;
}

async function postWhatsappMessage(payload: Record<string, unknown>): Promise<WhatsappSendResult> {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return {
      ok: false,
      error: "WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set in .env",
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

// Free-form text message. Meta only delivers this within the 24-hour
// customer service window (i.e. the lead messaged us recently) — outside
// that window the API still returns success with a message id, but the
// message is silently never delivered. For anything that initiates contact
// (e.g. a new lead's first message), use sendWhatsappTemplate() instead.
export async function sendWhatsapp(to: string, body: string): Promise<WhatsappSendResult> {
  const toDigitsOnly = to.replace(/[^\d]/g, "");
  return postWhatsappMessage({
    messaging_product: "whatsapp",
    to: toDigitsOnly,
    type: "text",
    text: { body },
  });
}

// Sends a pre-approved WhatsApp Message Template — works outside the 24-hour
// window, so it's the only reliable way to reach a lead who hasn't messaged
// us first. The template must already exist and be Approved under
// WhatsApp > Message Templates in Meta Business Manager before this will
// work; templateName/languageCode must match it exactly. bodyParams fills in
// the template's {{1}}, {{2}}... placeholders in order, if it has any.
export async function sendWhatsappTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = []
): Promise<WhatsappSendResult> {
  const toDigitsOnly = to.replace(/[^\d]/g, "");
  return postWhatsappMessage({
    messaging_product: "whatsapp",
    to: toDigitsOnly,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParams.length
        ? {
            components: [
              {
                type: "body",
                parameters: bodyParams.map((text) => ({ type: "text", text })),
              },
            ],
          }
        : {}),
    },
  });
}
