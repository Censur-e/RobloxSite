import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PlacesSettings } from "@/components/places-settings"

export default async function SettingsPage() {
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

  const { data: places } = await supabase
    .from("places")
    .select("*")
    .order("created_at", { ascending: true })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure Roblox places and API keys
        </p>
      </div>

      <PlacesSettings initialPlaces={places ?? []} />
    </div>
  )
}
