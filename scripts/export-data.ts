import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function exportData() {
  try {
    console.log("📦 Exporting data from database...");

    // Export all data
    const users = await prisma.user.findMany({
      include: {
        gamesCreated: {
          include: {
            players: {
              include: {
                user: true,
              },
            },
          },
        },
        gamePlayers: {
          include: {
            game: {
              include: {
                creator: true,
                players: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
        inventory: {
          include: {
            customItem: true,
          },
        },
        listings: {
          include: {
            inventoryItem: {
              include: {
                customItem: true,
              },
            },
          },
        },
        transactions: true,
        caseOpens: true,
      },
    });

    const games = await prisma.game.findMany({
      include: {
        creator: true,
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    const customItems = await prisma.customItem.findMany();
    const inventoryItems = await prisma.inventoryItem.findMany({
      include: {
        customItem: true,
        user: true,
      },
    });
    const listings = await prisma.marketplaceListing.findMany({
      include: {
        seller: true,
        inventoryItem: {
          include: {
            customItem: true,
          },
        },
      },
    });
    const transactions = await prisma.transactionLog.findMany({
      include: {
        user: true,
      },
    });
    const caseOpens = await prisma.userCaseOpen.findMany({
      include: {
        user: true,
      },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      users,
      games,
      customItems,
      inventoryItems,
      listings,
      transactions,
      caseOpens,
    };

    const exportPath = path.join(process.cwd(), "prisma", "seed-data.json");
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    console.log(`✅ Data exported to ${exportPath}`);
    console.log(`   - ${users.length} users`);
    console.log(`   - ${games.length} games`);
    console.log(`   - ${customItems.length} custom items`);
    console.log(`   - ${inventoryItems.length} inventory items`);
    console.log(`   - ${listings.length} listings`);
    console.log(`   - ${transactions.length} transactions`);
    console.log(`   - ${caseOpens.length} case opens`);
  } catch (error) {
    console.error("❌ Error exporting data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportData();

