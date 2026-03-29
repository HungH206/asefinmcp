"use client"

import { TrendingUp, MessageSquare, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

export type TabId = "market" | "narrator" | "audit"

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  {
    id: "market",
    label: "Live Market Data",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: "narrator",
    label: "The Narrator",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: "audit",
    label: "Compliance & Audit",
    icon: <ClipboardList className="h-4 w-4" />,
  },
]

interface GlassyNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function GlassyNav({ activeTab, onTabChange }: GlassyNavProps) {
  return (
    <div className="sticky top-0 z-20 px-6 py-4">
      <nav
        className={cn(
          "flex items-center gap-1 p-1.5 rounded-xl",
          "bg-background/60 backdrop-blur-xl",
          "border border-border/50",
          "shadow-lg shadow-background/20"
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <span
                className={cn(
                  "transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          )
        })}
        
        <div className="ml-auto flex items-center gap-2 px-3">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">All Systems Operational</span>
        </div>
      </nav>
    </div>
  )
}
