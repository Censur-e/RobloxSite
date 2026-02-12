import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST: Acknowledge command execution result
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { command_id, status, success, result_message, message } = body

    if (!command_id) {
      return NextResponse.json({ error: "Missing command_id" }, { status: 400 })
    }

    // Support both formats:
    // Lua sends: { command_id, status: "SUCCESS"|"FAILED", result_message }
    // Old format: { command_id, success: true/false, message }
    const resolvedStatus = status === "SUCCESS" || success === true ? "SUCCESS" : "FAILED"
    const resolvedMessage = result_message || message || null

    const { error } = await supabase
      .from("command_queue")
      .update({
        status: resolvedStatus,
        executed_at: new Date().toISOString(),
        result_message: resolvedMessage,
      })
      .eq("id", command_id)

    if (error) {
      return NextResponse.json({ error: "Failed to update command" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Command ack error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
