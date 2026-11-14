import { describe, expect, it } from "vitest";
import { computeTotals } from "./invoices";

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