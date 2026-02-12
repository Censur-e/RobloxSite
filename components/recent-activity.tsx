import type { AuditLog } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { ScrollText } from "lucide-react"

export function RecentActivity({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-card-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground">
              Actions taken in the dashboard will appear here
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">Recent Activity</h2>
      </div>
      <div className="divide-y divide-border">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-card-foreground">
                <span className="font-medium">{log.action}</span>
                {log.resource_id && (
                  <span className="ml-1 text-muted-foreground">
                    on {log.resource_type} <span className="font-mono text-xs">{log.resource_id}</span>
                  </span>
                )}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground font-mono">
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
