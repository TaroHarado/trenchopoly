import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateGameRequest } from "@/lib/types";
import { createInitialState } from "@/server/gameEngine";
import boardConfigData from "@/config/board.json";
const boardConfig = boardConfigData as any;

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function GET(request: NextRequest) {
  try {
    // If no database, return empty games list
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "file:./prisma/dev.db") {
      return NextResponse.json({ games: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const buyInMin = searchParams.get("buyInMin");
    const buyInMax = searchParams.get("buyInMax");

    const where: any = {};

    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (buyInMin || buyInMax) {
      where.buyInSol = {};
      if (buyInMin) {
        where.buyInSol.gte = parseFloat(buyInMin);
      }
      if (buyInMax) {
        where.buyInSol.lte = parseFloat(buyInMax);
      }
    }

    try {
      const games = await prisma.game.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              walletAddress: true,
              username: true,
            },
          },
          players: {
            include: {
              user: {
                select: {
                  id: true,
                  walletAddress: true,
                  username: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });

      return NextResponse.json({ games });
    } catch (dbError: any) {
      console.warn("[GAMES_API] Database error, returning empty list:", dbError?.message);
      return NextResponse.json({ games: [] });
    }
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json({ games: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    // If no database, return error
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "file:./prisma/dev.db") {
      return NextResponse.json(
        { error: "Database not configured. Games cannot be created without a database." },
        { status: 503 }
      );
    }

    const user = await getSessionUser().catch(() => null);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: CreateGameRequest = await request.json();
    const { type, buyInSol, maxPlayers = 6, isPrivate = false, customItemIds = [] } = body;

    if (type === "PAID" && !buyInSol) {
      return NextResponse.json(
        { error: "buyInSol is required for PAID games" },
        { status: 400 }
      );
    }

    if (type === "PAID" && ![0.1, 0.25, 1].includes(buyInSol!)) {
      return NextResponse.json(
        { error: "buyInSol must be 0.1, 0.25, or 1" },
        { status: 400 }
      );
    }

    const code = generateGameCode();
    const boardConfigJson = JSON.stringify(boardConfig);

    try {
      const game = await prisma.game.create({
        data: {
          code,
          type,
          buyInSol: type === "PAID" ? buyInSol : null,
          maxPlayers,
          creatorId: user.id,
          boardConfig: boardConfigJson,
          status: "WAITING",
        },
      });

      // Create host player
      await prisma.gamePlayer.create({
        data: {
          gameId: game.id,
          userId: user.id,
          isHost: true,
          isReady: false,
          hasPaidBuyIn: type === "FREE",
        },
      });

      return NextResponse.json({ game });
    } catch (dbError: any) {
      console.error("[GAMES_API] Database error creating game:", dbError?.message);
      return NextResponse.json(
        { error: "Database error. Please configure DATABASE_URL." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

