import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Loader2 } from "lucide-react";

const SEVERITY_COLORS = {
  critical: "#ef4444",
  error: "#f97316",
  warning: "#eab308",
  info: "#3b82f6",
} as const;

interface ErrorAnalytics {
  trends: Array<{
    date: string;
    severity: keyof typeof SEVERITY_COLORS;
    count: number;
  }>;
  commonErrors: Array<{
    code: string;
    message: string;
    count: number;
    severity: keyof typeof SEVERITY_COLORS;
  }>;
  severityDistribution: Array<{
    severity: keyof typeof SEVERITY_COLORS;
    count: number;
  }>;
  recentErrors: Array<{
    id: number;
    message: string;
    severity: keyof typeof SEVERITY_COLORS;
    createdAt: string;
    aiAnalysis?: {
      prediction: string;
      suggestions: string[];
      preventiveMeasures: string[];
    };
  }>;
}

export default function ErrorDashboard() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");

  const { data: analytics, isLoading } = useQuery<ErrorAnalytics>({
    queryKey: ["/api/analytics/errors", { range: timeRange }],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">No error data available</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Error Analytics Dashboard</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Error Trend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Error Trends</CardTitle>
            <CardDescription>Error occurrence over time by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <Legend />
                  {Object.keys(SEVERITY_COLORS).map((severity) => (
                    <Line
                      key={severity}
                      type="monotone"
                      dataKey={severity}
                      stroke={SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Error Severity Distribution</CardTitle>
            <CardDescription>Distribution of errors by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.severityDistribution}
                    dataKey="count"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {analytics.severityDistribution.map((entry) => (
                      <Cell
                        key={entry.severity}
                        fill={SEVERITY_COLORS[entry.severity]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common Errors */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Most Common Errors</CardTitle>
          <CardDescription>Top errors by frequency of occurrence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.commonErrors}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="code" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background p-4 rounded-lg shadow-lg border">
                          <p className="font-medium">{data.code}</p>
                          <p className="text-sm text-muted-foreground">{data.message}</p>
                          <p className="text-sm mt-2">
                            Count: <span className="font-medium">{data.count}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count">
                  {analytics.commonErrors.map((entry) => (
                    <Cell key={entry.code} fill={SEVERITY_COLORS[entry.severity]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors with AI Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors with AI Analysis</CardTitle>
          <CardDescription>Latest errors with AI-powered insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {analytics.recentErrors.map((error) => (
              <div
                key={error.id}
                className={`p-4 rounded-lg border-l-4 border-${
                  SEVERITY_COLORS[error.severity]
                } bg-background`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium">{error.message}</h3>
                  <span className="text-sm text-muted-foreground">
                    {new Date(error.createdAt).toLocaleString()}
                  </span>
                </div>
                {error.aiAnalysis && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Prediction:</span>{" "}
                      {error.aiAnalysis.prediction}
                    </p>
                    {error.aiAnalysis.suggestions?.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">Suggestions:</span>
                        <ul className="list-disc list-inside mt-1">
                          {error.aiAnalysis.suggestions.map((suggestion, i) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}