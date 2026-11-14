import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";

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

const inr = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { items: { orderBy: { position: "asc" } }, event: { select: { title: true } } },
  });
  if (!invoice) notFound();

  const halfTax = invoice.taxRate / 2;

  return (
    <div className="min-h-screen bg-surface py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href="/dashboard/invoices" className="text-sm text-muted hover:text-ink">
            ← Back to invoices
          </Link>
          <PrintButton />
        </div>

        <article className="rounded-xl border border-line bg-white p-10 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{user.name}</h1>
              <p className="mt-1 text-xs text-muted">{user.profession}</p>
              {user.city && <p className="text-xs text-muted">{user.city}</p>}
              <p className="mt-2 text-xs text-muted">{user.email}</p>
              <p className="text-xs text-muted">{user.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted">
                {invoice.type === "QUOTATION" ? "Quotation" : "Tax invoice"}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold">{invoice.number}</p>
              <p className="mt-1 text-xs text-muted">
                Issued{" "}
                {invoice.issuedAt.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              {invoice.dueAt && (
                <p className="text-xs text-muted">
                  Due{" "}
                  {invoice.dueAt.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
              <p className="mt-2 inline-block rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {invoice.status}
              </p>
            </div>
          </header>

          <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted">Billed to</p>
              <p className="mt-1.5 font-medium">{invoice.clientName}</p>
              {invoice.clientAddress && (
                <p className="mt-1 whitespace-pre-line text-xs text-muted">{invoice.clientAddress}</p>
              )}
              {invoice.clientEmail && <p className="mt-1 text-xs text-muted">{invoice.clientEmail}</p>}
              {invoice.clientPhone && <p className="text-xs text-muted">{invoice.clientPhone}</p>}
            </div>
            {invoice.event && (
              <div className="sm:text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted">Event</p>
                <p className="mt-1.5 font-medium">{invoice.event.title}</p>
              </div>
            )}
          </section>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-muted">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Rate</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-line/60">
                  <td className="py-2.5 pr-3">{item.description}</td>
                  <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums">{inr(item.rate)}</td>
                  <td className="py-2.5 text-right tabular-nums">{inr(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{inr(invoice.subtotal)}</dd>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Discount</dt>
                  <dd className="tabular-nums">−{inr(invoice.discount)}</dd>
                </div>
              )}
              {invoice.taxRate > 0 && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted">CGST ({halfTax}%)</dt>
                    <dd className="tabular-nums">{inr(invoice.taxAmount / 2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">SGST ({halfTax}%)</dt>
                    <dd className="tabular-nums">{inr(invoice.taxAmount / 2)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{inr(invoice.total)}</dd>
              </div>
            </dl>
          </div>

          {invoice.notes && (
            <div className="mt-8 border-t border-line pt-4">
              <p className="text-[10px] uppercase tracking-widest text-muted">Notes</p>
              <p className="mt-1.5 whitespace-pre-line text-xs text-muted">{invoice.notes}</p>
            </div>
          )}

          <footer className="mt-10 border-t border-line pt-4 text-center text-[10px] text-muted">
            Computer-generated {invoice.type === "QUOTATION" ? "quotation" : "invoice"} · PicDeck
          </footer>
        </article>
      </div>
    </div>
  );
}