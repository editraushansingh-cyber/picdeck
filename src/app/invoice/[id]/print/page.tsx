import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { parseFunctions, resolveTerms } from "@/lib/invoices";
import "./invoice.css";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: invoice ? `${invoice.number} — PicDeck` : "Invoice — PicDeck" };
}

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { position: "asc" } },
      event: { select: { title: true } },
    },
  });
  if (!invoice) notFound();

  return (
    <div className="pd-sheet-wrap">
      <div className="pd-sheet-tools">
        <Link href={`/dashboard/invoices/${invoice.id}`} className="pd-sheet-back">
          ← Back to invoice
        </Link>
        <PrintButton />
      </div>

      <InvoiceSheet
        studio={user}
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
          terms: resolveTerms(invoice.terms, user.invoiceTerms),
          items: invoice.items,
          payments: invoice.payments,
        }}
      />
    </div>
  );
}
