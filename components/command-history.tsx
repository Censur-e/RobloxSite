"use client"

import { useState } from "react"
import type { Command, CommandStatus } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Timer,
  Terminal,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<CommandStatus, { icon: typeof Clock; color: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-warning", label: "Pending" },
  SENT: { icon: Send, color: "text-chart-2", label: "Sent" },
  SUCCESS: { icon: CheckCircle2, color: "text-primary", label: "Success" },
  FAILED: { icon: XCircle, color: "text-destructive", label: "Failed" },
  EXPIRED: { icon: Timer, color: "text-muted-foreground", label: "Expired" },
}

export function CommandHistory({ commands }: { commands: Command[] }) {
  const [statusFilter, setStatusFilter] = useState<CommandStatus | "ALL">("ALL")

  const filtered =
    statusFilter === "ALL"
      ? commands
      : commands.filter((c) => c.status === statusFilter)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-card-foreground">Command History</h2>
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            {commands.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Filter className="mr-1 h-3 w-3 text-muted-foreground" />
          {(["ALL", "PENDING", "SENT", "SUCCESS", "FAILED", "EXPIRED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <Terminal className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium text-card-foreground">No commands yet</p>
            <p className="text-xs text-muted-foreground">
              Commands you execute will appear here with their status
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((cmd) => {
            const config = STATUS_CONFIG[cmd.status]
            const StatusIcon = config.icon
            return (
              <div
                key={cmd.id}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-secondary/30"
              >
                <StatusIcon className={cn("h-4 w-4 shrink-0", config.color)} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-card-foreground font-mono">
                      {cmd.command_type}
                    </span>
                    {cmd.target_username && (
                      <span className="text-xs text-muted-foreground">
                        target: <span className="font-mono">{cmd.target_username}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{cmd.place_id}</span>
                    {cmd.server_id && (
                      <>
                        <span className="text-border">|</span>
                        <span className="font-mono">{cmd.server_id.slice(0, 8)}</span>
                      </>
                    )}
                    {cmd.result_message && (
                      <>
                        <span className="text-border">|</span>
                        <span>{cmd.result_message}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className={cn("text-xs font-medium", config.color)}>
                    {config.label}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
