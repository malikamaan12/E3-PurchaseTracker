import { useState, useEffect } from "react";

export interface DashboardPreferences {
  theme: "light" | "dark" | "system";
  layout: "grid" | "list";
  defaultView: "my-requests" | "all-requests" | "pending" | "approved";
  showDrafts: boolean;
  showPriorityIndicators: boolean;
  defaultDepartmentFilter: string;
  defaultPurposeFilter: string;
  defaultPriorityFilter: string;
}

export const DEFAULT_PREFERENCES: DashboardPreferences = {
  theme: "system",
  layout: "list",
  defaultView: "my-requests",
  showDrafts: true,
  showPriorityIndicators: true,
  defaultDepartmentFilter: "all",
  defaultPurposeFilter: "all",
  defaultPriorityFilter: "all",
};

export function useDashboardPreferences() {
  // Initialize state with default preferences
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    try {
      const saved = localStorage.getItem("dashboard-preferences");
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch (error) {
      console.error("Error loading preferences:", error);
      return DEFAULT_PREFERENCES;
    }
  });

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("dashboard-preferences", JSON.stringify(preferences));

      // Apply theme preference
      const root = window.document.documentElement;
      if (preferences.theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.remove("light", "dark");
        root.classList.add(systemTheme);
      } else {
        root.classList.remove("light", "dark");
        root.classList.add(preferences.theme);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    }
  }, [preferences]);

  const updatePreferences = (updates: Partial<DashboardPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
}