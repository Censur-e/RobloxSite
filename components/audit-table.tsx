"use client"

import { useState, useMemo } from "react"
import type { AuditLog } from "@/lib/types"
import { formatDistanceToNow, format } from "date-fns"
import { Search, ScrollText } from "lucide-react"

export function AuditTable({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.resource_type.toLowerCase().includes(q) ||
        (l.resource_id && l.resource_id.toLowerCase().includes(q))
    )
  }, [logs, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search actions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Resource
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                Details
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  <ScrollText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm">No audit logs found</p>
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-sm bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-card-foreground">{log.resource_type}</span>
                      {log.resource_id && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.resource_id.slice(0, 12)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <pre className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {JSON.stringify(log.details)}
                    </pre>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs tabular-nums text-card-foreground font-mono">
                        {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {logs.length} entries
      </p>
    </div>
  )
}
