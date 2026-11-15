import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { parseFunctions, resolveTerms } from "@/lib/invoices";
import { PlanGate } from "@/components/PlanGate";
import { InvoiceEditor } from "@/components/InvoiceEditor";

export const metadata: Metadata = { title: "Edit invoice — PicDeck" };
export const instant = false;

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("invoices")) return <PlanGate module="invoices" tier={access.tier} />;

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
    <InvoiceEditor
      invoice={{
        id: invoice.id,
        number: invoice.number,
        type: invoice.type,
        status: invoice.status,
        clientName: invoice.clientName,
        clientPhone: invoice.clientPhone,
        clientEmail: invoice.clientEmail,
        clientAddress: invoice.clientAddress,
        discount: invoice.discount,
        extra: invoice.extra,
        budgetMode: invoice.budgetMode,
        budgetAmount: invoice.budgetAmount,
        notes: invoice.notes,
        eventTitle: invoice.event?.title ?? null,
        functions: parseFunctions(invoice.functions),
        terms: resolveTerms(invoice.terms, user.invoiceTerms),
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          rate: String(item.rate),
          group: item.group,
        })),
        payments: invoice.payments.map((payment) => ({
          amount: String(payment.amount),
          paidAt: payment.paidAt.toISOString().slice(0, 10),
          mode: payment.mode,
          note: payment.note ?? "",
        })),
      }}
    />
  );
}
