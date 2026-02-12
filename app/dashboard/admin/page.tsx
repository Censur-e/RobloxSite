import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminUsersPanel } from "@/components/admin-users-panel"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  // Get all OWNER accounts
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "OWNER")
    .order("created_at", { ascending: true })

  // Get all places for the place_id dropdown
  const { data: places } = await supabase
    .from("places")
    .select("place_id, name")
    .order("name", { ascending: true })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manage Game Owners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create accounts for game owners and assign them a Place ID
        </p>
      </div>

      <AdminUsersPanel users={users ?? []} places={places ?? []} />
    </div>
  )
}
