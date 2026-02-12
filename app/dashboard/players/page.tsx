import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PlayersTable } from "@/components/players-table"

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  // OWNER can only see players from their assigned place
  if (profile.role === "OWNER" && !profile.assigned_place_id) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Players</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No Place ID assigned to your account. Contact the administrator.
          </p>
        </div>
      </div>
    )
  }

  let query = supabase
    .from("player_snapshots")
    .select("*")
    .order("last_seen", { ascending: false })
    .limit(200)

  if (profile.role === "OWNER" && profile.assigned_place_id) {
    query = query.eq("place_id", profile.assigned_place_id)
  }

  const { data: players } = await query

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Players</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.role === "OWNER"
            ? `Players in your game (Place: ${profile.assigned_place_id})`
            : "Track and moderate players across all game servers"}
        </p>
      </div>

      <PlayersTable
        initialPlayers={players ?? []}
        userRole={profile.role}
      />
    </div>
  )
}
