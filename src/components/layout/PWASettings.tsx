"use client"

import * as React from "react"
import { 
  Monitor, 
  Bell, 
  Smartphone, 
  Settings2,
  Check,
  ChevronRight,
  Zap,
  Download
} from "lucide-react"
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/Popover"
import { Switch } from "@/components/ui/Switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePWA } from "@/context/PWAContext"

export function PWASettings() {
  const { isSupported, isInstalled, unreadCount } = usePWA()
  const [isBadgeEnabled, setIsBadgeEnabled] = React.useState(true)
  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission>("default")
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null)

  useEffect(() => {
    // 1. Load Badge State
    const savedBadge = localStorage.getItem("pwa-badge-enabled")
    if (savedBadge === "false") setIsBadgeEnabled(false)

    // 2. Load Notification Permission
    setNotifPermission(Notification.permission)

    // 3. Listen for Install Prompt
    const handlePrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener("beforeinstallprompt", handlePrompt)
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt)
  }, [])

  const toggleBadge = (checked: boolean) => {
    setIsBadgeEnabled(checked)
    localStorage.setItem("pwa-badge-enabled", checked ? "true" : "false")
    if (!checked && "clearAppBadge" in navigator) {
      navigator.clearAppBadge()
    } else if (checked && "setAppBadge" in navigator && unreadCount > 0) {
      (navigator as any).setAppBadge(unreadCount)
    }
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
      toast.success("E3 Procurement is being installed...")
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
        <button className="p-2.5 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-all group relative">
          <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && isBadgeEnabled && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full border-2 border-background" />
          )}
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
          {/* INSTALL PROMPT */}
          {deferredPrompt && (
            <button 
              onClick={handleInstall}
              className="w-full p-3 mb-2 rounded-xl bg-brand-primary text-white flex items-center justify-between group active-scale"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4" />
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-tight">Install Platform</p>
                  <p className="text-[9px] opacity-80 font-bold">Add to OS Home Screen</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>
          )}

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
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isInstalled ? "bg-emerald-500" : "bg-zinc-500")} />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              {isInstalled ? "Premium Standalone Mode" : "Web Preview Mode"}
            </span>
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
