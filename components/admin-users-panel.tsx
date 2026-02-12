"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { toast } from "sonner"
import { UserPlus, Loader2, X, UserX, UserCheck, Gamepad2, Copy, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface PlaceOption {
  place_id: string
  name: string
}

export function AdminUsersPanel({
  users: initialUsers,
  places,
}: {
  users: Profile[]
  places: PlaceOption[]
}) {
  const [users, setUsers] = useState(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    assigned_place_id: "",
  })

  function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$"
    let pass = ""
    for (let i = 0; i < 12; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)]
    }
    setForm((f) => ({ ...f, password: pass }))
  }

  async function createUser() {
    setCreating(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create user")
        return
      }
      const newProfile: Profile = {
        id: data.user.id,
        email: form.email,
        username: form.username,
        role: "OWNER",
        is_active: true,
        assigned_place_id: form.assigned_place_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setUsers((prev) => [...prev, newProfile])
      setGeneratedPassword(form.password)
      setForm({ email: "", password: "", username: "", assigned_place_id: "" })
      setShowCreate(false)
      toast.success("Owner account created")
    } catch {
      toast.error("Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(userId: string, currentActive: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq("id", userId)

    if (error) {
      toast.error("Failed to update status")
      return
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, is_active: !currentActive } : u
      )
    )

    await supabase.from("audit_logs").insert({
      action: currentActive ? "DEACTIVATE_USER" : "ACTIVATE_USER",
      resource_type: "user",
      resource_id: userId,
    })

    toast.success(currentActive ? "Account deactivated" : "Account activated")
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Success banner with credentials */}
      {generatedPassword && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">Account Created - Save These Credentials</h3>
            <button
              onClick={() => setGeneratedPassword("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Copy these credentials now. The password cannot be recovered later.
          </p>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 font-mono text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Password:</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground">{generatedPassword}</span>
                <button
                  onClick={() => copyToClipboard(generatedPassword)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create user section */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Create Owner Account
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-card-foreground">New Game Owner</h3>
            <button
              onClick={() => setShowCreate(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="owner@example.com"
                className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="GameOwner"
                className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="h-9 w-full rounded-md border border-border bg-input px-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="shrink-0 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-muted"
                >
                  Generate
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Assigned Place ID
              </label>
              {places.length > 0 ? (
                <select
                  value={form.assigned_place_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_place_id: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-input px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a place...</option>
                  {places.map((p) => (
                    <option key={p.place_id} value={p.place_id}>
                      {p.name} ({p.place_id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.assigned_place_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_place_id: e.target.value }))}
                  placeholder="e.g. 123456789"
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          </div>
          <button
            onClick={createUser}
            disabled={creating || !form.email || !form.password || !form.username || !form.assigned_place_id}
            className="mt-3 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Create Account
          </button>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Place ID
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No owner accounts yet. Create one above.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-card-foreground">
                        {user.username}
                      </span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Gamepad2 className="h-3.5 w-3.5 text-primary" />
                      <span className="font-mono text-xs text-foreground">
                        {user.assigned_place_id || "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                        user.is_active
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {user.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground lg:table-cell">
                    {format(new Date(user.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => toggleActive(user.id, user.is_active)}
                        title={user.is_active ? "Disable account" : "Enable account"}
                        className={cn(
                          "rounded-md p-1.5 transition-colors",
                          user.is_active
                            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
