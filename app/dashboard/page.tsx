import { createClient } from "@/lib/supabase/server"
import { StatsCards } from "@/components/stats-cards"
import { RecentActivity } from "@/components/recent-activity"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  const isSuperAdmin = profile.role === "SUPER_ADMIN"
  const placeFilter = !isSuperAdmin && profile.assigned_place_id
    ? profile.assigned_place_id
    : null

  // Build queries scoped to the user's place (or global for SUPER_ADMIN)
  let playerQuery = supabase.from("player_snapshots").select("*", { count: "exact", head: true })
  let commandQuery = supabase.from("command_queue").select("*", { count: "exact", head: true })
  let pendingQuery = supabase.from("command_queue").select("*", { count: "exact", head: true }).eq("status", "PENDING")
  let logsQuery = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10)

  if (placeFilter) {
    playerQuery = playerQuery.eq("place_id", placeFilter)
    commandQuery = commandQuery.eq("place_id", placeFilter)
    pendingQuery = pendingQuery.eq("place_id", placeFilter)
    logsQuery = logsQuery.eq("user_id", user.id)
  }

  const [
    { count: playerCount },
    { count: commandCount },
    { count: pendingCount },
    { data: recentLogs },
  ] = await Promise.all([playerQuery, commandQuery, pendingQuery, logsQuery])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isSuperAdmin ? "Admin Dashboard" : "Game Dashboard"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Global overview of all games and users"
            : `Stats for your game${profile.assigned_place_id ? ` (Place: ${profile.assigned_place_id})` : ""}`}
        </p>
      </div>

      <StatsCards
        playersTracked={playerCount ?? 0}
        onlinePlayers={0}
        totalCommands={commandCount ?? 0}
        pendingCommands={pendingCount ?? 0}
      />

      <RecentActivity logs={recentLogs ?? []} />
    </div>
  )
}
