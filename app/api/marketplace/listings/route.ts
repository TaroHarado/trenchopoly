import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateListingRequest } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const rarity = searchParams.get("rarity");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    const where: any = {
      status: "ACTIVE",
    };

    if (minPrice || maxPrice) {
      where.priceSol = {};
      if (minPrice) {
        where.priceSol.gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        where.priceSol.lte = parseFloat(maxPrice);
      }
    }

    const listings = await prisma.marketplaceListing.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            walletAddress: true,
            username: true,
          },
        },
        inventoryItem: {
          include: {
            customItem: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Filter by type and rarity in memory (could be optimized)
    let filtered = listings;
    if (type) {
      filtered = filtered.filter(
        (l) => l.inventoryItem.customItem?.type === type
      );
    }
    if (rarity) {
      filtered = filtered.filter(
        (l) => l.inventoryItem.customItem?.rarity === rarity
      );
    }

    return NextResponse.json({ listings: filtered });
  } catch (error) {
    console.error("Error fetching listings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: CreateListingRequest = await request.json();
    const { inventoryItemId, priceSol } = body;

    if (!inventoryItemId || !priceSol) {
      return NextResponse.json(
        { error: "inventoryItemId and priceSol are required" },
        { status: 400 }
      );
    }

    if (priceSol <= 0) {
      return NextResponse.json(
        { error: "priceSol must be positive" },
        { status: 400 }
      );
    }

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        listing: true,
      },
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    if (inventoryItem.userId !== user.id) {
      return NextResponse.json(
        { error: "Not your item" },
        { status: 403 }
      );
    }

    if (inventoryItem.listing) {
      return NextResponse.json(
        { error: "Item already listed" },
        { status: 400 }
      );
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerId: user.id,
        inventoryItemId: inventoryItem.id,
        priceSol,
        status: "ACTIVE",
      },
      include: {
        inventoryItem: {
          include: {
            customItem: true,
          },
        },
      },
    });

    return NextResponse.json({ listing });
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

