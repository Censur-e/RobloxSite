"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Terminal, Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const COMMAND_TYPES = [
  { value: "KICK", label: "Kick Player", requiresTarget: true, description: "Remove a player from the server" },
  { value: "BAN", label: "Ban Player", requiresTarget: true, description: "Permanently ban a player" },
  { value: "UNBAN", label: "Unban Player", requiresTarget: true, description: "Remove a player's ban" },
  { value: "MESSAGE", label: "Server Message", requiresTarget: false, description: "Broadcast a message to all players" },
  { value: "SHUTDOWN", label: "Shutdown Server", requiresTarget: false, description: "Gracefully shut down a server" },
  { value: "TELEPORT", label: "Teleport Player", requiresTarget: true, description: "Teleport a player to a place" },
  { value: "CUSTOM", label: "Custom Command", requiresTarget: false, description: "Send a custom command payload" },
]

interface CommandPanelProps {
  places: { place_id: string; name: string }[]
  fixedPlaceId?: string
}

export function CommandPanel({ places, fixedPlaceId }: CommandPanelProps) {
  const [commandType, setCommandType] = useState("")
  const [targetUsername, setTargetUsername] = useState("")
  const [placeId, setPlaceId] = useState(fixedPlaceId ?? "")
  const [serverId, setServerId] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const selectedCommand = COMMAND_TYPES.find((c) => c.value === commandType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!commandType) return

    setLoading(true)

    const supabase = createClient()

    const payload: Record<string, unknown> = {}
    if (message) {
      // For KICK/BAN, store as "reason" so the Lua script can read it
      if (commandType === "KICK" || commandType === "BAN") {
        payload.reason = message
      } else {
        payload.message = message
      }
    }

    const { error } = await supabase.from("command_queue").insert({
      place_id: placeId || "global",
      server_id: serverId || null,
      command_type: commandType,
      target_username: targetUsername || null,
      payload,
    })

    if (error) {
      toast.error("Failed to queue command: " + error.message)
      setLoading(false)
      return
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      action: `EXECUTE_${commandType}`,
      resource_type: "command",
      details: { command_type: commandType, target: targetUsername, place_id: placeId },
    })

    toast.success(`Command ${commandType} queued successfully`)
    setCommandType("")
    setTargetUsername("")
    setMessage("")
    setServerId("")
    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-card-foreground">Execute Command</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {/* Command type selector */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {COMMAND_TYPES.map((cmd) => (
            <button
              key={cmd.value}
              type="button"
              onClick={() => setCommandType(cmd.value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-3 py-2.5 text-center transition-colors",
                commandType === cmd.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-muted hover:text-foreground"
              )}
            >
              <span className="text-xs font-medium">{cmd.label}</span>
            </button>
          ))}
        </div>

        {selectedCommand && (
          <p className="text-xs text-muted-foreground">{selectedCommand.description}</p>
        )}

        {/* Fields */}
        {commandType && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Place */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Place
              </label>
              {fixedPlaceId ? (
                <div className="flex h-9 items-center rounded-md border border-border bg-secondary px-3 font-mono text-sm text-muted-foreground">
                  {fixedPlaceId}
                </div>
              ) : (
                <select
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Places (Global)</option>
                  {places.map((p) => (
                    <option key={p.place_id} value={p.place_id}>
                      {p.name} ({p.place_id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Server ID */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Server ID (optional)
              </label>
              <input
                type="text"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                placeholder="Leave blank for all servers"
                className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            {/* Target username */}
            {selectedCommand?.requiresTarget && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Target Username
                </label>
                <input
                  type="text"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="Roblox username"
                  required
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Message / Payload */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {commandType === "CUSTOM" ? "JSON Payload" : "Message / Reason"}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={commandType === "CUSTOM" ? '{"action": "..."}' : "Optional reason or message"}
                rows={2}
                className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        {commandType && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Execute Command
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
