import { prisma } from "@blessed-ave/db";

// PH VAT — 12%, prices are VAT-inclusive (standard for a small retail/food business).
export const VAT_RATE = 0.12;

// Business-level toggle (app_settings key "vat_enabled"). Defaults to ON when
// the row doesn't exist. When OFF the business is treated as non-VAT
// registered: no VAT portion is reported and the senior/PWD discount is a
// straight 20% off (no VAT strip first).
export async function isVatEnabled(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "vat_enabled" } });
  return setting ? setting.value === "true" : true;
}

// Given a VAT-inclusive amount (centavos), returns the VAT portion.
export function vatPortion(amountInclusive: number, vatEnabled = true): number {
  if (!vatEnabled) return 0;
  return Math.round(amountInclusive - amountInclusive / (1 + VAT_RATE));
}

// RA 9994 (Senior Citizens) / RA 10754 (PWD) — 20% discount on top of VAT exemption.
// The VAT-inclusive price is first stripped of VAT, then 20% is taken off that
// VAT-exempt amount. Returns the new total (amount actually payable).
// For a non-VAT business (vatEnabled = false) there's no VAT to strip, so the
// 20% comes straight off the subtotal.
export function seniorPwdDiscount(
  subtotalInclusive: number,
  vatEnabled = true
): { total: number; discountAmount: number } {
  const base = vatEnabled ? Math.round(subtotalInclusive / (1 + VAT_RATE)) : subtotalInclusive;
  const discountAmount = Math.round(base * 0.2);
  return { total: base - discountAmount, discountAmount };
}
