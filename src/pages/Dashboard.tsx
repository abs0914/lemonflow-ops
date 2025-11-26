import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Package, Factory, CheckCircle, AlertCircle, Plus, Barcode, FileText, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dateFormatters } from "@/lib/datetime";

export default function Dashboard() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      // Open assembly orders count
      const { count: openOrdersCount } = await supabase
        .from("assembly_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Total pending quantity
      const { data: pendingOrders } = await supabase
        .from("assembly_orders")
        .select("quantity")
        .eq("status", "pending");

      const totalQuantity = pendingOrders?.reduce((sum, order) => sum + order.quantity, 0) || 0;

      // Low stock components (available < 10)
      const { data: components } = await supabase
        .from("components")
        .select("stock_quantity, reserved_quantity");

      const lowStockCount = components?.filter(
        (c) => c.stock_quantity - c.reserved_quantity < 10
      ).length || 0;

      // Pending purchase orders
      const { count: pendingPOCount } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["draft", "submitted"]);

      return {
        openOrders: openOrdersCount || 0,
        totalQuantity,
        lowStockAlerts: lowStockCount,
        pendingPOs: pendingPOCount || 0,
      };
    },
    enabled: !!profile,
  });

  // Fetch recent assembly orders
  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["recent-assembly-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assembly_orders")
        .select(`
          id,
          quantity,
          status,
          created_at,
          products(name, sku)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  const metricCards = [
    {
      title: "Open Assembly Orders",
      value: metricsLoading ? "..." : metrics?.openOrders.toString() || "0",
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Total Pending Quantity",
      value: metricsLoading ? "..." : metrics?.totalQuantity.toLocaleString() || "0",
      icon: Package,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Low Stock Alerts",
      value: metricsLoading ? "..." : metrics?.lowStockAlerts.toString() || "0",
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Pending Purchase Orders",
      value: metricsLoading ? "..." : metrics?.pendingPOs.toString() || "0",
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  const quickActions = [
    {
      title: "Create Assembly Order",
      description: "Start a new production order",
      icon: Plus,
      path: "/production/create",
      roles: ["Admin", "Production"],
    },
    {
      title: "Create Purchase Order",
      description: "Order components from suppliers",
      icon: ShoppingCart,
      path: "/purchasing/create",
      roles: ["Admin", "Warehouse"],
    },
    {
      title: "Generate Labels",
      description: "Generate product labels",
      icon: Barcode,
      path: "/labels",
      roles: ["Admin", "Production", "Warehouse"],
    },
    {
      title: "Manage BOM",
      description: "Manage bills of materials",
      icon: FileText,
      path: "/bom",
      roles: ["Admin"],
    },
  ];

  const filteredActions = quickActions.filter((action) =>
    action.roles.includes(profile.role)
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-info/10 text-info border-info/20";
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">
            Welcome back, {profile.full_name}
          </h1>
          <p className="text-muted-foreground mt-2">
            Here's what's happening in your production today
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric) => (
            <Card key={metric.title} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metric.color}`}>
                  {metric.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest assembly orders</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Loading recent orders...</p>
              </div>
            ) : !recentOrders || recentOrders.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>No recent assembly orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/production")}
                  >
                    <div className="space-y-1">
                      <p className="font-semibold">{order.products?.name || "Unknown Product"}</p>
                      <p className="text-sm text-muted-foreground">SKU: {order.products?.sku || "N/A"}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">Qty: {order.quantity}</p>
                        <p className="text-sm text-muted-foreground">
                          {dateFormatters.medium(order.created_at)}
                        </p>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer hover:shadow-lg transition-shadow border-border hover:border-primary"
                onClick={() => navigate(action.path)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary">
                      <action.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
