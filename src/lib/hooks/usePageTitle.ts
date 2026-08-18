"use client";

import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${title} | E3 Purchase Tracker`;
    }
  }, [title]);
}
