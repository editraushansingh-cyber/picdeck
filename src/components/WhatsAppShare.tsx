"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvoiceStatus } from "@/app/actions/invoices";

/**
 * WhatsApp needs the document to be live before the link works, so pressing
 * this marks the document SENT (which mints the public token) and then opens
 * the chat with the link pre-filled.
 */
export function WhatsAppShare({
  invoiceId,
  number,
  type,
  status,
  clientName,
  clientPhone,
  studioName,
  token,
}: {
  invoiceId: string;
  number: string;
  type: string;
  status: string;
  clientName: string;
  clientPhone: string | null;
  studioName: string;
  token: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const gone = status === "SENT" || status === "PAID";

  function open(token: string | null) {
    const phone = (clientPhone ?? "").replace(/\D/g, "");
    if (!phone) return;
    const url = token ? `${window.location.origin}/i/${token}` : "";
    const label = type === "QUOTATION" ? "quotation" : "invoice";
    const message = `Hi ${clientName}, here is ${label} ${number} from ${studioName}.${url ? ` ${url}` : ""}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending || !clientPhone}
        title={clientPhone ? undefined : "Add a client phone number first"}
        onClick={() => {
          // Already sent: reuse the stored token, no round trip needed. On a
          // draft this marks it sent first, which mints the token server-side.
          if (gone && token) {
            open(token);
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await setInvoiceStatus(invoiceId, gone ? status : "SENT");
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
            open(result.token);
          });
        }}
        className="rounded-lg border border-line px-2.5 py-1 font-medium hover:bg-surface disabled:opacity-50"
      >
        {pending ? "Sending…" : "WhatsApp"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
