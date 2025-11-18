// app/api/cases/open/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { TRENCHOPOLY_CASES, pickItemFromCase } from '@/config/cases';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('[CASES_OPEN_ERROR] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { caseId } = body;

    if (!caseId || typeof caseId !== 'string') {
      return NextResponse.json(
        { error: 'caseId is required' },
        { status: 400 }
      );
    }

    // Find the case in config
    const lootCase = TRENCHOPOLY_CASES.find(c => c.id === caseId);
    
    if (!lootCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // For paid cases, skip payment verification for now
    if (!lootCase.free && lootCase.priceSol > 0) {
      // TODO: Verify SOL payment before opening
      console.log(`[CASE OPEN] Paid case ${caseId} opened without payment verification (TODO: implement)`);
    }

    // Pick item from case
    const selectedItem = pickItemFromCase(lootCase);

    // Try to save to inventory (best-effort, don't fail if it doesn't work)
    try {
      const user = await getSessionUser().catch(() => null);
      
      if (!user || !user.id) {
        console.warn('[CASES_OPEN] No user, skipping inventory save');
      } else {
        try {
          await prisma.inventoryItem.create({
            data: {
              userId: user.id,
              caseId: lootCase.id,
              itemId: selectedItem.id,
              rarity: selectedItem.rarity,
              // customItemId is null for case items
            },
          });
          console.log(`[CASES_OPEN] Saved item ${selectedItem.id} to inventory for user ${user.id}`);
        } catch (dbError: any) {
          console.error('[CASES_OPEN_DB_ERROR] Failed to save inventory item:', dbError);
          console.error('[CASES_OPEN_DB_ERROR] Error message:', dbError?.message);
          console.error('[CASES_OPEN_DB_ERROR] Error code:', dbError?.code);
          // DO NOT throw, just log. We still return success: true so the animation works.
        }
      }
    } catch (authError: any) {
      console.warn('[CASES_OPEN] Auth check failed, skipping inventory save:', authError);
      // Continue without saving
    }

    return NextResponse.json({
      success: true,
      item: {
        id: selectedItem.id,
        name: selectedItem.name,
        ticker: selectedItem.ticker,
        rarity: selectedItem.rarity,
        imageUrl: selectedItem.imageUrl,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('[CASES_OPEN_FATAL]', error);
    return NextResponse.json(
      { error: 'Internal error in /api/cases/open', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
  }
}
