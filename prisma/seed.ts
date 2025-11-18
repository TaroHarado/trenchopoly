import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create some default cases and items for testing
  console.log("Seeding database...");

  // Create custom items
  const items = await Promise.all([
    prisma.customItem.upsert({
      where: { id: "item-1" },
      update: {},
      create: {
        id: "item-1",
        type: "TILE",
        name: "Lucky Tile",
        description: "A special tile that gives you extra money",
        rarity: "COMMON",
        effectData: JSON.stringify({ type: "money", amount: 100 }),
      },
    }),
    prisma.customItem.upsert({
      where: { id: "item-2" },
      update: {},
      create: {
        id: "item-2",
        type: "CARD",
        name: "Get Out of Jail Free",
        description: "Use this card to escape jail",
        rarity: "RARE",
        effectData: JSON.stringify({ type: "jail_free" }),
      },
    }),
  ]);

  // Create a case
  const case_ = await prisma.case.upsert({
    where: { id: "case-1" },
    update: {},
    create: {
      id: "case-1",
      name: "Starter Case",
      description: "A basic case with common items",
      priceSol: 0.01,
    },
  });

  // Create case item chances
  await prisma.caseItemChance.upsert({
    where: { id: "chance-1" },
    update: {},
    create: {
      id: "chance-1",
      caseId: case_.id,
      customItemId: items[0].id,
      chance: 0.8,
    },
  });

  await prisma.caseItemChance.upsert({
    where: { id: "chance-2" },
    update: {},
    create: {
      id: "chance-2",
      caseId: case_.id,
      customItemId: items[1].id,
      chance: 0.2,
    },
  });

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

