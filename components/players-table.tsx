"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PlayerSnapshot, UserRole } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Search,
  Ban,
  AlertTriangle,
  UserX,
  Users,
  Filter,
  ChevronDown,
  X,
  Loader2,
  Footprints,
  MessageSquare,
  Snowflake,
  ArrowRightLeft,
  ShieldBan,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

type FilterType = "all" | "banned" | "suspicious" | "alt"

interface QuickAction {
  key: string
  label: string
  icon: typeof Ban
  color: string
  hoverColor: string
  needsReason: boolean
  needsInput?: { label: string; placeholder: string }
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "KICK",
    label: "Kick",
    icon: Footprints,
    color: "text-warning",
    hoverColor: "hover:bg-warning/10",
    needsReason: true,
  },
  {
    key: "BAN",
    label: "Ban",
    icon: ShieldBan,
    color: "text-destructive",
    hoverColor: "hover:bg-destructive/10",
    needsReason: true,
  },
  {
    key: "FREEZE",
    label: "Freeze",
    icon: Snowflake,
    color: "text-chart-2",
    hoverColor: "hover:bg-chart-2/10",
    needsReason: false,
  },
  {
    key: "MESSAGE",
    label: "Message",
    icon: MessageSquare,
    color: "text-primary",
    hoverColor: "hover:bg-primary/10",
    needsReason: false,
    needsInput: { label: "Message", placeholder: "Type a message to send..." },
  },
  {
    key: "TELEPORT",
    label: "Teleport",
    icon: ArrowRightLeft,
    color: "text-chart-3",
    hoverColor: "hover:bg-chart-3/10",
    needsReason: false,
    needsInput: { label: "Place ID", placeholder: "Target Place ID" },
  },
  {
    key: "FLAG_SUSPICIOUS",
    label: "Flag Suspicious",
    icon: AlertTriangle,
    color: "text-warning",
    hoverColor: "hover:bg-warning/10",
    needsReason: false,
  },
]

interface ActionModal {
  player: PlayerSnapshot
  action: QuickAction
}

export function PlayersTable({
  initialPlayers,
  userRole,
}: {
  initialPlayers: PlayerSnapshot[]
  userRole: UserRole
}) {
  const [players, setPlayers] = useState(initialPlayers)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)
  const [reason, setReason] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [executing, setExecuting] = useState(false)

  const canModerate = userRole === "SUPER_ADMIN" || userRole === "OWNER"

  const filtered = useMemo(() => {
    let result = players

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.username.toLowerCase().includes(q) ||
          p.display_name.toLowerCase().includes(q) ||
          p.roblox_user_id.includes(q)
      )
    }

    switch (filter) {
      case "banned":
        result = result.filter((p) => p.is_banned)
        break
      case "suspicious":
        result = result.filter((p) => p.is_suspicious)
        break
      case "alt":
        result = result.filter((p) => p.is_alt)
        break
    }

    return result
  }, [players, search, filter])

  function openAction(player: PlayerSnapshot, action: QuickAction) {
    // FLAG_SUSPICIOUS toggle immediately, no modal
    if (action.key === "FLAG_SUSPICIOUS") {
      toggleFlag(player.id, "is_suspicious", player.is_suspicious)
      return
    }
    setActionModal({ player, action })
    setReason("")
    setInputValue("")
  }

  async function toggleFlag(
    playerId: string,
    field: "is_banned" | "is_suspicious" | "is_alt",
    currentValue: boolean
  ) {
    const supabase = createClient()
    const { error } = await supabase
      .from("player_snapshots")
      .update({ [field]: !currentValue })
      .eq("id", playerId)

    if (error) {
      toast.error("Failed to update player flag")
      return
    }

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, [field]: !currentValue } : p
      )
    )

    await supabase.from("audit_logs").insert({
      action: `${!currentValue ? "SET" : "UNSET"}_${field.replace("is_", "").toUpperCase()}`,
      resource_type: "player",
      resource_id: playerId,
      details: { field, new_value: !currentValue },
    })

    toast.success(`Player ${!currentValue ? "flagged" : "unflagged"}`)
  }

  async function executeAction() {
    if (!actionModal) return
    setExecuting(true)

    const supabase = createClient()
    const { player, action } = actionModal

    // Build the payload with "reason" field (what the Lua script expects)
    const payload: Record<string, unknown> = {}
    if (reason) payload.reason = reason
    if (action.needsInput && inputValue) {
      if (action.key === "MESSAGE") payload.message = inputValue
      if (action.key === "TELEPORT") payload.place_id = inputValue
    }

    // If BAN: also mark the player as banned in the database
    if (action.key === "BAN") {
      const { error: banError } = await supabase
        .from("player_snapshots")
        .update({ is_banned: true })
        .eq("id", player.id)

      if (banError) {
        toast.error("Failed to mark player as banned")
        setExecuting(false)
        return
      }

      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, is_banned: true } : p))
      )
    }

    // Queue the command
    const { error } = await supabase.from("command_queue").insert({
      place_id: player.place_id,
      server_id: player.server_id,
      command_type: action.key,
      target_username: player.username,
      target_player_id: player.roblox_user_id,
      payload,
    })

    if (error) {
      toast.error("Failed to queue command: " + error.message)
      setExecuting(false)
      return
    }

    await supabase.from("audit_logs").insert({
      action: `QUICK_${action.key}`,
      resource_type: "player",
      resource_id: player.roblox_user_id,
      details: {
        username: player.username,
        reason: reason || null,
        ...payload,
      },
    })

    toast.success(`${action.label} command sent for ${player.display_name}`)
    setActionModal(null)
    setExecuting(false)
  }

  async function unbanPlayer(player: PlayerSnapshot) {
    const supabase = createClient()
    const { error } = await supabase
      .from("player_snapshots")
      .update({ is_banned: false })
      .eq("id", player.id)

    if (error) {
      toast.error("Failed to unban player")
      return
    }

    // Also queue UNBAN command so the Lua script knows
    await supabase.from("command_queue").insert({
      place_id: player.place_id,
      server_id: null,
      command_type: "UNBAN",
      target_username: player.username,
      target_player_id: player.roblox_user_id,
      payload: {},
    })

    setPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, is_banned: false } : p))
    )

    await supabase.from("audit_logs").insert({
      action: "QUICK_UNBAN",
      resource_type: "player",
      resource_id: player.roblox_user_id,
      details: { username: player.username },
    })

    toast.success(`${player.display_name} unbanned`)
  }

  const FILTERS: { key: FilterType; label: string; icon: typeof Users }[] = [
    { key: "all", label: "All Players", icon: Users },
    { key: "banned", label: "Banned", icon: Ban },
    { key: "suspicious", label: "Suspicious", icon: AlertTriangle },
    { key: "alt", label: "Alt Accounts", icon: UserX },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-md bg-secondary p-2", actionModal.action.color)}>
                  <actionModal.action.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">
                    {actionModal.action.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Target: {actionModal.player.display_name} (@{actionModal.player.username})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              {/* Reason field (for kick, ban) */}
              {actionModal.action.needsReason && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason shown to the player"
                    autoFocus
                    className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Extra input (message, place ID for teleport) */}
              {actionModal.action.needsInput && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {actionModal.action.needsInput.label}
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={actionModal.action.needsInput.placeholder}
                    autoFocus={!actionModal.action.needsReason}
                    className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Confirmation for dangerous actions */}
              {(actionModal.action.key === "BAN" || actionModal.action.key === "KICK") && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive">
                    {actionModal.action.key === "BAN"
                      ? "This will permanently ban the player and kick them from the server. They won't be able to rejoin."
                      : "This will immediately remove the player from the server."}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setActionModal(null)}
                  className="rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={executeAction}
                  disabled={executing || (actionModal.action.needsInput && !inputValue)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                    actionModal.action.key === "BAN" || actionModal.action.key === "KICK"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {executing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <actionModal.action.icon className="h-4 w-4" />
                  )}
                  {actionModal.action.label}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted"
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              showFilters && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <f.icon className="h-3 w-3" />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Player
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Roblox ID
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                Server
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">
                Ping
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Last Seen
              </th>
              {canModerate && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Quick Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canModerate ? 7 : 6}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm">No players found</p>
                  <p className="text-xs text-muted-foreground/70">
                    Players will appear here once your Roblox server sends data
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((player) => (
                <tr
                  key={player.id}
                  className="group transition-colors hover:bg-secondary/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-card-foreground">
                        {player.display_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{player.username}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {player.roblox_user_id}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {player.server_id.slice(0, 8)}...
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                    {player.ping}ms
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {player.is_banned && (
                        <span className="inline-flex items-center rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                          Banned
                        </span>
                      )}
                      {player.is_suspicious && (
                        <span className="inline-flex items-center rounded-sm bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
                          Suspicious
                        </span>
                      )}
                      {player.is_alt && (
                        <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Alt
                        </span>
                      )}
                      {!player.is_banned && !player.is_suspicious && !player.is_alt && (
                        <span className="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          Clean
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(player.last_seen), {
                      addSuffix: true,
                    })}
                  </td>
                  {canModerate && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {/* If banned, show unban button prominently */}
                        {player.is_banned ? (
                          <button
                            onClick={() => unbanPlayer(player)}
                            title="Unban player"
                            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">Unban</span>
                          </button>
                        ) : (
                          /* Quick action buttons */
                          QUICK_ACTIONS.map((action) => (
                            <button
                              key={action.key}
                              onClick={() => openAction(player, action)}
                              title={action.label}
                              className={cn(
                                "rounded-md p-1.5 text-muted-foreground transition-colors",
                                action.hoverColor
                              )}
                            >
                              <action.icon className="h-3.5 w-3.5" />
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {players.length} players
      </p>
    </div>
  )
}
