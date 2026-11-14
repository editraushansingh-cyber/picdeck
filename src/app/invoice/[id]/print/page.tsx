import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { amountInWords, parseFunctions } from "@/lib/invoices";
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

const inr = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (value: Date) =>
  value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Two-letter mark used when the studio has no logo uploaded. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

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

  const functions = parseFunctions(invoice.functions);
  const isQuote = invoice.type === "QUOTATION";
  const title = isQuote ? "Quotation" : "Invoice";
  const status = invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase();

  const headline = invoice.event?.title?.trim() || invoice.clientName;
  const place = [user.city, user.pinCode].filter(Boolean).join(" ").trim();
  const addressLines = [user.address, [user.city, user.pinCode].filter(Boolean).join(" ")]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  // When the event title takes the headline, the client is named in the strapline.
  const strapline = invoice.event?.title?.trim()
    ? `${isQuote ? "Prepared for" : "Billed to"} ${invoice.clientName}${place ? ` · ${place}` : ""}`
    : place;

  // A long schedule or item list would push the footer onto a second sheet.
  const dense = invoice.items.length > 7 || functions.length > 5;

  return (
    <div className="pd-sheet-wrap">
      <div className="pd-sheet-tools">
        <Link href={`/dashboard/invoices/${invoice.id}`} className="pd-sheet-back">
          ← Back to invoice
        </Link>
        <PrintButton />
      </div>

      <article className={`pd-sheet${dense ? " pd-dense" : ""}`}>
        <header className="pd-sheet-head">
          <div className="pd-brand">
            {user.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/studio-logo/${user.id}`}
                alt={`${user.name} logo`}
                className="pd-logo"
              />
            ) : (
              <span className="pd-mark">{initialsOf(user.name)}</span>
            )}
            <div>
              <h1 className="pd-studio">{user.name}</h1>
              <p className="pd-tagline">{user.profession}</p>
              <address className="pd-contact">
                {addressLines.length > 0 && (
                  <>
                    {addressLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                    <br />
                  </>
                )}
                <b>{user.phone}</b>
                {user.email && (
                  <>
                    {" "}
                    · {user.email}
                  </>
                )}
                {user.website && (
                  <>
                    {" "}
                    · {user.website}
                  </>
                )}
              </address>
            </div>
          </div>
          <div className="pd-doc">
            <p className="pd-kicker">{isQuote ? "Quotation" : "Invoice"}</p>
            <p className="pd-number">{invoice.number}</p>
            <span className="pd-status">{status}</span>
          </div>
        </header>

        <section className="pd-hero">
          <h2>
            {title} for <strong>{headline}</strong>
          </h2>
          <p className="pd-sub">{strapline}</p>
        </section>

        {functions.length > 0 && (
          <section
            className={`pd-functions cols-${
              functions.length >= 7 ? 4 : functions.length === 6 ? 3 : 5
            }`}
          >
            {functions.map((row) => (
              <div className="pd-fn" key={`${row.name}-${row.date}`}>
                <p className="pd-fn-name">{row.name}</p>
                <p className="pd-fn-date">{row.date || "—"}</p>
                {row.venue && <p className="pd-fn-venue">{row.venue}</p>}
              </div>
            ))}
          </section>
        )}

        <section className="pd-cards">
          <div className="pd-card">
            <p className="pd-kicker">Billed to</p>
            <p className="pd-card-name">{invoice.clientName}</p>
            {invoice.clientAddress && (
              <p className="pd-card-line">{invoice.clientAddress}</p>
            )}
            {invoice.clientEmail && <p className="pd-card-line muted">{invoice.clientEmail}</p>}
            {invoice.clientPhone && <p className="pd-card-line muted">{invoice.clientPhone}</p>}
          </div>
          <div className="pd-card">
            <p className="pd-kicker">{isQuote ? "Prepared on" : "Invoice date"}</p>
            <p className="pd-card-name">{shortDate(invoice.issuedAt)}</p>
            {invoice.dueAt && (
              <p className="pd-card-line">
                <span className="muted">Due</span> {shortDate(invoice.dueAt)}
              </p>
            )}
            <p className="pd-card-line muted">{invoice.number}</p>
          </div>
          <div className="pd-card">
            <p className="pd-kicker">Coverage</p>
            <p className="pd-card-name">
              {functions.length > 0
                ? `${functions.length} ${functions.length === 1 ? "function" : "functions"}`
                : `${invoice.items.length} ${invoice.items.length === 1 ? "item" : "items"}`}
            </p>
            {functions.length > 0 && (
              <p className="pd-card-line muted">
                {invoice.items.length} {invoice.items.length === 1 ? "line item" : "line items"}
              </p>
            )}
            {invoice.event?.title && <p className="pd-card-line muted">{invoice.event.title}</p>}
          </div>
        </section>

        <section className="pd-items">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="r">Qty</th>
                <th className="r">Rate</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td className="r num">{item.quantity}</td>
                  <td className="r num">{inr(item.rate)}</td>
                  <td className="r num strong">{inr(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="pd-pay">
          <div className="pd-bank">
            <p className="pd-kicker">Payment details</p>
            {user.upiId && (
              <div className="pd-row">
                <span>UPI</span>
                <span>{user.upiId}</span>
              </div>
            )}
            <div className="pd-row">
              <span>Account name</span>
              <span>{user.name}</span>
            </div>
            {user.bankAccount && (
              <div className="pd-row">
                <span>{user.ifsc ? "A/C · IFSC" : "Account no."}</span>
                <span>
                  {user.bankAccount}
                  {user.ifsc ? ` · ${user.ifsc}` : ""}
                </span>
              </div>
            )}
            <div className="pd-row">
              <span>{isQuote ? "Reference" : "Invoice no."}</span>
              <span>{invoice.number}</span>
            </div>
          </div>

          <div className="pd-totals">
            <div className="pd-row">
              <span>Subtotal</span>
              <span className="num">{inr(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="pd-row">
                <span>Discount</span>
                <span className="num">−{inr(invoice.discount)}</span>
              </div>
            )}
            <div className="pd-total-bar">
              <span>{isQuote ? "Total quote" : "Total payable"}</span>
              <span className="num">{inr(invoice.total)}</span>
            </div>
          </div>
        </section>

        <section className="pd-words">
          <p className="pd-kicker">Amount in words</p>
          <p>{amountInWords(invoice.total)}</p>
        </section>

        {invoice.notes && (
          <section className="pd-notes">
            <p className="pd-kicker">Notes</p>
            <p>{invoice.notes}</p>
          </section>
        )}

        <footer className="pd-foot">
          <div className="pd-foot-msg">
            {invoice.dueAt && !isQuote ? (
              <p>
                Payment due by <b>{shortDate(invoice.dueAt)}</b>.
              </p>
            ) : (
              <p>
                Thank you for choosing <b>{user.name}</b>.
              </p>
            )}
            <p className="pd-gen">
              Computer-generated {isQuote ? "quotation" : "invoice"} · PicDeck
            </p>
          </div>
          <div className="pd-sign">
            <div className="pd-sign-line" />
            <p className="pd-sign-name">{user.name}</p>
            <p className="pd-kicker tiny">Authorised signatory</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
