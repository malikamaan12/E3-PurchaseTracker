import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Bell, Mail } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { NotificationPreference } from "@db/schema";

export function NotificationPreferences() {
  const {
    preferences,
    metadata,
    isLoading,
    error,
    updatePreference,
    getCategoryPreferences
  } = useNotificationPreferences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <div className="ml-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load notification preferences. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="space-y-4">
          {Object.entries(metadata.categories).map(([key, category]) => {
            const categoryPreferences = getCategoryPreferences(key as keyof typeof metadata.categories);

            return (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="text-lg font-semibold">
                  {category.toString().split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  ).join(' ')} Notifications
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 p-4">
                    {categoryPreferences.map((pref: NotificationPreference) => (
                      <div key={pref.id} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`enabled-${pref.id}`} className="text-base font-medium">
                            {pref.type.split('_').map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                            ).join(' ')}
                          </Label>
                          <Switch
                            id={`enabled-${pref.id}`}
                            checked={pref.enabled}
                            onCheckedChange={(checked) =>
                              updatePreference({
                                id: pref.id,
                                data: { enabled: checked }
                              })
                            }
                          />
                        </div>

                        {pref.enabled && (
                          <div className="ml-6 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor={`in-app-${pref.id}`}
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                              >
                                <Bell className="h-4 w-4" />
                                In-app notifications
                              </Label>
                              <Switch
                                id={`in-app-${pref.id}`}
                                checked={pref.inAppEnabled}
                                onCheckedChange={(checked) =>
                                  updatePreference({
                                    id: pref.id,
                                    data: { inAppEnabled: checked }
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor={`email-${pref.id}`}
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                              >
                                <Mail className="h-4 w-4" />
                                Email notifications
                              </Label>
                              <Switch
                                id={`email-${pref.id}`}
                                checked={pref.emailEnabled}
                                onCheckedChange={(checked) =>
                                  updatePreference({
                                    id: pref.id,
                                    data: { emailEnabled: checked }
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}