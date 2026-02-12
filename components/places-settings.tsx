"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Place } from "@/lib/types"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Server,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function PlacesSettings({ initialPlaces }: { initialPlaces: Place[] }) {
  const [places, setPlaces] = useState(initialPlaces)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [placeId, setPlaceId] = useState("")
  const [loading, setLoading] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  function generateKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = "rblx_"
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const secretKey = generateKey()

    const { data, error } = await supabase
      .from("places")
      .insert({
        name,
        place_id: placeId,
        secret_key: secretKey,
        is_default: places.length === 0,
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to add place: " + error.message)
      setLoading(false)
      return
    }

    await supabase.from("audit_logs").insert({
      action: "CREATE_PLACE",
      resource_type: "place",
      resource_id: data.id,
      details: { name, place_id: placeId },
    })

    setPlaces((prev) => [...prev, data])
    setName("")
    setPlaceId("")
    setShowForm(false)
    setLoading(false)
    toast.success("Place added successfully")
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("places").delete().eq("id", id)

    if (error) {
      toast.error("Failed to delete place")
      return
    }

    setPlaces((prev) => prev.filter((p) => p.id !== id))
    toast.success("Place deleted")
  }

  function toggleKeyVisibility(id: string) {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Places list */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-card-foreground">Roblox Places</h2>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              {places.length}
            </span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Place
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="border-b border-border bg-secondary/30 p-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Place Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Roblox Game"
                  required
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Place ID
                </label>
                <input
                  type="text"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  placeholder="123456789"
                  required
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                Add Place
              </button>
            </div>
          </form>
        )}

        {/* Places list */}
        {places.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Server className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-card-foreground">No places configured</p>
              <p className="text-xs text-muted-foreground">
                Add a Roblox place to start receiving player data
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {places.map((place) => (
              <div
                key={place.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-card-foreground">
                      {place.name}
                    </span>
                    {place.is_default && (
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Place ID: {place.place_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      Secret:{" "}
                      {visibleKeys.has(place.id)
                        ? place.secret_key
                        : "rblx_" + "*".repeat(28)}
                    </span>
                    <button
                      onClick={() => toggleKeyVisibility(place.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={visibleKeys.has(place.id) ? "Hide key" : "Show key"}
                    >
                      {visibleKeys.has(place.id) ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(place.secret_key)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Copy key"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(place.id)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API integration instructions */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-card-foreground">Roblox Integration</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Use the API endpoints below from your Roblox game server. Include the place&apos;s secret key in the
          <code className="mx-1 rounded bg-secondary px-1 py-0.5 font-mono text-foreground">x-api-key</code>
          header of every request.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {[
            { method: "POST", path: "/api/roblox/heartbeat", desc: "Send player snapshots" },
            { method: "GET", path: "/api/roblox/commands", desc: "Poll pending commands" },
            { method: "POST", path: "/api/roblox/commands/ack", desc: "Acknowledge command execution" },
          ].map((endpoint) => (
            <div
              key={endpoint.path}
              className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2"
            >
              <span
                className={cn(
                  "shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-xs font-medium",
                  endpoint.method === "POST"
                    ? "bg-chart-2/10 text-chart-2"
                    : "bg-primary/10 text-primary"
                )}
              >
                {endpoint.method}
              </span>
              <code className="flex-1 font-mono text-xs text-foreground">
                {endpoint.path}
              </code>
              <span className="text-xs text-muted-foreground">{endpoint.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
