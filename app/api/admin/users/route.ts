import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify the requesting user is a SUPER_ADMIN
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, username, assigned_place_id } = body

  if (!email || !password || !username || !assigned_place_id) {
    return NextResponse.json(
      { error: "Missing required fields: email, password, username, assigned_place_id" },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    )
  }

  // Use service role to create the user (bypasses email confirmation)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: newUser, error: createError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        role: "OWNER",
        assigned_place_id,
      },
    })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "CREATE_OWNER",
    resource_type: "user",
    resource_id: newUser.user.id,
    details: { email, username, assigned_place_id },
  })

  return NextResponse.json({ user: newUser.user })
}
