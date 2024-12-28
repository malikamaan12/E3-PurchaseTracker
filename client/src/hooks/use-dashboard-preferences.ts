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

const defaultPreferences: DashboardPreferences = {
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
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    const saved = localStorage.getItem("dashboard-preferences");
    return saved ? JSON.parse(saved) : defaultPreferences;
  });

  useEffect(() => {
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
  }, [preferences]);

  const updatePreferences = (updates: Partial<DashboardPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setPreferences((prev) => ({
      ...prev,
      defaultDepartmentFilter: "all",
      defaultPurposeFilter: "all",
      defaultPriorityFilter: "all"
    }));
  };

  return {
    preferences,
    updatePreferences,
    resetFilters,
  };
}