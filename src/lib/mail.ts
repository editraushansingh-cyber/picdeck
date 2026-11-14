/**
 * Transactional email seam.
 *
 * Set RESEND_API_KEY (and optionally MAIL_FROM) to send. Without a provider the
 * notification stays queued and the dashboard shows a mailto: link — the app
 * never pretends an email left the building.
 */
export function mailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export type MailResult = { sent: boolean; detail: string };

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<MailResult> {
  if (!mailConfigured()) {
    return { sent: false, detail: "Email provider not configured (RESEND_API_KEY)" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "PicDeck <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      return { sent: false, detail: `Provider responded ${response.status}` };
    }
    return { sent: true, detail: "Sent" };
  } catch {
    return { sent: false, detail: "Provider unreachable" };
  }
}
