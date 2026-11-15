import { describe, expect, it } from "vitest";
import {
  amountInWords,
  balanceOf,
  computeTotals,
  formatInvoiceNumber,
  parseFunctions,
  parseTerms,
  resolveTerms,
  round2,
  totalPaid,
} from "./invoices";

const item = (description: string, quantity: number, rate: number) => ({ description, quantity, rate });

describe("computeTotals", () => {
  it("sums quantity × rate and subtracts the discount", () => {
    const result = computeTotals({
      items: [item("Reception coverage", 2, 45000), item("Album", 1, 30000)],
      discount: 2000,
      extra: 0,
    });
    expect(result.subtotal).toBe(120000);
    expect(result.total).toBe(118000);
  });

  it("adds extra charges after the discount", () => {
    const result = computeTotals({
      items: [item("Travel", 1, 1200)],
      discount: 200,
      extra: 500,
    });
    expect(result.total).toBe(1500);
  });

  it("never lets the total go negative", () => {
    const result = computeTotals({
      items: [item("Small shoot", 1, 5000)],
      discount: 8000,
      extra: 0,
    });
    expect(result.subtotal).toBe(5000);
    expect(result.total).toBe(0);
  });

  it("ignores item prices in budget mode", () => {
    const result = computeTotals({
      items: [item("Package A", 1, 50000), item("Package B", 1, 50000)],
      discount: 25000,
      extra: 0,
      budgetAmount: 200000,
      budgetMode: true,
    });
    expect(result.subtotal).toBe(200000);
    expect(result.total).toBe(175000);
  });

  it("falls back to zero when the budget amount is blank", () => {
    const result = computeTotals({
      items: [item("Package", 1, 90000)],
      discount: 0,
      extra: 0,
      budgetAmount: 0,
      budgetMode: true,
    });
    expect(result.total).toBe(0);
  });

  it("keeps two decimal places", () => {
    const result = computeTotals({
      items: [item("Hourly", 3, 333.33)],
      discount: 0,
      extra: 0,
    });
    expect(result.total).toBeCloseTo(999.99, 2);
  });
});

describe("round2", () => {
  it("rounds to paise", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(Number.NaN)).toBe(0);
  });
});

describe("totalPaid / balanceOf", () => {
  const when = new Date("2026-01-01");

  it("adds every payment entry", () => {
    expect(
      totalPaid([
        { amount: 50000, paidAt: when, mode: "UPI", note: "Booking" },
        { amount: 25000, paidAt: when, mode: "CASH", note: "" },
      ]),
    ).toBe(75000);
  });

  it("never reports a negative balance", () => {
    expect(balanceOf(100000, 40000)).toBe(60000);
    expect(balanceOf(100000, 150000)).toBe(0);
  });
});

describe("parseFunctions", () => {
  it("reads a stored schedule including descriptions", () => {
    const raw = JSON.stringify([
      { name: "Tilak", date: "10 Nov 2026", venue: "Residence", desc: "Morning" },
    ]);
    expect(parseFunctions(raw)).toEqual([
      { name: "Tilak", date: "10 Nov 2026", venue: "Residence", desc: "Morning" },
    ]);
  });

  it("drops rows without a name and survives bad JSON", () => {
    expect(parseFunctions(JSON.stringify([{ name: "  " }, { name: "Haldi" }]))).toEqual([
      { name: "Haldi", date: "", venue: "", desc: "" },
    ]);
    expect(parseFunctions("{oops")).toEqual([]);
    expect(parseFunctions(null)).toEqual([]);
  });
});

describe("parseTerms / resolveTerms", () => {
  it("keeps only non-empty lines", () => {
    expect(parseTerms(JSON.stringify(["50% advance", "   ", "Balance on delivery"]))).toEqual([
      "50% advance",
      "Balance on delivery",
    ]);
  });

  it("survives bad JSON", () => {
    expect(parseTerms("{nope")).toEqual([]);
    expect(parseTerms(null)).toEqual([]);
  });

  it("prefers the invoice's own terms over the studio default", () => {
    expect(resolveTerms(JSON.stringify(["Own term"]), JSON.stringify(["Studio term"]))).toEqual([
      "Own term",
    ]);
  });

  it("falls back to the studio default when the invoice has none", () => {
    expect(resolveTerms("[]", JSON.stringify(["Studio term"]))).toEqual(["Studio term"]);
  });
});

describe("formatInvoiceNumber", () => {
  it("builds PREFIX/YEAR/SEQUENCE", () => {
    expect(formatInvoiceNumber({ prefix: "RS", year: 2026, sequence: 1 })).toBe("RS/2026/001");
    expect(formatInvoiceNumber({ prefix: "rs", year: 2026, sequence: 42 })).toBe("RS/2026/042");
  });

  it("drops the prefix when it is blank", () => {
    expect(formatInvoiceNumber({ prefix: null, year: 2026, sequence: 7 })).toBe("2026/007");
  });

  it("strips punctuation and caps the prefix at three letters", () => {
    expect(formatInvoiceNumber({ prefix: "r/s!", year: 2026, sequence: 3 })).toBe("RS/2026/003");
  });
});

describe("amountInWords", () => {
  it("writes Indian numbering", () => {
    expect(amountInWords(295000)).toBe("Two lakh ninety-five thousand rupees only");
  });

  it("handles crores and thousands", () => {
    expect(amountInWords(12500000)).toBe("One crore twenty-five lakh rupees only");
  });

  it("handles small and zero amounts", () => {
    expect(amountInWords(1200)).toBe("One thousand two hundred rupees only");
    expect(amountInWords(0)).toBe("Zero rupees only");
  });
});
