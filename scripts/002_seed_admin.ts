import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL = "admin@roblox-panel.com"
const ADMIN_PASSWORD = "Admin123!"

async function seedAdmin() {
  // Create user via admin API (skips email confirmation)
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: "admin",
      role: "ADMIN",
    },
  })

  if (error) {
    if (error.message.includes("already been registered")) {
      console.log("Admin user already exists, skipping.")
    } else {
      console.error("Error creating admin:", error.message)
      process.exit(1)
    }
  } else {
    console.log("Admin user created:", data.user.email)
  }

  console.log("")
  console.log("=== Default Admin Credentials ===")
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
  console.log("=================================")
  console.log("")
  console.log("Change this password after first login!")
}

seedAdmin()
