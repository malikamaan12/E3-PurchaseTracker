"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"

interface PWAContextType {
  isSupported: boolean
  isInstalled: boolean
  registration: ServiceWorkerRegistration | null
  unreadCount: number
}

const PWAContext = React.createContext<PWAContextType | undefined>(undefined)

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)
  const [isSupported, setIsSupported] = React.useState(false)
  const [isInstalled, setIsInstalled] = React.useState(false)

  // 1. Fetch unread count for OS Badging
  const { data: unreadStats } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiClient.notifications.getUnreadCount(),
    refetchInterval: 30000, // Sync every 30s
    refetchIntervalInBackground: false,
    staleTime: 10000,
  })

  const unreadCount = unreadStats?.count || 0

  // 2. Register Service Worker & Check Support
  React.useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      setIsSupported(true)
      
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
      }

      navigator.serviceWorker.register("/sw.js").then((reg) => {
        setRegistration(reg)
        console.log("PWA: Service Worker Registered")
      }).catch((err) => {
        console.error("PWA: Service Worker Registration Failed", err)
      })
    }
  }, [])

  // 3. Synchronize OS Badge
  React.useEffect(() => {
    const syncBadge = async () => {
      // Only sync if badging is supported and enabled in localStorage
      const isBadgeEnabled = localStorage.getItem("pwa-badge-enabled") !== "false"
      
      if (isBadgeEnabled && "setAppBadge" in navigator) {
        try {
          if (unreadCount > 0) {
            await (navigator as any).setAppBadge(unreadCount)
          } else {
            await (navigator as any).clearAppBadge()
          }
        } catch (error) {
          console.warn("PWA: Badging API failed", error)
        }
      }
    }

    syncBadge()
  }, [unreadCount])

  const value = {
    isSupported,
    isInstalled,
    registration,
    unreadCount
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
