import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// Pairs of (small item name, large item name) -> merged name
const PAIRS: [string, string, string][] = [
  ["Fries BBQ (S)", "Fries BBQ (L)", "Fries BBQ"],
  ["Fries Sour Cream (S)", "Fries Sour Cream (L)", "Fries Sour Cream"],
  ["Fries Cheese (S)", "Fries Cheese (L)", "Fries Cheese"],
];

async function main() {
  for (const [smallName, largeName, mergedName] of PAIRS) {
    const small = await prisma.menuItem.findFirst({ where: { name: smallName }, include: { modifierGroups: true } });
    const large = await prisma.menuItem.findFirst({ where: { name: largeName } });

    if (!small || !large) {
      console.log(`Skip ${mergedName}: missing item(s) — small=${!!small} large=${!!large}`);
      continue;
    }
    if (small.modifierGroups.some((g) => g.name === "Size")) {
      console.log(`Skip ${mergedName}: already has Size group`);
      continue;
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

    // Move any existing orders pointing at the large item onto the merged (small) item, then delete large.
    await prisma.orderItem.updateMany({ where: { menuItemId: large.id }, data: { menuItemId: small.id } });
    await prisma.recipeItem.deleteMany({ where: { menuItemId: large.id } });
    await prisma.menuItem.delete({ where: { id: large.id } });

    console.log(`Merged ${mergedName}: base=₱${(small.price / 100).toFixed(2)}, Large +₱${(priceDiff / 100).toFixed(2)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
