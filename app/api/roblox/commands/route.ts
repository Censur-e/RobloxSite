import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET: Poll for pending commands for this place/server
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 })
    }

    const supabase = getServiceClient()

    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("place_id")
      .eq("secret_key", apiKey)
      .single()

    if (placeError || !place) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 403 })
    }

    const serverId = request.nextUrl.searchParams.get("server_id")

    // Build a single .or() filter combining place_id and server_id conditions
    // We want: status = PENDING AND place_id = X AND (server_id = Y OR server_id IS NULL)
    let query = supabase
      .from("command_queue")
      .select("*")
      .eq("status", "PENDING")
      .eq("place_id", place.place_id)
      .order("created_at", { ascending: true })
      .limit(20)

    if (serverId) {
      query = query.or(`server_id.eq.${serverId},server_id.is.null`)
    }

    const { data: commands, error } = await query

    if (error) {
      console.error("[v0] Commands query error:", error)
      return NextResponse.json({ commands: [] })
    }

    // Mark commands as SENT
    if (commands && commands.length > 0) {
      const ids = commands.map((c) => c.id)
      await supabase
        .from("command_queue")
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .in("id", ids)
    }

    return NextResponse.json({ commands: commands ?? [] })
  } catch (err) {
    console.error("[v0] Commands poll error:", err)
    return NextResponse.json({ commands: [] })
  }
}
