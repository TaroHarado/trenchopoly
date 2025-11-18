import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function importData() {
  try {
    const seedPath = path.join(process.cwd(), "prisma", "seed-data.json");
    
    if (!fs.existsSync(seedPath)) {
      console.error(`❌ Seed file not found: ${seedPath}`);
      process.exit(1);
    }

    console.log("📥 Importing data from seed file...");
    const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

    // Import in correct order (respecting foreign keys)
    console.log("   Creating users...");
    for (const user of seedData.users || []) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          walletAddress: user.walletAddress,
          username: user.username,
        },
        create: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        },
      });
    }

    console.log("   Creating custom items...");
    for (const item of seedData.customItems || []) {
      await prisma.customItem.upsert({
        where: { id: item.id },
        update: {
          type: item.type,
          name: item.name,
          description: item.description,
          rarity: item.rarity,
          iconUrl: item.iconUrl,
          effectData: item.effectData,
        },
        create: {
          id: item.id,
          type: item.type,
          name: item.name,
          description: item.description,
          rarity: item.rarity,
          iconUrl: item.iconUrl,
          effectData: item.effectData,
        },
      });
    }

    console.log("   Creating games...");
    for (const game of seedData.games || []) {
      await prisma.game.upsert({
        where: { id: game.id },
        update: {
          code: game.code,
          status: game.status,
          type: game.type,
          buyInSol: game.buyInSol,
          maxPlayers: game.maxPlayers,
          creatorId: game.creatorId,
          boardConfig: game.boardConfig,
          turnState: game.turnState,
          winnerId: game.winnerId,
          endedAt: game.endedAt ? new Date(game.endedAt) : null,
          createdAt: new Date(game.createdAt),
          updatedAt: new Date(game.updatedAt),
        },
        create: {
          id: game.id,
          code: game.code,
          status: game.status,
          type: game.type,
          buyInSol: game.buyInSol,
          maxPlayers: game.maxPlayers,
          creatorId: game.creatorId,
          boardConfig: game.boardConfig,
          turnState: game.turnState,
          winnerId: game.winnerId,
          endedAt: game.endedAt ? new Date(game.endedAt) : null,
          createdAt: new Date(game.createdAt),
          updatedAt: new Date(game.updatedAt),
        },
      });
    }

    console.log("   Creating game players...");
    for (const game of seedData.games || []) {
      for (const player of game.players || []) {
        await prisma.gamePlayer.upsert({
          where: { id: player.id },
          update: {
            gameId: player.gameId,
            userId: player.userId,
            position: player.position,
            balance: player.balance,
            isReady: player.isReady,
            isHost: player.isHost,
            hasPaidBuyIn: player.hasPaidBuyIn,
            joinedAt: new Date(player.joinedAt),
          },
          create: {
            id: player.id,
            gameId: player.gameId,
            userId: player.userId,
            position: player.position,
            balance: player.balance,
            isReady: player.isReady,
            isHost: player.isHost,
            hasPaidBuyIn: player.hasPaidBuyIn,
            joinedAt: new Date(player.joinedAt),
          },
        });
      }
    }

    console.log("   Creating inventory items...");
    for (const item of seedData.inventoryItems || []) {
      await prisma.inventoryItem.upsert({
        where: { id: item.id },
        update: {
          userId: item.userId,
          customItemId: item.customItemId,
          caseId: item.caseId,
          itemId: item.itemId,
          rarity: item.rarity,
          createdAt: new Date(item.createdAt),
        },
        create: {
          id: item.id,
          userId: item.userId,
          customItemId: item.customItemId,
          caseId: item.caseId,
          itemId: item.itemId,
          rarity: item.rarity,
          createdAt: new Date(item.createdAt),
        },
      });
    }

    console.log("   Creating marketplace listings...");
    for (const listing of seedData.listings || []) {
      await prisma.marketplaceListing.upsert({
        where: { id: listing.id },
        update: {
          sellerId: listing.sellerId,
          inventoryItemId: listing.inventoryItemId,
          priceSol: listing.priceSol,
          status: listing.status,
          createdAt: new Date(listing.createdAt),
          updatedAt: new Date(listing.updatedAt),
        },
        create: {
          id: listing.id,
          sellerId: listing.sellerId,
          inventoryItemId: listing.inventoryItemId,
          priceSol: listing.priceSol,
          status: listing.status,
          createdAt: new Date(listing.createdAt),
          updatedAt: new Date(listing.updatedAt),
        },
      });
    }

    console.log("   Creating transaction logs...");
    for (const tx of seedData.transactions || []) {
      await prisma.transactionLog.upsert({
        where: { id: tx.id },
        update: {
          userId: tx.userId,
          type: tx.type,
          amountSol: tx.amountSol,
          signature: tx.signature,
          metadata: tx.metadata,
          createdAt: new Date(tx.createdAt),
        },
        create: {
          id: tx.id,
          userId: tx.userId,
          type: tx.type,
          amountSol: tx.amountSol,
          signature: tx.signature,
          metadata: tx.metadata,
          createdAt: new Date(tx.createdAt),
        },
      });
    }

    console.log("   Creating user case opens...");
    for (const caseOpen of seedData.caseOpens || []) {
      await prisma.userCaseOpen.upsert({
        where: {
          userId_caseId: {
            userId: caseOpen.userId,
            caseId: caseOpen.caseId,
          },
        },
        update: {
          createdAt: new Date(caseOpen.createdAt),
        },
        create: {
          id: caseOpen.id,
          userId: caseOpen.userId,
          caseId: caseOpen.caseId,
          createdAt: new Date(caseOpen.createdAt),
        },
      });
    }

    console.log("✅ Data imported successfully!");
    console.log(`   Imported from: ${seedPath}`);
  } catch (error) {
    console.error("❌ Error importing data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importData();

