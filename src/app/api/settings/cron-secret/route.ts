import { NextResponse } from 'next/server';
import { getCronSecret } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ secret: await getCronSecret() });
}
