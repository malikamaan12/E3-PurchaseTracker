"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { useAuth } from "@/context/AuthContext"

/**
 * PWAManager Component
 * Handles native OS integrations: Service Worker registration, App Badging, and Push Notifications.
 */
export default function PWAManager() {
  const { user } = useAuth()
  
  const { data: unreadStats } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiClient.notifications.getUnreadCount(),
    refetchInterval: 30000,
    enabled: !!user,
  })

  // 1. SERVICE WORKER REGISTRATION
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.hostname !== "localhost") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered successfully.", reg.scope)
        })
        .catch((err) => {
          console.error("[PWA] Service Worker registration failed:", err)
        })
    }
  }, [])

  // 2. APP ICON BADGING & SYSTEM NOTIFICATIONS
  useEffect(() => {
    const isBadgeEnabled = localStorage.getItem("pwa-badge-enabled") !== "false"
    
    if (unreadStats && "setAppBadge" in navigator && isBadgeEnabled) {
      const count = unreadStats.count
      if (count > 0) {
        navigator.setAppBadge(count).catch((error) => {
          console.error("[PWA] Error setting app badge:", error)
        })

        // TRIGGER SYSTEM NOTIFICATION IF BACKGROUNDED
        const isNotifEnabled = Notification.permission === "granted"
        if (isNotifEnabled && document.visibilityState === "hidden") {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("New Procurement Alert", {
              body: `You have ${count} unread notifications in PurchaseTracker.`,
              icon: "/logo-color.png",
              badge: "/logo-color.png",
              tag: "purchase-tracker-notif", // Prevents duplicates
              data: { url: "/dashboard/requests" }
            })
          })
        }
      } else {
        navigator.clearAppBadge().catch((error) => {
          console.error("[PWA] Error clearing app badge:", error)
        })
      }
    }
  }, [unreadStats])

  return null // Non-visual component
}
