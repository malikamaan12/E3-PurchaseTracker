import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  
  // Initialize theme once on mount
  useEffect(() => {
    const currentTheme = localStorage.getItem("theme") as Theme || "system";
    setTheme(currentTheme);
    
    // Initial application of theme
    applyTheme(currentTheme);
    
    // Setup system theme change listener
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (currentTheme === "system") {
        if (mediaQuery.matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  
  // Function to apply theme without state changes
  const applyTheme = (selectedTheme: Theme) => {
    if (selectedTheme === "dark" || 
        (selectedTheme === "system" && 
         window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };
  
  function setThemeMode(newTheme: Theme) {
    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
    applyTheme(newTheme);
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="border-[#7156a2]/20 hover:bg-[#7156a2]/10 dark:border-[#7156a2]/50 dark:hover:bg-[#7156a2]/30">
          {theme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : theme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setThemeMode("light")}>
          <Sun className="h-4 w-4 mr-2" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode("dark")}>
          <Moon className="h-4 w-4 mr-2" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode("system")}>
          <Monitor className="h-4 w-4 mr-2" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}