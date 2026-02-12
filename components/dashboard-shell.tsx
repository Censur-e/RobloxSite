"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import {
  LayoutDashboard,
  Users,
  Terminal,
  ScrollText,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Code,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const SUPER_ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin", label: "Manage Users", icon: Shield },
  { href: "/dashboard/settings", label: "Places", icon: Settings },
  { href: "/dashboard/audit", label: "Audit Logs", icon: ScrollText },
]

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/players", label: "Players", icon: Users },
  { href: "/dashboard/commands", label: "Commands", icon: Terminal },
  { href: "/dashboard/setup", label: "Server Script", icon: Code },
]

export function DashboardShell({
  children,
  profile,
}: {
  children: React.ReactNode
  profile: Profile
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const isSuperAdmin = profile.role === "SUPER_ADMIN"
  const navItems = isSuperAdmin ? SUPER_ADMIN_NAV : OWNER_NAV

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
              <Gamepad2 className="h-4 w-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {isSuperAdmin ? "Admin Panel" : "Game Panel"}
              </span>
            )}
          </div>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="mx-3 mt-3 rounded-md border border-border bg-secondary/50 px-3 py-1.5">
            <span className={cn(
              "font-mono text-[10px] font-semibold uppercase tracking-widest",
              isSuperAdmin ? "text-destructive" : "text-primary"
            )}>
              {isSuperAdmin ? "Super Admin" : "Game Owner"}
            </span>
            {!isSuperAdmin && profile.assigned_place_id && (
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                Place: {profile.assigned_place_id}
              </p>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-1" role="list">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2">
          {/* User info */}
          <div className={cn(
            "mb-2 flex items-center gap-2.5 rounded-md px-3 py-2",
            collapsed && "justify-center px-0"
          )}>
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase",
              isSuperAdmin
                ? "bg-destructive/20 text-destructive"
                : "bg-primary/20 text-primary"
            )}>
              {profile.username[0]}
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {profile.username}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </span>
              </div>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "justify-center"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
