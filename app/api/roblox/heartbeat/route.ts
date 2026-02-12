import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Uses service role to bypass RLS - this is the Roblox server endpoint
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 })
    }

    const supabase = getServiceClient()

    // Verify the API key matches a place
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("place_id")
      .eq("secret_key", apiKey)
      .single()

    if (placeError || !place) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 403 })
    }

    const body = await request.json()
    const { server_id, players } = body

    if (!server_id || !Array.isArray(players)) {
      return NextResponse.json(
        { error: "Missing server_id or players array" },
        { status: 400 }
      )
    }

    // Upsert player snapshots
    for (const player of players) {
      const { error } = await supabase
        .from("player_snapshots")
        .upsert(
          {
            place_id: place.place_id,
            server_id,
            roblox_user_id: String(player.roblox_user_id || player.user_id),
            username: player.username,
            display_name: player.display_name || player.username,
            account_age: player.account_age || 0,
            ping: player.ping || 0,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "id" }
        )

      if (error) {
        console.error("Failed to upsert player:", error)
      }
    }

    return NextResponse.json({ ok: true, players_synced: players.length })
  } catch (err) {
    console.error("Heartbeat error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
