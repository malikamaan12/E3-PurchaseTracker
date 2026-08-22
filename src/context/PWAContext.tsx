"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"

interface PWAContextType {
  isSupported: boolean
  isInstalled: boolean
  registration: ServiceWorkerRegistration | null
  unreadCount: number
  hasUpdate: boolean
  isSyncing: boolean
  refreshAppAndData: () => Promise<void>
  applyUpdate: () => void
}

const PWAContext = React.createContext<PWAContextType | undefined>(undefined)

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)
  const [isSupported, setIsSupported] = React.useState(false)
  const [isInstalled, setIsInstalled] = React.useState(false)
  const [hasUpdate, setHasUpdate] = React.useState(false)
  const [waitingWorker, setWaitingWorker] = React.useState<ServiceWorker | null>(null)
  const [isSyncing, setIsSyncing] = React.useState(false)

  // 1. Fetch unread count for OS Badging
  const { data: unreadStats, refetch: refetchUnread } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiClient.notifications.getUnreadCount(),
    refetchInterval: 30000, // Sync every 30s
    refetchIntervalInBackground: false,
    staleTime: 10000,
  })

  const unreadCount = unreadStats?.count || 0

  // 2. Apply Service Worker Update
  const applyUpdate = React.useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" })
    }
    window.location.reload()
  }, [waitingWorker])

  // 3. Register Service Worker & Auto-Push Updates
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    setIsSupported(true)

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg)

        // Check if there's already a worker waiting
        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
          setHasUpdate(true)
          promptUpdate(reg.waiting)
        }

        // Listen for new updates being installed
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker)
                setHasUpdate(true)
                promptUpdate(newWorker)
              }
            })
          }
        })
      })
      .catch((err) => {
        console.warn("PWA: Service Worker Registration Warning:", err)
      })

    // Listen for controlling service worker change
    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })

    // Auto-check for updates every 5 minutes
    const interval = setInterval(() => {
      if (registration) {
        registration.update().catch(() => {})
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [registration])

  function promptUpdate(worker: ServiceWorker) {
    toast.info("A new version of PurchaseTracker is ready!", {
      duration: 12000,
      action: {
        label: "Update Now",
        onClick: () => {
          worker.postMessage({ type: "SKIP_WAITING" })
          window.location.reload()
        },
      },
    })
  }

  // 4. Synchronize OS Badge
  React.useEffect(() => {
    const syncBadge = async () => {
      const isBadgeEnabled = localStorage.getItem("pwa-badge-enabled") !== "false"
      if (isBadgeEnabled && "setAppBadge" in navigator) {
        try {
          if (unreadCount > 0) {
            await (navigator as any).setAppBadge(unreadCount)
          } else {
            await (navigator as any).clearAppBadge()
          }
        } catch (error) {
          // Ignore badging errors
        }
      }
    }
    syncBadge()
  }, [unreadCount])

  // 5. Global Manual Refresh / Sync Function
  const refreshAppAndData = React.useCallback(async () => {
    setIsSyncing(true)
    try {
      // 1. Check for Service Worker updates
      if (registration) {
        await registration.update().catch(() => {})
      }

      // 2. Invalidate and refetch all active TanStack queries
      await Promise.all([
        queryClient.invalidateQueries(),
        refetchUnread(),
      ])

      toast.success("Synchronized: Latest data and updates loaded.", {
        duration: 2500,
      })
    } catch (err: any) {
      toast.error("Sync encountered an error: " + (err?.message || "Please retry"))
    } finally {
      setIsSyncing(false)
    }
  }, [queryClient, registration, refetchUnread])

  const value = {
    isSupported,
    isInstalled,
    registration,
    unreadCount,
    hasUpdate,
    isSyncing,
    refreshAppAndData,
    applyUpdate,
  }

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>
}

export function usePWA() {
  const context = React.useContext(PWAContext)
  if (context === undefined) {
    throw new Error("usePWA must be used within a PWAProvider")
  }
  return context
}
