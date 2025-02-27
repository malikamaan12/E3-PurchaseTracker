import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Clock, Brain, ArrowUpRight, BarChart2 } from "lucide-react";
import { ErrorPredictionDisplay } from "./ErrorPredictionDisplay";

// Demo data for predictions
const DEMO_ERROR_PREDICTIONS = [
  {
    id: 1,
    context: "Purchase request submission",
    predictions: [
      "Approval delays likely due to high request volume",
      "Items with incomplete descriptions may be rejected",
      "Approvers may request additional documentation"
    ],
    suggestions: [
      "Submit requests before 2PM for same-day processing",
      "Include detailed item descriptions and justification",
      "Attach vendor quotes and relevant documentation"
    ],
    severity: "medium",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
  },
  {
    id: 2,
    context: "User account management",
    predictions: [
      "Password reset requests tend to increase on Monday mornings",
      "New user accounts may experience permissions delays",
      "Role changes might not propagate immediately"
    ],
    suggestions: [
      "Schedule account changes during low-traffic periods",
      "Verify permissions after account creation",
      "Allow 15 minutes for role changes to take effect"
    ],
    severity: "low",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
  },
  {
    id: 3,
    context: "Database operations",
    predictions: [
      "Connection pool reaching capacity during peak hours",
      "Query timeouts possible during report generation",
      "Transaction locks may occur with concurrent updates"
    ],
    suggestions: [
      "Schedule large reports during off-peak hours",
      "Implement retry logic for critical operations",
      "Use shorter transactions where possible"
    ],
    severity: "high",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 minutes ago
  }
];

const DEMO_SYSTEM_INSIGHTS = [
  {
    metric: "Error prediction accuracy",
    value: "87%",
    trend: "up",
    description: "Based on confirmed outcomes of previous predictions"
  },
  {
    metric: "Proactive resolutions",
    value: "24",
    trend: "up",
    description: "Issues prevented by acting on predictions this week"
  },
  {
    metric: "Average response time",
    value: "2.4s",
    trend: "down",
    description: "System response time improvement from proactive optimizations"
  }
];

// Severity badge styling
const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
};

export default function ErrorPredictionDashboard() {
  const [activeTab, setActiveTab] = useState("predictions");
  const [predictions, setPredictions] = useState(DEMO_ERROR_PREDICTIONS);
  const { toast } = useToast();

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Add a new prediction every 30 seconds for demo purposes
      if (Math.random() > 0.6) {
        const newPrediction = {
          id: predictions.length + 1,
          context: "Document processing",
          predictions: [
            "File conversion could fail for large documents",
            "OCR accuracy may be reduced for low-quality scans"
          ],
          suggestions: [
            "Split documents larger than 10MB",
            "Use high-resolution scanner settings for better OCR results"
          ],
          severity: Math.random() > 0.5 ? "medium" : "low",
          timestamp: new Date().toISOString()
        };
        
        setPredictions(prev => [newPrediction, ...prev]);
        
        // Show toast notification for new prediction
        toast({
          title: "New Error Prediction",
          description: "Predictions for document processing have been generated",
          variant: "default",
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [predictions, toast]);

  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#191160]">Intelligent Error Prediction</h1>
        <p className="text-muted-foreground mt-2">
          Proactively identify potential issues before they occur
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="predictions" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span>Predictions</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <span>Insights</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center justify-between">
                    <span>Active Predictions</span>
                    <Badge className="ml-2">{predictions.length}</Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  Preemptive error predictions based on system activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {predictions.map((prediction) => (
                      <Card key={prediction.id} className="border-l-4" style={{
                        borderLeftColor: prediction.severity === 'high' ? '#ef4444' :
                                        prediction.severity === 'medium' ? '#f59e0b' : '#10b981'
                      }}>
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{prediction.context}</CardTitle>
                              <CardDescription className="text-xs">
                                {new Date(prediction.timestamp).toLocaleString()}
                              </CardDescription>
                            </div>
                            <Badge className={`${getSeverityColor(prediction.severity)}`}>
                              {prediction.severity}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <ErrorPredictionDisplay
                            context={prediction.context}
                            predictions={prediction.predictions}
                            suggestions={prediction.suggestions}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">System Health</CardTitle>
                  <CardDescription>
                    Current prediction system status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Prediction Engine</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" /> Optimal
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Database Analysis</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" /> Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">User Activity Monitoring</span>
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Partial
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => {
                      toast({
                        title: "Analysis Started",
                        description: "Deep system analysis has been initiated",
                        variant: "default",
                      });
                    }}>
                      <Brain className="h-4 w-4 mr-2" /> Run Deep Analysis
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => {
                      toast({
                        title: "Optimization Complete",
                        description: "System has been optimized based on predictions",
                        variant: "default",
                      });
                    }}>
                      <ArrowUpRight className="h-4 w-4 mr-2" /> Apply Optimizations
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEMO_SYSTEM_INSIGHTS.map((insight, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-lg">{insight.metric}</CardTitle>
                  <CardDescription>{insight.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold">{insight.value}</span>
                    {insight.trend === "up" ? (
                      <span className="text-green-500 flex items-center">
                        <ArrowUpRight className="h-4 w-4" /> Improved
                      </span>
                    ) : (
                      <span className="text-green-500 flex items-center">
                        <ArrowUpRight className="h-4 w-4 transform rotate-90" /> Reduced
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Prediction History</CardTitle>
              <CardDescription>
                Track how predictions have prevented issues over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <h4 className="font-medium">Database connection timeout predicted</h4>
                    <p className="text-sm text-muted-foreground">
                      Connection pool increased before peak hours
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Prevented</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <h4 className="font-medium">Form validation errors predicted</h4>
                    <p className="text-sm text-muted-foreground">
                      Added additional validation guidance to users
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Prevented</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <h4 className="font-medium">Authentication token expiration</h4>
                    <p className="text-sm text-muted-foreground">
                      Added preemptive refresh mechanism
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Prevented</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
