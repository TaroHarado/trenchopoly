import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRENCHOPOLY_CASES } from "@/config/cases";

// Build lookup map for case items
const CASE_ITEMS_MAP = new Map<string, any>();
for (const lootCase of TRENCHOPOLY_CASES) {
  for (const item of lootCase.items) {
    CASE_ITEMS_MAP.set(item.id, item);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null);
    
    if (!user || !user.id) {
      // Return empty inventory instead of 401 to keep UI working
      return NextResponse.json({ inventory: [] }, { status: 200 });
    }

    let itemsFromDb = [];
    try {
      itemsFromDb = await prisma.inventoryItem.findMany({
        where: {
          userId: user.id,
          listing: null, // Only show items not listed
        },
        include: {
          customItem: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (dbError: any) {
      console.error('[INVENTORY_DB_ERROR] Failed to fetch inventory:', dbError);
      console.error('[INVENTORY_DB_ERROR] Error message:', dbError?.message);
      console.error('[INVENTORY_DB_ERROR] Error code:', dbError?.code);
      // Return empty list instead of crashing
      return NextResponse.json({ inventory: [] }, { status: 200 });
    }

    // Map inventory items to include case item metadata
    const mappedInventory = itemsFromDb.map((row) => {
      // If it's a case item (has itemId), enrich with config data
      if (row.itemId) {
        const meta = CASE_ITEMS_MAP.get(row.itemId);
        return {
          id: row.id,
          type: 'CASE_ITEM' as const,
          itemId: row.itemId,
          caseId: row.caseId,
          rarity: row.rarity ?? meta?.rarity ?? null,
          name: meta?.name ?? row.itemId,
          ticker: meta?.ticker ?? null,
          imageUrl: meta?.imageUrl ?? null,
          createdAt: row.createdAt,
        };
      }
      
      // Otherwise, return custom item data
      return {
        id: row.id,
        type: 'CUSTOM_ITEM' as const,
        customItem: row.customItem,
        createdAt: row.createdAt,
      };
    });

    return NextResponse.json({ inventory: mappedInventory }, { status: 200 });
  } catch (error: any) {
    console.error('[INVENTORY_FATAL] Unexpected error:', error);
    // Return empty list instead of crashing
    return NextResponse.json({ inventory: [] }, { status: 200 });
  }
}

