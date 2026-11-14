export type ParsedItem = { description: string; quantity: number; rate: number };

export function computeTotals(items: ParsedItem[], taxRate: number, discount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, total };
}
