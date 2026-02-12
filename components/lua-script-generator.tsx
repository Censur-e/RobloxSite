"use client"

import { useState } from "react"
import { Copy, Check, Code, Server, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function generateLuaScript(baseUrl: string, placeId: string, secretKey: string): string {
  return `-- ==========================================
-- Roblox Admin Dashboard - Server Script
-- Place this in ServerScriptService
-- ==========================================

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

-- Configuration
local CONFIG = {
    BASE_URL = "${baseUrl}",
    PLACE_ID = "${placeId}",
    SECRET_KEY = "${secretKey}",
    HEARTBEAT_INTERVAL = 30,   -- seconds between heartbeats
    COMMAND_POLL_INTERVAL = 5,  -- seconds between command polls
}

local SERVER_ID = HttpService:GenerateGUID(false)

-- ==========================================
-- HEARTBEAT: Send player data to dashboard
-- ==========================================
local function sendHeartbeat()
    local playerData = {}
    for _, player in ipairs(Players:GetPlayers()) do
        table.insert(playerData, {
            roblox_user_id = tostring(player.UserId),
            username = player.Name,
            display_name = player.DisplayName,
            account_age = player.AccountAge,
            ping = player:GetNetworkPing() * 1000,
        })
    end

    local success, result = pcall(function()
        return HttpService:RequestAsync({
            Url = CONFIG.BASE_URL .. "/api/roblox/heartbeat",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-api-key"] = CONFIG.SECRET_KEY,
            },
            Body = HttpService:JSONEncode({
                place_id = CONFIG.PLACE_ID,
                server_id = SERVER_ID,
                players = playerData,
            }),
        })
    end)

    if success and result.StatusCode == 200 then
        -- Heartbeat sent
    elseif success then
        warn("[AdminDashboard] Heartbeat HTTP " .. tostring(result.StatusCode) .. ": " .. tostring(result.Body))
    else
        warn("[AdminDashboard] Heartbeat failed: " .. tostring(result))
    end
end

-- ==========================================
-- COMMANDS: Poll and execute commands
-- ==========================================
local function pollCommands()
    local success, result = pcall(function()
        return HttpService:RequestAsync({
            Url = CONFIG.BASE_URL .. "/api/roblox/commands?place_id=" .. CONFIG.PLACE_ID .. "&server_id=" .. SERVER_ID,
            Method = "GET",
            Headers = {
                ["x-api-key"] = CONFIG.SECRET_KEY,
            },
        })
    end)

    if not success then
        warn("[AdminDashboard] Command poll failed: " .. tostring(result))
        return
    end

    if result.StatusCode ~= 200 then
        warn("[AdminDashboard] Command poll HTTP " .. tostring(result.StatusCode) .. ": " .. tostring(result.Body))
        return
    end

    local decodeOk, data = pcall(function()
        return HttpService:JSONDecode(result.Body)
    end)
    if not decodeOk or not data or not data.commands then return end

    for _, cmd in ipairs(data.commands) do
        local cmdSuccess, cmdError = pcall(function()
            executeCommand(cmd)
        end)

        -- Acknowledge the command
        pcall(function()
            HttpService:RequestAsync({
                Url = CONFIG.BASE_URL .. "/api/roblox/commands/ack",
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json",
                    ["x-api-key"] = CONFIG.SECRET_KEY,
                },
                Body = HttpService:JSONEncode({
                    command_id = cmd.id,
                    status = cmdSuccess and "SUCCESS" or "FAILED",
                    result_message = cmdSuccess and "OK" or tostring(cmdError),
                }),
            })
        end)
    end
end

-- ==========================================
-- BAN LIST (maintained in memory per server)
-- ==========================================
local bannedUserIds = {}

-- Check bans on player join
Players.PlayerAdded:Connect(function(player)
    if bannedUserIds[tostring(player.UserId)] then
        player:Kick("You are banned from this game.")
    end
end)

-- ==========================================
-- COMMAND EXECUTOR
-- ==========================================
function executeCommand(cmd)
    local target = nil
    if cmd.target_username then
        for _, player in ipairs(Players:GetPlayers()) do
            if player.Name == cmd.target_username then
                target = player
                break
            end
        end
    end

    local cmdType = cmd.command_type
    local reason = ""
    if cmd.payload and cmd.payload.reason then
        reason = cmd.payload.reason
    end

    if cmdType == "KICK" then
        if target then
            local kickMsg = "Kicked by admin"
            if reason ~= "" then
                kickMsg = "Kicked: " .. reason
            end
            target:Kick(kickMsg)
            print("[AdminDashboard] Kicked " .. target.Name .. " | Reason: " .. kickMsg)
        end

    elseif cmdType == "BAN" then
        if target then
            -- Add to in-memory ban list
            bannedUserIds[tostring(target.UserId)] = true
            local banMsg = "Banned from this game"
            if reason ~= "" then
                banMsg = "Banned: " .. reason
            end
            target:Kick(banMsg)
            print("[AdminDashboard] Banned " .. target.Name .. " | Reason: " .. banMsg)
        elseif cmd.target_player_id then
            -- Ban even if player is not in server (for rejoin blocking)
            bannedUserIds[cmd.target_player_id] = true
            print("[AdminDashboard] Added user " .. cmd.target_player_id .. " to ban list")
        end

    elseif cmdType == "UNBAN" then
        if cmd.target_player_id then
            bannedUserIds[cmd.target_player_id] = nil
            print("[AdminDashboard] Unbanned user " .. cmd.target_player_id)
        elseif target then
            bannedUserIds[tostring(target.UserId)] = nil
            print("[AdminDashboard] Unbanned " .. target.Name)
        end

    elseif cmdType == "FREEZE" then
        if target and target.Character then
            local humanoid = target.Character:FindFirstChildOfClass("Humanoid")
            if humanoid then
                humanoid.WalkSpeed = 0
                humanoid.JumpPower = 0
                print("[AdminDashboard] Froze " .. target.Name)
            end
        end

    elseif cmdType == "MESSAGE" then
        local msg = (cmd.payload and cmd.payload.message) or "Admin message"
        -- Use StarterGui:SetCore to show a notification to all players
        for _, player in ipairs(Players:GetPlayers()) do
            pcall(function()
                game:GetService("StarterGui"):SetCore("SendNotification", {
                    Title = "Admin",
                    Text = msg,
                    Duration = 10,
                })
            end)
        end
        print("[AdminDashboard] Sent message: " .. msg)

    elseif cmdType == "TELEPORT" then
        if target and cmd.payload and cmd.payload.place_id then
            local TeleportService = game:GetService("TeleportService")
            TeleportService:Teleport(tonumber(cmd.payload.place_id), target)
            print("[AdminDashboard] Teleporting " .. target.Name .. " to place " .. cmd.payload.place_id)
        end

    elseif cmdType == "SHUTDOWN" then
        print("[AdminDashboard] Server shutdown initiated")
        for _, player in ipairs(Players:GetPlayers()) do
            player:Kick("Server shutdown by admin")
        end

    elseif cmdType == "CUSTOM" then
        if cmd.payload and cmd.payload.script then
            loadstring(cmd.payload.script)()
        end

    else
        warn("[AdminDashboard] Unknown command: " .. cmdType)
    end
end

-- ==========================================
-- MAIN LOOP
-- ==========================================
print("[AdminDashboard] Connected | Place: " .. CONFIG.PLACE_ID .. " | Server: " .. SERVER_ID)

-- Heartbeat loop
task.spawn(function()
    while true do
        sendHeartbeat()
        task.wait(CONFIG.HEARTBEAT_INTERVAL)
    end
end)

-- Command poll loop
task.spawn(function()
    while true do
        pollCommands()
        task.wait(CONFIG.COMMAND_POLL_INTERVAL)
    end
end)
`
}

export function LuaScriptGenerator({
  placeId,
  secretKey,
  placeName,
}: {
  placeId: string
  secretKey: string
  placeName: string
}) {
  const [copied, setCopied] = useState(false)

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const script = generateLuaScript(baseUrl, placeId, secretKey)

  function handleCopy() {
    navigator.clipboard.writeText(script)
    setCopied(true)
    toast.success("Script copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Connection info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            Place ID
          </div>
          <p className="font-mono text-sm text-foreground">{placeId || "Not assigned"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Code className="h-3.5 w-3.5" />
            API Key
          </div>
          <p className="font-mono text-sm text-foreground">
            {secretKey ? secretKey.slice(0, 8) + "..." + secretKey.slice(-4) : "No place configured"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            Game
          </div>
          <p className="text-sm text-foreground">{placeName || "Not configured"}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-card-foreground">How to install</h3>
        <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
            <span>Open Roblox Studio and load your game</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
            <span>Navigate to <strong className="text-foreground">ServerScriptService</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
            <span>Create a new <strong className="text-foreground">Script</strong> (not LocalScript)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
            <span>Paste the script below and publish your game</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">5</span>
            <span>Enable <strong className="text-foreground">HttpService</strong> in Game Settings <ArrowRight className="inline h-3 w-3" /> Security</span>
          </li>
        </ol>
      </div>

      {/* Script block */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">ServerScriptService / AdminDashboard.lua</span>
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              copied
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Script
              </>
            )}
          </button>
        </div>
        <pre className="max-h-[500px] overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground/80">
          <code>{script}</code>
        </pre>
      </div>

      {!placeId && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-warning">
            No Place ID has been assigned to your account yet. Contact the site administrator to assign one.
          </p>
        </div>
      )}
    </div>
  )
}
