import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CommandPanel } from "@/components/command-panel"
import { CommandHistory } from "@/components/command-history"

export default async function CommandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  const isOwner = profile.role === "OWNER"
  const ownerPlaceId = isOwner ? profile.assigned_place_id : null

  // Fetch commands scoped to the owner's place
  let commandQuery = supabase
    .from("command_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (ownerPlaceId) {
    commandQuery = commandQuery.eq("place_id", ownerPlaceId)
  }

  const { data: commands } = await commandQuery

  // For OWNER, they don't need a place selector -- it's auto-scoped
  // For SUPER_ADMIN, fetch all places
  const { data: places } = isOwner
    ? { data: [] }
    : await supabase.from("places").select("place_id, name").order("name")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Commands</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwner
            ? `Execute commands for your game (Place: ${ownerPlaceId})`
            : "Execute server commands and view command history"}
        </p>
      </div>

      <CommandPanel
        places={places ?? []}
        fixedPlaceId={ownerPlaceId ?? undefined}
      />

      <CommandHistory commands={commands ?? []} />
    </div>
  )
}
