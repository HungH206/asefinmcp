"use client"

import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

export function FinancialCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <FinancialCard
        title="AAPL Price"
        value="$189.84"
        change={2.34}
        changeLabel="vs. yesterday close"
        icon={<DollarSign className="h-4 w-4 text-primary" />}
        lastUpdate="2s ago"
      />
      <FinancialCard
        title="Portfolio Value"
        value="$1.24M"
        change={1.87}
        changeLabel="24h change"
        icon={<BarChart3 className="h-4 w-4 text-accent" />}
        lastUpdate="5s ago"
      />
      <FinancialCard
        title="Portfolio Volatility"
        value="14.2%"
        change={-0.8}
        changeLabel="vs. market avg"
        icon={<Activity className="h-4 w-4 text-warning" />}
        lastUpdate="10s ago"
      />
      <FinancialCard
        title="Risk Score"
        value="Low"
        change={5.2}
        changeLabel="improved this week"
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        lastUpdate="1m ago"
      />
    </div>
  )
}
