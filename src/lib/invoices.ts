export type ParsedItem = { description: string; quantity: number; rate: number };

/** One ceremony on the invoice schedule (Tilak, Haldi, Wedding …). */
export type InvoiceFunction = { name: string; date: string; venue: string };

export function computeTotals(items: ParsedItem[], taxRate: number, discount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, total };
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
        };
      })
      .filter((entry): entry is InvoiceFunction => entry !== null)
      .slice(0, 8);
  } catch {
    return [];
  }
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
