"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ShoppingBag, 
  Building, 
  PieChart, 
  ShieldAlert, 
  Menu,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavigationSheet } from "./NavigationSheet";

const BOTTOM_NAV_ITEMS = [
  { name: "Purchases", path: "/dashboard/requests", icon: ShoppingBag },
  { name: "Vendors", path: "/dashboard/vendors", icon: Building },
  { name: "Analytics", path: "/dashboard/analytics", icon: PieChart },
  { name: "Compliance", path: "/dashboard/compliance", icon: ShieldAlert },
];

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  return (
    <>
      <nav 
        aria-label="Mobile Navigation Bar" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-[150] bg-background/95 backdrop-blur-md border-t border-border/80 px-2 pt-1 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <div className="grid grid-cols-5 items-center justify-around h-14 max-w-lg mx-auto">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                aria-label={item.name}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl transition-all touch-target h-12",
                  isActive
                    ? "text-brand-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-1 rounded-lg transition-colors relative",
                  isActive && "bg-brand-primary/10 text-brand-primary"
                )}>
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-primary" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight leading-none font-medium truncate max-w-[56px]">
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* More Tab */}
          <button
            type="button"
            onClick={() => setIsMoreSheetOpen(true)}
            aria-label="Open more menu options and system settings"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl transition-all touch-target h-12",
              isMoreSheetOpen || pathname.startsWith("/dashboard/admin")
                ? "text-brand-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-1 rounded-lg transition-colors relative",
              (isMoreSheetOpen || pathname.startsWith("/dashboard/admin")) && "bg-brand-primary/10 text-brand-primary"
            )}>
              <Menu className="w-5 h-5" />
              {pathname.startsWith("/dashboard/admin") && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-primary" />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none font-medium">
              More
            </span>
          </button>
        </div>
      </nav>

      <NavigationSheet 
        isOpen={isMoreSheetOpen} 
        onClose={() => setIsMoreSheetOpen(false)} 
      />
    </>
  );
}
