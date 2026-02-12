export type UserRole = "SUPER_ADMIN" | "OWNER"

export interface Profile {
  id: string
  email: string
  username: string
  role: UserRole
  is_active: boolean
  assigned_place_id: string | null
  created_at: string
  updated_at: string
}

export interface Place {
  id: string
  place_id: string
  name: string
  secret_key: string
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlayerSnapshot {
  id: string
  place_id: string
  server_id: string
  roblox_user_id: string
  username: string
  display_name: string
  account_age: number
  join_time: string
  ping: number
  is_banned: boolean
  is_suspicious: boolean
  is_alt: boolean
  last_seen: string
  created_at: string
}

export type CommandStatus = "PENDING" | "SENT" | "SUCCESS" | "FAILED" | "EXPIRED"

export interface Command {
  id: string
  place_id: string
  server_id: string | null
  command_type: string
  target_player_id: string | null
  target_username: string | null
  payload: Record<string, unknown>
  status: CommandStatus
  created_by: string | null
  created_at: string
  sent_at: string | null
  executed_at: string | null
  result_message: string | null
  expires_at: string | null
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  created_at: string
}
