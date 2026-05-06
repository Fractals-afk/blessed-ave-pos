import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Owner account
  const passwordHash = await bcrypt.hash("blessed2024!", 12);
  const owner = await prisma.user.upsert({
    where: { email: "admin@blessedave.com" },
    update: {},
    create: {
      name: "Blessed Ave Admin",
      email: "admin@blessedave.com",
      passwordHash,
      role: "OWNER",
    },
  });
  console.log("✅ Owner account:", owner.email);

  // Menu categories
  const [coffee, food, drinks, pastries] = await Promise.all([
    prisma.menuCategory.upsert({
      where: { id: "cat_coffee" },
      update: {},
      create: { id: "cat_coffee", name: "Coffee", sortOrder: 1 },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat_food" },
      update: {},
      create: { id: "cat_food", name: "All Day Breakfast & Meals", sortOrder: 2 },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat_drinks" },
      update: {},
      create: { id: "cat_drinks", name: "Non-Coffee Drinks", sortOrder: 3 },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat_pastries" },
      update: {},
      create: { id: "cat_pastries", name: "Pastries & Snacks", sortOrder: 4 },
    }),
  ]);
  console.log("✅ Menu categories seeded");

  // Sample menu items
  const latte = await prisma.menuItem.upsert({
    where: { id: "item_latte" },
    update: {},
    create: {
      id: "item_latte",
      categoryId: coffee.id,
      name: "Café Latte",
      description: "Espresso with steamed milk and a light layer of foam",
      price: 15000, // ₱150
    },
  });

  // Add size modifier to latte
  await prisma.modifierGroup.upsert({
    where: { id: "mg_latte_size" },
    update: {},
    create: {
      id: "mg_latte_size",
      menuItemId: latte.id,
      name: "Size",
      required: true,
      multiSelect: false,
      options: {
        create: [
          { name: "Small (8oz)", priceAdjustment: 0 },
          { name: "Medium (12oz)", priceAdjustment: 2500 },
          { name: "Large (16oz)", priceAdjustment: 5000 },
        ],
      },
    },
  });

  await prisma.menuItem.upsert({
    where: { id: "item_americano" },
    update: {},
    create: {
      id: "item_americano",
      categoryId: coffee.id,
      name: "Americano",
      description: "Espresso diluted with hot water",
      price: 12000, // ₱120
    },
  });

  await prisma.menuItem.upsert({
    where: { id: "item_matcha" },
    update: {},
    create: {
      id: "item_matcha",
      categoryId: drinks.id,
      name: "Matcha Latte",
      description: "Premium ceremonial grade matcha with steamed milk",
      price: 17000, // ₱170
    },
  });

  await prisma.menuItem.upsert({
    where: { id: "item_avo_toast" },
    update: {},
    create: {
      id: "item_avo_toast",
      categoryId: food.id,
      name: "Avocado Toast",
      description: "Sourdough toast topped with smashed avocado, poached egg, and chilli flakes",
      price: 22000, // ₱220
    },
  });

  console.log("✅ Menu items seeded");

  // Cafe tables
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      prisma.cafeTable.upsert({
        where: { id: `table_${i + 1}` },
        update: {},
        create: { id: `table_${i + 1}`, name: `Table ${i + 1}` },
      })
    )
  );
  console.log("✅ Cafe tables seeded (8 tables)");

  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
