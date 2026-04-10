import { NextRequest, NextResponse } from "next/server"

export interface ChartPoint {
  time: string
  price: number
}

interface EodhdEodRow {
  date?: string
  close?: number | null
}

// Generate realistic mock end-of-day data for the latest sessions.
function mockEod(basePrice: number): ChartPoint[] {
  const points: ChartPoint[] = []
  let price = basePrice * 0.97

  for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - dayOffset)

    const time = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
    }).format(date)

    price = price + (Math.random() - 0.46) * (basePrice * 0.01)
    points.push({ time, price: Math.round(price * 100) / 100 })
  }
  return points
}

function normalizeTickerSymbol(ticker: string): string {
  return ticker.includes(".") ? ticker : `${ticker}.US`
}

function parseRowDate(row: EodhdEodRow): number | null {
  if (typeof row.date !== "string") {
    return null
  }

  const parsed = Date.parse(`${row.date}T00:00:00Z`)
  return Number.isNaN(parsed) ? null : parsed
}

function formatMarketDate(timestampMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(new Date(timestampMs))
}

const mockBases: Record<string, number> = {
  AAPL: 189.84, TSLA: 250.12, MSFT: 415.3, GOOGL: 178.92, AMZN: 198.5, NVDA: 875.4,
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "AAPL"
  const symbol = normalizeTickerSymbol(ticker)
  const apiKey = process.env.EODHD_API_KEY

  if (!apiKey) {
    const base = mockBases[ticker] ?? 150
    return NextResponse.json({ ticker, points: mockEod(base), source: "mock" })
  }

  try {
    // EODHD end-of-day endpoint — daily close history
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const toYmd = (date: Date) => date.toISOString().slice(0, 10)

    const res = await fetch(
      `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?from=${toYmd(startDate)}&to=${toYmd(endDate)}&period=d&api_token=${apiKey}&fmt=json`,
      { next: { revalidate: 300 } }
    )

    if (!res.ok) {
      const body = await res.text()
      const isFreePlanRestriction = res.status === 403 && body.includes("Only EOD data allowed for free users")

      return NextResponse.json(
        {
          ticker,
          source: isFreePlanRestriction ? "eodhd-restricted" : "eodhd-error",
          detail: isFreePlanRestriction
            ? "EODHD daily report data is not available on the current plan."
            : `EODHD API error ${res.status}`,
        },
        { status: res.status }
      )
    }

    const raw = await res.json() as EodhdEodRow[]
    const rows = Array.isArray(raw) ? raw : []
    const normalizedRows = rows
      .map((row) => {
        const timestamp = parseRowDate(row)
        const price = typeof row.close === "number" && Number.isFinite(row.close) ? row.close : null

        if (timestamp === null || price === null) {
          return null
        }

        return {
          timestamp,
          point: {
            time: formatMarketDate(timestamp),
            price,
          },
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => left.timestamp - right.timestamp)

    const reportPoints = normalizedRows.slice(-30).map((row) => row.point)

    if (reportPoints.length === 0) {
      return NextResponse.json(
        {
          ticker,
          source: "eodhd-empty",
          detail: "EODHD returned daily data, but no usable report points were found.",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ticker,
      points: reportPoints,
      source: "eodhd",
    })
  } catch {
    return NextResponse.json(
      {
        ticker,
        source: "eodhd-error",
        detail: "Unable to reach EODHD daily API.",
      },
      { status: 502 }
    )
  }
}
