import { describe, expect, it } from "vitest";
import { amountInWords, computeTotals, parseFunctions } from "./invoices";

const item = (description: string, quantity: number, rate: number) => ({ description, quantity, rate });

describe("computeTotals", () => {
  it("adds GST after the discount", () => {
    const result = computeTotals(
      [item("Reception coverage", 2, 45000), item("Album", 1, 30000)],
      18,
      2000,
    );
    expect(result.subtotal).toBe(120000);
    expect(result.taxAmount).toBe(21240);
    expect(result.total).toBe(139240);
  });

  it("rounds tax to two decimals", () => {
    const result = computeTotals([item("Hourly", 3, 333.33)], 18, 0);
    expect(result.subtotal).toBeCloseTo(999.99, 2);
    expect(result.taxAmount).toBe(180);
    expect(result.total).toBe(1179.99);
  });

  it("never taxes a negative amount", () => {
    const result = computeTotals([item("Small shoot", 1, 5000)], 18, 8000);
    expect(result.subtotal).toBe(5000);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("handles a zero-GST invoice", () => {
    const result = computeTotals([item("Travel", 1, 1200)], 0, 0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(1200);
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

describe("parseFunctions", () => {
  it("reads a stored schedule", () => {
    const raw = JSON.stringify([{ name: "Tilak", date: "10 Nov 2026", venue: "Residence" }]);
    expect(parseFunctions(raw)).toEqual([{ name: "Tilak", date: "10 Nov 2026", venue: "Residence" }]);
  });

  it("drops rows without a name and survives bad JSON", () => {
    expect(parseFunctions(JSON.stringify([{ name: "  " }, { name: "Haldi" }]))).toEqual([
      { name: "Haldi", date: "", venue: "" },
    ]);
    expect(parseFunctions("{oops")).toEqual([]);
    expect(parseFunctions(null)).toEqual([]);
  });
});
