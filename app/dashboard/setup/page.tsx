import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LuaScriptGenerator } from "@/components/lua-script-generator"

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "OWNER") {
    redirect("/dashboard")
  }

  // Get the place details if it exists
  const { data: place } = profile.assigned_place_id
    ? await supabase
        .from("places")
        .select("*")
        .eq("place_id", profile.assigned_place_id)
        .single()
    : { data: null }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Server Script Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add this script to your Roblox game to connect it to the dashboard
        </p>
      </div>

      <LuaScriptGenerator
        placeId={profile.assigned_place_id ?? ""}
        secretKey={place?.secret_key ?? ""}
        placeName={place?.name ?? ""}
      />
    </div>
  )
}
