"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { FinancialCardData } from "@/lib/backend/types"

interface FinancialCardProps {
  title: string
  value: string
  change: number
  changeLabel: string
  icon: React.ReactNode
  lastUpdate: string
}

function FinancialCard({ title, value, change, changeLabel, icon, lastUpdate }: FinancialCardProps) {
  const isPositive = change >= 0

  return (
    <Card className="bg-card/50 border-border/50 hover:border-border transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary border border-border/50">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          <div className={`flex items-center text-xs font-medium ${isPositive ? "text-primary" : "text-destructive"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {isPositive ? "+" : ""}{change}%
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <Badge variant="outline" className="text-xs px-2 py-0.5 border-accent/30 text-accent">
            Fetched via MCP
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            {lastUpdate}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function metricIcon(metric: FinancialCardData["metric"]): React.ReactNode {
  switch (metric) {
    case "price":    return <DollarSign className="h-4 w-4 text-primary" />
    case "portfolio": return <BarChart3 className="h-4 w-4 text-accent" />
    case "volatility": return <Activity className="h-4 w-4 text-warning" />
    case "risk":     return <TrendingUp className="h-4 w-4 text-primary" />
  }
}

export function FinancialCards() {
  const [cards, setCards] = useState<FinancialCardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadCards = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const response = await fetch("/api/market")
      if (!response.ok) throw new Error("Failed to fetch market data")
      const data = (await response.json()) as { cards: FinancialCardData[] }
      setCards(data.cards)
      setError(null)
    } catch {
      setError("Could not load market data")
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadCards()
    const interval = setInterval(() => { void loadCards(true) }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    )
  }

  if (cards.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-6 text-sm text-muted-foreground">Loading market data...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Auto-refreshes every 30s</span>
        <button
          onClick={() => void loadCards(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <FinancialCard
            key={card.id}
            title={card.title}
            value={card.value}
            change={card.change}
            changeLabel={card.changeLabel}
            icon={metricIcon(card.metric)}
            lastUpdate={card.lastUpdate}
          />
        ))}
      </div>
    </div>
  )
}
