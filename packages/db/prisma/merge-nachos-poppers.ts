import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// Nachos: Small/Large -> "Size" modifier
const SIZE_PAIRS: [string, string, string][] = [
  ["Nachos (Small)", "Nachos (Large)", "Nachos"],
];

// Poppers: "with fries" (base) / "with rice" (alt) -> "Side" modifier
// [friesName, riceName, mergedName]
const SIDE_PAIRS: [string, string, string][] = [
  ["Poppers (Plain) with fries", "Poppers (Plain) with rice", "Poppers (Plain)"],
  ["Poppers (B) with fries", "Poppers (Buffalo) with Rice", "Poppers (Buffalo)"],
  ["Poppers (HM) with Fries", "Poppers (HM) with Rice", "Poppers (Honey Mustard)"],
  ["Poppers (HS) with Fries", "Poppers (HS) with Rice", "Poppers (Honey Sriracha)"],
  ["Poppers (G) with Fries", "Poppers (Garlic) with Rice", "Poppers (Garlic)"],
];

async function mergeSize(smallName: string, largeName: string, mergedName: string) {
  const small = await prisma.menuItem.findFirst({ where: { name: smallName }, include: { modifierGroups: true } });
  const large = await prisma.menuItem.findFirst({ where: { name: largeName } });
  if (!small || !large) {
    console.log(`Skip ${mergedName}: missing item(s) — small=${!!small} large=${!!large}`);
    return;
  }
  if (small.modifierGroups.some((g) => g.name === "Size")) {
    console.log(`Skip ${mergedName}: already has Size group`);
    return;
  }
  const priceDiff = large.price - small.price;
  await prisma.menuItem.update({
    where: { id: small.id },
    data: {
      name: mergedName,
      modifierGroups: {
        create: {
          name: "Size",
          required: true,
          multiSelect: false,
          sortOrder: 0,
          options: {
            create: [
              { name: "Small", priceAdjustment: 0 },
              { name: "Large", priceAdjustment: priceDiff },
            ],
          },
        },
      },
    },
  });
  await prisma.orderItem.updateMany({ where: { menuItemId: large.id }, data: { menuItemId: small.id } });
  await prisma.recipeItem.deleteMany({ where: { menuItemId: large.id } });
  await prisma.menuItem.delete({ where: { id: large.id } });
  console.log(`Merged ${mergedName}: base=₱${(small.price / 100).toFixed(2)}, Large +₱${(priceDiff / 100).toFixed(2)}`);
}

async function mergeSide(friesName: string, riceName: string, mergedName: string) {
  const rice = await prisma.menuItem.findFirst({ where: { name: riceName }, include: { modifierGroups: true } });
  const fries = await prisma.menuItem.findFirst({ where: { name: friesName } });
  if (!rice || !fries) {
    console.log(`Skip ${mergedName}: missing item(s) — rice=${!!rice} fries=${!!fries}`);
    return;
  }
  if (rice.modifierGroups.some((g) => g.name === "Side")) {
    console.log(`Skip ${mergedName}: already has Side group`);
    return;
  }
  const priceDiff = fries.price - rice.price;
  await prisma.menuItem.update({
    where: { id: rice.id },
    data: {
      name: mergedName,
      modifierGroups: {
        create: {
          name: "Side",
          required: true,
          multiSelect: false,
          sortOrder: 0,
          options: {
            create: [
              { name: "Rice", priceAdjustment: 0 },
              { name: "Fries", priceAdjustment: priceDiff },
            ],
          },
        },
      },
    },
  });
  await prisma.orderItem.updateMany({ where: { menuItemId: fries.id }, data: { menuItemId: rice.id } });
  await prisma.recipeItem.deleteMany({ where: { menuItemId: fries.id } });
  await prisma.menuItem.delete({ where: { id: fries.id } });
  console.log(`Merged ${mergedName}: base(Rice)=₱${(rice.price / 100).toFixed(2)}, Fries +₱${(priceDiff / 100).toFixed(2)}`);
}

async function main() {
  for (const [s, l, m] of SIZE_PAIRS) await mergeSize(s, l, m);
  for (const [f, r, m] of SIDE_PAIRS) await mergeSide(f, r, m);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
