export type ParsedItem = { description: string; quantity: number; rate: number };

/** One ceremony on the invoice schedule (Tilak, Haldi, Wedding …). */
export type InvoiceFunction = { name: string; date: string; venue: string; desc: string };

export type PaymentEntry = { amount: number; paidAt: Date; mode: string; note: string | null };

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK"] as const;

export type TotalsInput = {
  items: ParsedItem[];
  discount: number;
  extra: number;
  /** Flat total typed by the studio; only read when `budgetMode` is on. */
  budgetAmount?: number;
  budgetMode?: boolean;
};

/**
 * Both pricing modes CamTom supports, so a studio can quote item-wise for one
 * client and a flat package price for the next. GST is deliberately absent —
 * PicDeck invoices are not tax documents.
 *
 * - Items mode: qty × rate → minus discount → plus extra.
 * - Budget mode: a flat amount replaces the item sum; the rows stay on the
 *   invoice as an explanation of what the price covers.
 */
export function computeTotals({
  items,
  discount,
  extra,
  budgetAmount = 0,
  budgetMode = false,
}: TotalsInput) {
  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const subtotal = round2(budgetMode ? budgetAmount : itemsTotal);
  const safeDiscount = Math.max(0, round2(discount));
  const safeExtra = Math.max(0, round2(extra));
  const total = Math.max(0, round2(subtotal - safeDiscount + safeExtra));
  return { subtotal, total };
}

/** Rupee values are stored with paise, never float drift. */
export function round2(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function totalPaid(payments: PaymentEntry[]) {
  return round2(payments.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0));
}

export function balanceOf(total: number, advance: number) {
  return round2(Math.max(0, total - advance));
}

/** Reads the `functions` JSON column, tolerating old rows and bad data. */
export function parseFunctions(raw: string | null | undefined): InvoiceFunction[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const name = String(row.name ?? "").trim();
        if (!name) return null;
        return {
          name: name.slice(0, 40),
          date: String(row.date ?? "").trim().slice(0, 40),
          venue: String(row.venue ?? "").trim().slice(0, 60),
          desc: String(row.desc ?? "").trim().slice(0, 120),
        };
      })
      .filter((entry): entry is InvoiceFunction => entry !== null)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/** Reads a stored list of terms lines. Blank entries are dropped. */
export function parseTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => String(entry ?? "").trim().slice(0, 200))
      .filter((entry) => entry.length > 0)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/**
 * Invoice terms are per-document, but a studio almost never rewrites them.
 * An empty stored list means "use the studio default"; a stored list always wins.
 */
export function resolveTerms(invoiceTerms: string | null, studioTerms: string | null) {
  const own = parseTerms(invoiceTerms);
  return own.length > 0 ? own : parseTerms(studioTerms);
}

/** `RS/2026/001` — prefix from settings, year, then a per-studio counter. */
export function formatInvoiceNumber(input: {
  prefix: string | null;
  year: number;
  sequence: number;
}) {
  const prefix = (input.prefix ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const year = String(input.year);
  const sequence = String(Math.max(1, Math.trunc(input.sequence))).padStart(3, "0");
  return prefix ? `${prefix}/${year}/${sequence}` : `${year}/${sequence}`;
}

/**
 * Short unguessable slug for the client-facing link. Only minted when a document
 * is sent, so a link cannot leak a draft that is still being priced.
 */
export function newShareToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A public link only resolves once the document has actually gone to a client. */
export function isPubliclyVisible(invoice: { status: string; shareable: boolean }) {
  return invoice.shareable && (invoice.status === "SENT" || invoice.status === "PAID");
}

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(value: number): string {
  if (value === 0) return "";
  if (value < 20) return ONES[value];
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const rest = value % 10;
    return `${TENS[tens]}${rest ? `-${ONES[rest]}` : ""}`;
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return `${ONES[hundreds]} hundred${rest ? ` ${underThousand(rest)}` : ""}`;
}

/** "Two lakh ninety-five thousand rupees only" — Indian numbering, for invoices. */
export function amountInWords(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "Zero rupees only";

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const rest = rounded % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${underThousand(crore)} crore`);
  if (lakh) parts.push(`${underThousand(lakh)} lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} thousand`);
  if (rest) parts.push(underThousand(rest));

  const words = parts.join(" ").replace(/\s+/g, " ").trim();
  const sentence = `${words} rupees only`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
