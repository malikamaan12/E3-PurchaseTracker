import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

interface PurposeData {
  name: string;
  value: number;
  color?: string;
}

interface RequestsByPurposeChartProps {
  data: PurposeData[];
  title?: string;
  className?: string;
  chartHeight?: number;
  onRefresh?: () => void;
  onExport?: () => void;
  description?: string;
  barColor?: string;
}

const DEFAULT_BAR_COLOR = "#6366F1";

export function RequestsByPurposeChart({
  data,
  title = "Requests by Purpose",
  className = "",
  chartHeight = 320,
  onRefresh,
  onExport,
  description,
  barColor = DEFAULT_BAR_COLOR
}: RequestsByPurposeChartProps) {
  // Filter out zero values for cleaner display
  const filteredData = data.filter(item => item.value > 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-medium">{data.value}</span>
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
          <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={12}
            />
            <YAxis fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              fill={barColor}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// Hook for preparing purpose data
export function useRequestPurposeData(requests: any[]) {
  const purposeCounts = requests.reduce((acc, request) => {
    const purpose = request.purposeType || 'Unknown';
    acc[purpose] = (acc[purpose] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const purposeData: PurposeData[] = Object.entries(purposeCounts).map(([name, value]) => ({
    name,
    value: value as number
  }));

  return purposeData;
}