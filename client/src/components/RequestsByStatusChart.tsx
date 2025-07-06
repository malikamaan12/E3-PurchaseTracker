import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface RequestsByStatusChartProps {
  data: StatusData[];
  title?: string;
  className?: string;
  showLegend?: boolean;
  chartHeight?: number;
  onRefresh?: () => void;
  onExport?: () => void;
  description?: string;
}

const DEFAULT_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1', '#8B5CF6', '#EC4899'];

export function RequestsByStatusChart({
  data,
  title = "Requests by Status",
  className = "",
  showLegend = true,
  chartHeight = 320,
  onRefresh,
  onExport,
  description
}: RequestsByStatusChartProps) {
  // Filter out zero values for cleaner display
  const filteredData = data.filter(item => item.value > 0);

  // Custom label formatter
  const renderCustomLabel = ({ name, value, percent }: any) => {
    const percentage = (percent * 100).toFixed(0);
    return value > 0 ? `${name}: ${value} (${percentage}%)` : null;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const totalValue = filteredData.reduce((sum, item) => sum + item.value, 0);
      const percentage = totalValue > 0 ? ((dataPoint.value / totalValue) * 100).toFixed(1) : '0';
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{dataPoint.name}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-medium">{dataPoint.value}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-medium">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Create action buttons
  const actions = (
    <>
      {onRefresh && (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {onExport && (
        <Button variant="ghost" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
        </Button>
      )}
    </>
  );

  if (filteredData.length === 0) {
    return (
      <ChartCard title={title} description={description} actions={actions} className={className}>
        <div className="flex items-center justify-center h-80 text-muted-foreground">
          No data available
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={title} description={description} actions={actions} className={className}>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={Math.min(chartHeight / 3, 100)}
              fill="#8884d8"
              dataKey="value"
            >
              {filteredData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && (
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value: string) => (
                  <span className="text-sm">{value}</span>
                )}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// Hook for preparing status data
export function useRequestStatusData(requests: any[]) {
  const statusCounts = requests.reduce((acc, request) => {
    const status = request.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData: StatusData[] = [
    { name: "Approved", value: statusCounts.approved || 0, color: "#10B981" },
    { name: "Rejected", value: statusCounts.rejected || 0, color: "#EF4444" },
    { name: "Pending", value: statusCounts.pending || 0, color: "#F59E0B" },
    { name: "Draft", value: statusCounts.draft || 0, color: "#6366F1" },
    { name: "Changes Requested", value: statusCounts.changes_requested || 0, color: "#8B5CF6" },
  ];

  return statusData;
}