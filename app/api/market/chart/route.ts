import { NextRequest, NextResponse } from "next/server"

export interface ChartPoint {
  time: string
  price: number
}

// Generate realistic mock intraday data — always produces points regardless of timezone
function mockIntraday(basePrice: number): ChartPoint[] {
  const points: ChartPoint[] = []
  let price = basePrice * 0.985
  // Always generate a full trading day (78 x 5-min candles = 9:30am–4:00pm)
  for (let i = 0; i < 78; i++) {
    const minutesSinceOpen = i * 5
    const hours = Math.floor(minutesSinceOpen / 60) + 9
    const mins = (minutesSinceOpen % 60) + (i === 0 ? 30 : 0)
    const hh = String(hours).padStart(2, "0")
    const mm = String(mins % 60).padStart(2, "0")
    price = price + (Math.random() - 0.47) * (basePrice * 0.003)
    points.push({ time: `${hh}:${mm}`, price: Math.round(price * 100) / 100 })
  }
  return points
}

const mockBases: Record<string, number> = {
  AAPL: 189.84, TSLA: 250.12, MSFT: 415.3, GOOGL: 178.92, AMZN: 198.5, NVDA: 875.4,
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "AAPL"
  const apiKey = process.env.EODHD_API_KEY

  if (!apiKey) {
    const base = mockBases[ticker] ?? 150
    return NextResponse.json({ ticker, points: mockIntraday(base), source: "mock" })
  }

  try {
    // EODHD intraday endpoint — 5 minute intervals
    const res = await fetch(
      `https://eodhd.com/api/intraday/${ticker}?api_token=${apiKey}&interval=5m&fmt=json`,
      { next: { revalidate: 300 } }
    )

    if (!res.ok) {
      const base = mockBases[ticker] ?? 150
      return NextResponse.json({ ticker, points: mockIntraday(base), source: "mock-fallback" })
    }

    const raw = await res.json() as { datetime: string; close: number }[]

    // Filter to today only
    const today = new Date().toISOString().slice(0, 10)
    const points: ChartPoint[] = raw
      .filter((d) => d.datetime.startsWith(today))
      .map((d) => ({
        time: new Date(d.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        price: d.close,
      }))

    return NextResponse.json({ ticker, points: points.length > 0 ? points : mockIntraday(mockBases[ticker] ?? 150), source: "eodhd" })
  } catch {
    const base = mockBases[ticker] ?? 150
    return NextResponse.json({ ticker, points: mockIntraday(base), source: "mock-fallback" })
  }
}
