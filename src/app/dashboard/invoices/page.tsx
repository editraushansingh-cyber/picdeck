import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { ModuleHeader, PlanGate } from "@/components/PlanGate";
import { InvoiceComposer, InvoiceList, type InvoiceRowData } from "@/components/InvoicePanels";

export const metadata: Metadata = { title: "Invoices — PicDeck" };
export const instant = false;

export default async function InvoicesPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("invoices")) return <PlanGate module="invoices" tier={access.tier} />;

  const [invoices, events] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } }, event: { select: { title: true } } },
    }),
    prisma.event.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  const rows: InvoiceRowData[] = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    type: invoice.type,
    status: invoice.status,
    clientName: invoice.clientName,
    clientPhone: invoice.clientPhone,
    eventTitle: invoice.event?.title ?? null,
    items: invoice._count.items,
    total: invoice.total,
    advance: invoice.advance,
    publicToken: invoice.publicToken,
    issuedAt: invoice.issuedAt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  }));

  // Collected means money actually received (the payment log), not invoice totals.
  const paid = invoices.reduce((sum, i) => sum + i.advance, 0);
  const open = invoices
    .filter((i) => i.status === "SENT" || i.status === "DRAFT")
    .reduce((sum, i) => sum + Math.max(0, i.total - i.advance), 0);

  return (
    <div>
      <ModuleHeader
        title="Invoices & quotations"
        subtitle={`₹${paid.toLocaleString("en-IN")} collected · ₹${open.toLocaleString("en-IN")} pending`}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <InvoiceComposer events={events} />
        <div>
          <h2 className="mb-3 font-medium">Saved documents</h2>
          <InvoiceList invoices={rows} studioName={user.name} />
        </div>
      </div>
    </div>
  );
}