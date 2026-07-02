import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

const DRINK_CATEGORIES = ["Frappes", "Hot Coffee", "Iced Coffee", "Specialty Lattes", "Refreshers & Slushy"];

async function main() {
  const items = await prisma.menuItem.findMany({
    where: { category: { name: { in: DRINK_CATEGORIES } } },
    include: { modifierGroups: true },
  });

  let created = 0, skipped = 0;
  for (const item of items) {
    if (item.modifierGroups.some((g) => g.name === "Size")) {
      skipped++;
      continue;
    }
    await prisma.modifierGroup.create({
      data: {
        menuItemId: item.id,
        name: "Size",
        required: true,
        multiSelect: false,
        sortOrder: 0,
        options: {
          create: [
            { name: "Small", priceAdjustment: 0 },
            { name: "Medium", priceAdjustment: 0 },
            { name: "Large", priceAdjustment: 0 },
          ],
        },
      },
    });
    created++;
  }
  console.log(`Size modifier group: ${created} created, ${skipped} already had one`);
  console.log("Price adjustments are ₱0 placeholders — set real upcharges in Admin > Menu Management.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
