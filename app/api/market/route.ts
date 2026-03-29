import { NextResponse } from "next/server"
import { getMarketCards } from "@/lib/backend/service"

export async function GET() {
  return NextResponse.json({ cards: getMarketCards() })
}
