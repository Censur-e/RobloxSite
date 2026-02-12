import { Users, Terminal, Clock, Wifi } from "lucide-react"

interface StatsCardsProps {
  playersTracked: number
  onlinePlayers: number
  totalCommands: number
  pendingCommands: number
}

const stats = [
  {
    key: "playersTracked",
    label: "Players Tracked",
    icon: Users,
  },
  {
    key: "onlinePlayers",
    label: "Online Now",
    icon: Wifi,
  },
  {
    key: "totalCommands",
    label: "Total Commands",
    icon: Terminal,
  },
  {
    key: "pendingCommands",
    label: "Pending",
    icon: Clock,
  },
] as const

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const value = props[stat.key]
        return (
          <div
            key={stat.key}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-card-foreground font-mono">
                {value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
