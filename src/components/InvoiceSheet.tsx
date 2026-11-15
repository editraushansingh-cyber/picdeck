import { amountInWords, balanceOf, type InvoiceFunction } from "@/lib/invoices";

export type SheetStudio = {
  id: string;
  name: string;
  profession: string;
  phone: string;
  email: string;
  website: string | null;
  address: string | null;
  city: string | null;
  pinCode: string | null;
  logoPath: string | null;
  upiId: string | null;
  bankAccount: string | null;
  ifsc: string | null;
};

export type SheetInvoice = {
  id: string;
  number: string;
  type: string;
  status: string;
  issuedAt: Date;
  dueAt: Date | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  notes: string | null;
  total: number;
  advance: number;
  eventTitle: string | null;
  functions: InvoiceFunction[];
  terms: string[];
  items: { id: string; group: string; description: string; quantity: number; rate: number; amount: number }[];
  payments: { id: string; amount: number; paidAt: Date; mode: string; note: string | null }[];
};

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

/** Groups items in the order they first appear, keeping each group's rows together. */
function groupItems(items: SheetInvoice["items"]) {
  const groups: { name: string; items: SheetInvoice["items"]; amount: number }[] = [];
  for (const item of items) {
    const name = item.group?.trim() || "Deliverables";
    let bucket = groups.find((group) => group.name === name);
    if (!bucket) {
      bucket = { name, items: [], amount: 0 };
      groups.push(bucket);
    }
    bucket.items.push(item);
    bucket.amount += item.amount;
  }
  return groups;
}

/**
 * The printable invoice sheet. Shared by the studio's print view and the public
 * link the client opens, so a sent invoice looks identical to the saved PDF.
 */
export function InvoiceSheet({ studio, invoice }: { studio: SheetStudio; invoice: SheetInvoice }) {
  const isQuote = invoice.type === "QUOTATION";
  const title = isQuote ? "Quotation" : "Invoice";
  const status = invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase();

  const groups = groupItems(invoice.items);
  const balance = balanceOf(invoice.total, invoice.advance);

  const headline = invoice.eventTitle?.trim() || invoice.clientName;
  const place = [studio.city, studio.pinCode].filter(Boolean).join(" ").trim();
  const addressLines = [studio.address, place]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  // When the event title takes the headline, the client is named in the strapline.
  const strapline = invoice.eventTitle?.trim()
    ? `${isQuote ? "Prepared for" : "Billed to"} ${invoice.clientName}${place ? ` · ${place}` : ""}`
    : place;

  // A long schedule, many item rows or a terms list would push the footer onto a
  // second sheet, so the type tightens up.
  const dense =
    invoice.items.length > 7 ||
    invoice.functions.length > 5 ||
    groups.length > 3 ||
    invoice.terms.length > 4;

  // Without UPI or a bank account there is nothing to pay into, so the card is
  // dropped rather than printed as an empty box.
  const hasPaymentDetails = Boolean(studio.upiId || studio.bankAccount);

  return (
    <article className={`pd-sheet${dense ? " pd-dense" : ""}`}>
      <header className="pd-sheet-head">
        <div className="pd-brand">
          {studio.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/studio-logo/${studio.id}`} alt={`${studio.name} logo`} className="pd-logo" />
          ) : (
            <span className="pd-mark">{initialsOf(studio.name)}</span>
          )}
          <div>
            <h1 className="pd-studio">{studio.name}</h1>
            <p className="pd-tagline">{studio.profession}</p>
            <address className="pd-contact">
              {addressLines.length > 0 && (
                <>
                  {addressLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  <br />
                </>
              )}
              <b>{studio.phone}</b>
              {studio.email && (
                <>
                  {" "}
                  · {studio.email}
                </>
              )}
              {studio.website && (
                <>
                  {" "}
                  · {studio.website}
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

      {invoice.functions.length > 0 && (
        <section
          className={`pd-functions cols-${
            invoice.functions.length >= 7 ? 4 : invoice.functions.length === 6 ? 3 : 5
          }`}
        >
          {invoice.functions.map((row) => (
            <div className="pd-fn" key={`${row.name}-${row.date}`}>
              <p className="pd-fn-name">{row.name}</p>
              <p className="pd-fn-date">{row.date || "—"}</p>
              {row.venue && <p className="pd-fn-venue">{row.venue}</p>}
              {row.desc && <p className="pd-fn-desc">{row.desc}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="pd-cards">
        <div className="pd-card">
          <p className="pd-kicker">Billed to</p>
          <p className="pd-card-name">{invoice.clientName}</p>
          {invoice.clientAddress && <p className="pd-card-line">{invoice.clientAddress}</p>}
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
            {invoice.functions.length > 0
              ? `${invoice.functions.length} ${invoice.functions.length === 1 ? "function" : "functions"}`
              : `${invoice.items.length} ${invoice.items.length === 1 ? "item" : "items"}`}
          </p>
          {invoice.functions.length > 0 && (
            <p className="pd-card-line muted">
              {invoice.items.length} {invoice.items.length === 1 ? "line item" : "line items"}
            </p>
          )}
          {invoice.eventTitle && <p className="pd-card-line muted">{invoice.eventTitle}</p>}
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
          {groups.map((group) => (
            <tbody key={group.name} className="pd-group">
              <tr className="pd-group-head">
                <th colSpan={4}>{group.name}</th>
              </tr>
              {group.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td className="r num">{item.quantity}</td>
                  <td className="r num">{inr(item.rate)}</td>
                  <td className="r num strong">{inr(item.amount)}</td>
                </tr>
              ))}
              {groups.length > 1 && (
                <tr className="pd-group-sub">
                  <td colSpan={3}>{group.name} subtotal</td>
                  <td className="r num">{inr(group.amount)}</td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </section>

      <section className={`pd-pay${hasPaymentDetails ? "" : " pd-pay-narrow"}`}>
        {hasPaymentDetails && (
          <div className="pd-bank">
            <p className="pd-kicker">Payment details</p>
            {studio.upiId && (
              <div className="pd-row">
                <span>UPI</span>
                <span>{studio.upiId}</span>
              </div>
            )}
            <div className="pd-row">
              <span>Account name</span>
              <span>{studio.name}</span>
            </div>
            {studio.bankAccount && (
              <div className="pd-row">
                <span>{studio.ifsc ? "A/C · IFSC" : "Account no."}</span>
                <span>
                  {studio.bankAccount}
                  {studio.ifsc ? ` · ${studio.ifsc}` : ""}
                </span>
              </div>
            )}
            <div className="pd-row">
              <span>{isQuote ? "Reference" : "Invoice no."}</span>
              <span>{invoice.number}</span>
            </div>
          </div>
        )}

        <div className="pd-totals">
          <div className="pd-total-bar">
            <span>{isQuote ? "Total quote" : "Total"}</span>
            <span className="num">{inr(invoice.total)}</span>
          </div>
          {invoice.advance > 0 && (
            <>
              <div className="pd-row">
                <span>Advance received</span>
                <span className="num">{inr(invoice.advance)}</span>
              </div>
              <div className="pd-row pd-balance">
                <span>Balance due</span>
                <span className="num">{inr(balance)}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="pd-words">
        <p className="pd-kicker">Amount in words</p>
        <p>{amountInWords(invoice.total)}</p>
      </section>

      {/* One advance is already covered by the TOTAL → ADVANCE → BALANCE block;
          a longer log only appears when there is more than one receipt. */}
      {invoice.payments.length > 1 && (
        <section className="pd-payments">
          <p className="pd-kicker">Payments</p>
          <ul>
            {invoice.payments.map((payment) => (
              <li key={payment.id}>
                <span className="num">{inr(payment.amount)}</span>
                <span>{shortDate(payment.paidAt)}</span>
                <span className="muted">{payment.mode}</span>
                {payment.note && <span className="muted">{payment.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.notes && (
        <section className="pd-notes">
          <p className="pd-kicker">Notes</p>
          <p>{invoice.notes}</p>
        </section>
      )}

      {invoice.terms.length > 0 && (
        <section className="pd-terms">
          <p className="pd-kicker">Terms &amp; conditions</p>
          <ol>
            {invoice.terms.map((term, index) => (
              <li key={`${index}-${term.slice(0, 12)}`}>{term}</li>
            ))}
          </ol>
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
              Thank you for choosing <b>{studio.name}</b>.
            </p>
          )}
          <p className="pd-gen">Computer-generated {isQuote ? "quotation" : "invoice"} · PicDeck</p>
        </div>
        <div className="pd-sign">
          <div className="pd-sign-line" />
          <p className="pd-sign-name">{studio.name}</p>
          <p className="pd-kicker tiny">Authorised signatory</p>
        </div>
      </footer>
    </article>
  );
}
