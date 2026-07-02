import { PrismaClient } from "../generated/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface InventoryEntry {
  unit: "KG" | "G" | "L" | "ML" | "PCS" | "PACK" | "BOTTLE";
  costCentavos: number;
}

interface RecipeLine {
  inventoryName: string;
  quantity: number;
}

interface MenuItemEntry {
  sheetName: string;
  name: string;
  category: string;
  priceCentavos: number;
  recipe: RecipeLine[];
}

interface ImportData {
  inventory: Record<string, InventoryEntry>;
  menuItems: MenuItemEntry[];
}

async function main() {
  const dataPath = path.join(__dirname, "food-costing-import.json");
  const data: ImportData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  console.log(`Loaded ${Object.keys(data.inventory).length} inventory items, ${data.menuItems.length} menu items`);

  // ── Inventory items ──────────────────────────────────────────────
  const inventoryIdByName = new Map<string, string>();
  let invCreated = 0, invUpdated = 0;
  for (const [name, entry] of Object.entries(data.inventory)) {
    const existing = await prisma.inventoryItem.findFirst({ where: { name } });
    if (existing) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { unit: entry.unit, cost: entry.costCentavos },
      });
      inventoryIdByName.set(name, existing.id);
      invUpdated++;
    } else {
      const created = await prisma.inventoryItem.create({
        data: { name, unit: entry.unit, cost: entry.costCentavos },
      });
      inventoryIdByName.set(name, created.id);
      invCreated++;
    }
  }
  console.log(`✅ Inventory: ${invCreated} created, ${invUpdated} updated`);

  // ── Menu categories ──────────────────────────────────────────────
  const categoryNames = [...new Set(data.menuItems.map((m) => m.category))];
  const categoryIdByName = new Map<string, string>();
  let existingCatCount = await prisma.menuCategory.count();
  for (const name of categoryNames) {
    const existing = await prisma.menuCategory.findFirst({ where: { name } });
    if (existing) {
      categoryIdByName.set(name, existing.id);
    } else {
      const created = await prisma.menuCategory.create({
        data: { name, sortOrder: existingCatCount++ },
      });
      categoryIdByName.set(name, created.id);
    }
  }
  console.log(`✅ Categories: ${categoryIdByName.size} total (${categoryNames.length} referenced)`);

  // ── Menu items + recipes ────────────────────────────────────────
  let miCreated = 0, miUpdated = 0, recipeLinesCreated = 0, recipeSkipped = 0;
  for (const item of data.menuItems) {
    const categoryId = categoryIdByName.get(item.category)!;
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    let menuItemId: string;
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { categoryId, price: item.priceCentavos },
      });
      menuItemId = existing.id;
      miUpdated++;
    } else {
      const created = await prisma.menuItem.create({
        data: { categoryId, name: item.name, price: item.priceCentavos },
      });
      menuItemId = created.id;
      miCreated++;
    }

    for (const line of item.recipe) {
      const inventoryItemId = inventoryIdByName.get(line.inventoryName);
      if (!inventoryItemId) {
        recipeSkipped++;
        continue;
      }
      await prisma.recipeItem.upsert({
        where: { menuItemId_inventoryItemId: { menuItemId, inventoryItemId } },
        update: { quantity: line.quantity },
        create: { menuItemId, inventoryItemId, quantity: line.quantity },
      });
      recipeLinesCreated++;
    }
  }
  console.log(`✅ Menu items: ${miCreated} created, ${miUpdated} updated`);
  console.log(`✅ Recipe links: ${recipeLinesCreated} upserted, ${recipeSkipped} skipped (missing inventory match)`);
  console.log("🎉 Food costing import complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
