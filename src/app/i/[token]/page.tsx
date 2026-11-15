import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { ClientPrintButton } from "@/components/ClientPrintButton";
import { isPubliclyVisible, parseFunctions, resolveTerms } from "@/lib/invoices";
import "../../invoice/[id]/print/invoice.css";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    select: { number: true, clientName: true },
  });
  if (!invoice) return { title: "Document not found — PicDeck" };
  return { title: `${invoice.number} — ${invoice.clientName}` };
}

/**
 * Client-facing invoice. Reachable only through the token minted when the
 * studio marked the document sent; drafts and cancelled documents 404.
 */
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { position: "asc" } },
      event: { select: { title: true } },
      user: true,
    },
  });
  if (!invoice) notFound();
  if (!isPubliclyVisible(invoice)) notFound();

  const studio = invoice.user;

  return (
    <div className="pd-sheet-wrap">
      <div className="pd-sheet-tools">
        <span className="pd-sheet-back">{invoice.number}</span>
        <ClientPrintButton label={invoice.type === "QUOTATION" ? "Save quotation" : "Save invoice"} />
      </div>

      <InvoiceSheet
        studio={studio}
        invoice={{
          id: invoice.id,
          number: invoice.number,
          type: invoice.type,
          status: invoice.status,
          issuedAt: invoice.issuedAt,
          dueAt: invoice.dueAt,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          clientPhone: invoice.clientPhone,
          clientAddress: invoice.clientAddress,
          notes: invoice.notes,
          total: invoice.total,
          advance: invoice.advance,
          eventTitle: invoice.event?.title ?? null,
          functions: parseFunctions(invoice.functions),
          terms: resolveTerms(invoice.terms, studio.invoiceTerms),
          items: invoice.items,
          payments: invoice.payments,
        }}
      />
    </div>
  );
}
