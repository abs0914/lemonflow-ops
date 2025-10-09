import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Package, Factory, CheckCircle, AlertCircle, Plus, Barcode, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [systemStatus, setSystemStatus] = useState<"connected" | "disconnected">("connected");

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  const metrics = [
    {
      title: "Open Orders",
      value: "12",
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Total Quantity",
      value: "2,450",
      icon: Package,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Production Lines",
      value: "3",
      icon: Factory,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "System Status",
      value: systemStatus === "connected" ? "Connected" : "Disconnected",
      icon: systemStatus === "connected" ? CheckCircle : AlertCircle,
      color: systemStatus === "connected" ? "text-success" : "text-destructive",
      bgColor: systemStatus === "connected" ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  const quickActions = [
    {
      title: "Create Assembly Order",
      description: "Start a new production order",
      icon: Plus,
      path: "/production/create",
      bgColor: "from-green-500 to-emerald-500",
      roles: ["Admin", "Warehouse"],
    },
    {
      title: "Generate Labels",
      description: "Generate product labels",
      icon: Barcode,
      path: "/labels",
      bgColor: "from-purple-500 to-pink-500",
      roles: ["Admin", "Warehouse"],
    },
    {
      title: "Manage BOM",
      description: "Manage bills of materials",
      icon: FileText,
      path: "/bom",
      bgColor: "from-blue-500 to-cyan-500",
      roles: ["Admin"],
    },
  ];

  const filteredActions = quickActions.filter((action) =>
    action.roles.includes(profile.role)
  );

  const recentOrders = [
    { docNo: "AO-2025-001", item: "Strawberry 500ml", quantity: 100, date: "2025-10-01", status: "Open" },
    { docNo: "AO-2025-002", item: "Lemon 500ml", quantity: 150, date: "2025-10-01", status: "Posted" },
    { docNo: "AO-2025-003", item: "Orange 500ml", quantity: 200, date: "2025-09-30", status: "Open" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-info/10 text-info border-info/20";
      case "Posted":
        return "bg-success/10 text-success border-success/20";
      case "Cancelled":
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
          {metrics.map((metric) => (
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
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.docNo}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{order.docNo}</p>
                    <p className="text-sm text-muted-foreground">{order.item}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">Qty: {order.quantity}</p>
                      <p className="text-sm text-muted-foreground">{order.date}</p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
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
