import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: "Rework API is running (Next.js App Router - TS)" 
  });
}