import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { PurchaseOrderReport } from "@/components/reports/PurchaseOrderReport";
import { StockMovementReport } from "@/components/reports/StockMovementReport";
import { AssemblyOrderReport } from "@/components/reports/AssemblyOrderReport";
import { SalesOrderReport } from "@/components/reports/SalesOrderReport";
import { BarChart3 } from "lucide-react";

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  roles: string[];
  component: React.ComponentType<{ dateRange: { from: Date; to: Date } }>;
}

const reportConfigs: ReportConfig[] = [
  {
    id: "purchase-orders",
    title: "Purchase Orders",
    description: "Summary of purchase orders by status, supplier, and spending",
    roles: ["Admin", "CEO", "Warehouse"],
    component: PurchaseOrderReport,
  },
  {
    id: "stock-movements",
    title: "Stock Movements",
    description: "Inventory receipts, adjustments, and movement history",
    roles: ["Admin", "Warehouse"],
    component: StockMovementReport,
  },
  {
    id: "assembly-orders",
    title: "Assembly Orders",
    description: "Production assembly orders and completion metrics",
    roles: ["Admin", "Production"],
    component: AssemblyOrderReport,
  },
  {
    id: "sales-orders",
    title: "Sales Orders",
    description: "Store orders summary and sales metrics",
    roles: ["Admin", "Store"],
    component: SalesOrderReport,
  },
];

export default function Reports() {
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

  const userRole = profile?.role || "";
  const accessibleReports = reportConfigs.filter((report) =>
    report.roles.includes(userRole)
  );

  const defaultTab = accessibleReports[0]?.id || "purchase-orders";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">
                  Generate and export reports for your operations
                </p>
              </div>
            </div>
            <ReportFilters dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>

          {accessibleReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  No reports available for your role
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue={defaultTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:grid-cols-none lg:flex">
                {accessibleReports.map((report) => (
                  <TabsTrigger key={report.id} value={report.id}>
                    {report.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {accessibleReports.map((report) => (
                <TabsContent key={report.id} value={report.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{report.title}</CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <report.component dateRange={dateRange} />
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
