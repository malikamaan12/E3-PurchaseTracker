"use client"

import * as React from "react"
import { 
  Monitor, 
  Bell, 
  Smartphone, 
  Settings2,
  Check,
  ChevronRight,
  Zap
} from "lucide-react"
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/Popover"
import { Switch } from "@/components/ui/Switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function PWASettings() {
  const [isBadgeEnabled, setIsBadgeEnabled] = React.useState(true)
  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission>("default")

  useEffect(() => {
    // 1. Load Badge State
    const savedBadge = localStorage.getItem("pwa-badge-enabled")
    if (savedBadge === "false") setIsBadgeEnabled(false)

    // 2. Load Notification Permission
    setNotifPermission(Notification.permission)
  }, [])

  const toggleBadge = (checked: boolean) => {
    setIsBadgeEnabled(checked)
    localStorage.setItem("pwa-badge-enabled", checked ? "true" : "false")
    if (!checked && "clearAppBadge" in navigator) {
      navigator.clearAppBadge()
    }
  }

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser does not support system notifications.")
      return
    }

    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
    
    if (permission === "granted") {
      toast.success("System notifications enabled!")
    } else if (permission === "denied") {
      toast.error("Notification permission denied. Check browser settings.")
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-2.5 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-all group">
          <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden glass-card border-white/10" align="end">
        <div className="p-4 border-b border-white/5 bg-brand-primary/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5" /> PWA Native Settings
          </h3>
          <p className="text-[10px] text-muted-foreground mt-1">Configure OS-level app integration</p>
        </div>

        <div className="p-2 space-y-1">
          {/* Notification Toggle */}
          <div className="p-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-tight">System Push</p>
                <p className="text-[9px] text-muted-foreground">Native OS Alerts</p>
              </div>
            </div>
            {notifPermission === "granted" ? (
              <div className="flex items-center gap-1 text-[9px] font-bold text-brand-secondary bg-brand-secondary/10 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> ACTIVE
              </div>
            ) : (
              <button 
                onClick={requestNotifications}
                className="text-[9px] font-bold bg-brand-primary text-white px-2 py-1 rounded-md hover:scale-105 transition-transform"
              >
                ENABLE
              </button>
            )}
          </div>

          {/* Badge Toggle */}
          <div className="p-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <div className="relative">
                   <Monitor className="w-4 h-4" />
                   <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-black" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-tight">App Badge</p>
                <p className="text-[9px] text-muted-foreground">Unread Dot on Taskbar</p>
              </div>
            </div>
            <Switch checked={isBadgeEnabled} onCheckedChange={toggleBadge} />
          </div>

          {/* Startup Launch (Informational) */}
          <div className="p-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between group opacity-70">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-tight">Auto-Startup</p>
                <p className="text-[9px] text-muted-foreground">Run on System Login</p>
              </div>
            </div>
            <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">MANIFEST</div>
          </div>
        </div>

        <div className="p-3 bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Standalone Mode</span>
          </div>
          <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function useEffect(cb: () => void, deps: any[]) {
    return React.useEffect(cb, deps)
}
