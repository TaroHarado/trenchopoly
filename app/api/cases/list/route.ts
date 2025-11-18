// app/api/cases/list/route.ts

import { NextResponse } from 'next/server';
import { TRENCHOPOLY_CASES } from '@/config/cases';

export async function GET() {
  try {
    // NO DATABASE CALLS HERE.
    // Just return static case config from TRENCHOPOLY_CASES.

    const cases = TRENCHOPOLY_CASES.map((c) => ({
      id: c.id,
      title: c.title,
      priceSol: c.priceSol,
      free: !!c.free,
      opened: false, // always false for now, we will wire DB later
      items: c.items,
    }));

    return NextResponse.json({ cases });
  } catch (error) {
    console.error('[CASES_LIST_FATAL]', error);
    return NextResponse.json({ error: 'Internal error in /api/cases/list' }, { status: 500 });
  }
}
