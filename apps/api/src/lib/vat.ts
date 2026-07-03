// PH VAT — 12%, prices are VAT-inclusive (standard for a small retail/food business).
export const VAT_RATE = 0.12;

// Given a VAT-inclusive amount (centavos), returns the VAT portion.
export function vatPortion(amountInclusive: number): number {
  return Math.round(amountInclusive - amountInclusive / (1 + VAT_RATE));
}

// RA 9994 (Senior Citizens) / RA 10754 (PWD) — 20% discount on top of VAT exemption.
// The VAT-inclusive price is first stripped of VAT, then 20% is taken off that
// VAT-exempt amount. Returns the new total (amount actually payable).
export function seniorPwdDiscount(subtotalInclusive: number): { total: number; discountAmount: number } {
  const vatExempt = Math.round(subtotalInclusive / (1 + VAT_RATE));
  const discountAmount = Math.round(vatExempt * 0.2);
  return { total: vatExempt - discountAmount, discountAmount };
}
