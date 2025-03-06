import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Sun, Moon, Grid, List, Monitor } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "@/contexts/ThemeContext";

interface DashboardPreferences {
  theme: "light" | "dark" | "system";
  layout: "grid" | "list";
  defaultView: "my-requests" | "all-requests" | "pending" | "approved";
  showDrafts: boolean;
  showPriorityIndicators: boolean;
}

export default function DashboardPreferences({
  preferences,
  onUpdate,
}: {
  preferences: DashboardPreferences;
  onUpdate: (prefs: Partial<DashboardPreferences>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const { theme, setTheme } = useTheme();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px]">
        <SheetHeader>
          <SheetTitle>Dashboard Preferences</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 py-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(value) => {
                    // Update preferences
                    onUpdate({ theme: value as "light" | "dark" | "system" });
                    
                    // Update theme using ThemeContext
                    setTheme(value as "light" | "dark" | "system");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        <span>Light</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        <span>Dark</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        <span>System</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Layout</Label>
                <Select
                  value={preferences.layout}
                  onValueChange={(value) =>
                    onUpdate({ layout: value as "grid" | "list" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">
                      <div className="flex items-center gap-2">
                        <Grid className="h-4 w-4" />
                        <span>Grid View</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="list">
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4" />
                        <span>List View</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default View</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={preferences.defaultView}
                onValueChange={(value) =>
                  onUpdate({
                    defaultView: value as DashboardPreferences["defaultView"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my-requests">My Requests</SelectItem>
                  {user?.department === "CEO Office" ||
                    user?.department === "Director" ||
                    user?.department === "Finance" ? (
                    <>
                      <SelectItem value="all-requests">All Requests</SelectItem>
                      <SelectItem value="pending">Pending Requests</SelectItem>
                      <SelectItem value="approved">Approved Requests</SelectItem>
                    </>
                  ) : null}
                </SelectContent>
              </Select>

              <div className="flex items-center justify-between">
                <Label>Show Drafts Section</Label>
                <Switch
                  checked={preferences.showDrafts}
                  onCheckedChange={(checked) => onUpdate({ showDrafts: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Show Priority Indicators</Label>
                <Switch
                  checked={preferences.showPriorityIndicators}
                  onCheckedChange={(checked) =>
                    onUpdate({ showPriorityIndicators: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}