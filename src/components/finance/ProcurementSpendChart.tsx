import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MonthlySpend } from "@/hooks/useFinanceProcurementStats";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp } from "lucide-react";

interface ProcurementSpendChartProps {
  data: MonthlySpend[];
  isLoading?: boolean;
}

export function ProcurementSpendChart({ data, isLoading }: ProcurementSpendChartProps) {
  // Calculate trend (compare last month to previous month)
  const lastMonth = data[data.length - 1]?.totalAmount || 0;
  const prevMonth = data[data.length - 2]?.totalAmount || 0;
  const trend = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
  const totalSpend = data.reduce((sum, m) => sum + m.totalAmount, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">{formatCurrency(payload[0].value)}</p>
          <p className="text-sm text-muted-foreground">{payload[0].payload.poCount} POs</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Procurement Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse bg-muted rounded w-full h-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Monthly Procurement Spend</CardTitle>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${trend >= 0 ? "text-green-500" : "text-red-500"}`} />
            <span className={`text-sm font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Total 6-month spend: {formatCurrency(totalSpend)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                className="text-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="totalAmount" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
