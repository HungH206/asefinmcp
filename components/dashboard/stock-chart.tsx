"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react"
import type { ChartPoint } from "@/app/api/market/chart/route"

const TICKERS = ["AAPL", "TSLA", "MSFT", "GOOGL", "NVDA", "AMZN"]

const TICKER_COLORS: Record<string, string> = {
  AAPL:  "#6366f1",
  TSLA:  "#f43f5e",
  MSFT:  "#0ea5e9",
  GOOGL: "#f59e0b",
  NVDA:  "#10b981",
  AMZN:  "#8b5cf6",
}

interface TooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ color: "#888", fontSize: 11, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>${payload[0].value.toFixed(2)}</p>
    </div>
  )
}

export function StockChart() {
  const [ticker, setTicker] = useState("AAPL")
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState("")

  const load = async (t: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/market/chart?ticker=${t}`)
      const data = await res.json() as { points?: ChartPoint[]; source?: string; detail?: string; error?: string }
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`)
      if (!data.points?.length) throw new Error("No data returned")
      setPoints(data.points)
      setSource(data.source ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load(ticker) }, [ticker])

  const first = points[0]?.price ?? 0
  const last = points[points.length - 1]?.price ?? 0
  const change = first > 0 ? ((last - first) / first) * 100 : 0
  const isPositive = change >= 0

  const lineColor = isPositive ? "#22c55e" : "#ef4444"
  const tickerColor = TICKER_COLORS[ticker] ?? "#6366f1"

  const prices = points.map((p) => p.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const padding = (maxPrice - minPrice) * 0.2 || 3

  const tickInterval = Math.max(1, Math.floor(points.length / 7))

  return (
    <Card style={{ background: "#0f0f1a", border: "1px solid #1e1e3a" }}>
      <CardHeader className="pb-3">
        {/* Title row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold text-white">EOD Report</CardTitle>
            {points.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">${last.toFixed(2)}</span>
                <span
                  className="flex items-center text-sm font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: lineColor, background: isPositive ? "#22c55e22" : "#ef444422" }}
                >
                  {isPositive ? <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> : <TrendingDown className="h-3.5 w-3.5 mr-0.5" />}
                  {isPositive ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Ticker buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => setTicker(t)}
                style={
                  ticker === t
                    ? { background: TICKER_COLORS[t], color: "#fff", border: "none", boxShadow: `0 0 12px ${TICKER_COLORS[t]}80`, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }
                    : { background: "#1a1a2e", color: "#666", border: "1px solid #2a2a4a", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }
                }
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => void load(ticker)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#666", padding: 4 }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} style={{ color: isLoading ? tickerColor : "#666" }} />
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge
            className="text-xs px-2 py-0.5 font-semibold border-0"
            style={{ background: `${tickerColor}25`, color: tickerColor }}
          >
            {ticker} · 30 Sessions
          </Badge>
          <Badge style={{ background: "#1a1a2e", color: "#555", border: "1px solid #2a2a4a", fontSize: 11, borderRadius: 6, padding: "2px 8px" }}>
            {source === "eodhd" ? "Live · EODHD" : source === "mock" ? "Simulated" : "Unavailable"}
          </Badge>
          {points.length > 0 && (
            <span className="text-xs ml-auto" style={{ color: "#555" }}>
              O <span style={{ color: "#aaa" }}>${first.toFixed(2)}</span>
              <span style={{ margin: "0 6px", color: "#333" }}>·</span>
              H <span style={{ color: "#22c55e" }}>${maxPrice.toFixed(2)}</span>
              <span style={{ margin: "0 6px", color: "#333" }}>·</span>
              L <span style={{ color: "#ef4444" }}>${minPrice.toFixed(2)}</span>
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-3 pb-4">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin" style={{ color: tickerColor }} />
            <span style={{ color: "#555", fontSize: 13 }}>Loading {ticker}...</span>
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>
            <button
              onClick={() => void load(ticker)}
              style={{ color: tickerColor, fontSize: 12, background: "transparent", border: `1px solid ${tickerColor}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {/* Fixed gradient ID — does not change between renders */}
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={lineColor} stopOpacity={0.6} />
                  <stop offset="50%"  stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" vertical={false} />

              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#444" }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                domain={[minPrice - padding, maxPrice + padding]}
                tick={{ fontSize: 10, fill: "#444" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                width={52}
              />

              <ReferenceLine y={first} stroke="#ffffff15" strokeDasharray="4 4" strokeWidth={1} />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: "4 4" }} />

              <Area
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={2.5}
                fill="url(#chartGradient)"
                dot={false}
                activeDot={{ r: 5, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
