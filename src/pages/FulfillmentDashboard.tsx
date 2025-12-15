import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, Eye, Printer } from "lucide-react";
import { useFulfillmentOrders } from "@/hooks/useFulfillment";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ManifestGenerator } from "@/components/fulfillment/ManifestGenerator";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  pending_payment: "bg-orange-100 text-orange-800",
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function FulfillmentDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("submitted");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showManifest, setShowManifest] = useState(false);

  const { data: orders, isLoading } = useFulfillmentOrders();

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.stores?.store_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // For submitted tab, only show own store orders (franchisee orders go through Finance first)
    if (activeTab === "submitted") {
      return matchesSearch && order.status === "submitted" && order.stores?.store_type !== "franchisee";
    }
    
    const matchesTab = activeTab === "all" || order.status === activeTab;
    return matchesSearch && matchesTab;
  }) || [];

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const getStatusBadge = (status: string) => {
    const displayStatus = status === "pending_payment" ? "Awaiting Payment" : 
      status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {displayStatus}
      </Badge>
    );
  };

  // Only count own store orders for pending (franchisee orders go to Finance first)
  const pendingCount = orders?.filter((o) => o.status === "submitted" && o.stores?.store_type !== "franchisee").length || 0;
  const pendingPaymentCount = orders?.filter((o) => o.status === "pending_payment").length || 0;
  const processingCount = orders?.filter((o) => o.status === "processing").length || 0;
  const completedCount = orders?.filter((o) => o.status === "completed").length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fulfillment Dashboard</h1>
            <p className="text-muted-foreground">
              Manage and fulfill store orders
            </p>
          </div>

          {selectedOrders.length > 0 && (
            <Button onClick={() => setShowManifest(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Generate Manifest ({selectedOrders.length})
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Awaiting Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingPaymentCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{processingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="submitted">Pending ({pendingCount})</TabsTrigger>
            <TabsTrigger value="processing">Processing ({processingCount})</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="all">All Orders</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No orders found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <div>
                            <div className="font-medium">{order.order_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.stores?.store_name}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden md:block">
                            <div className="text-sm text-muted-foreground">Order Date</div>
                            <div className="font-medium">
                              {format(new Date(order.doc_date), "MMM dd, yyyy")}
                            </div>
                          </div>
                          {order.delivery_date && (
                            <div className="text-right hidden md:block">
                              <div className="text-sm text-muted-foreground">Delivery</div>
                              <div className="font-medium">
                                {format(new Date(order.delivery_date), "MMM dd, yyyy")}
                              </div>
                            </div>
                          )}
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Total</div>
                            <div className="font-bold">
                              ₱{order.total_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          {getStatusBadge(order.status)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/fulfillment/orders/${order.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {showManifest && (
        <ManifestGenerator
          orderIds={selectedOrders}
          open={showManifest}
          onOpenChange={setShowManifest}
        />
      )}
    </DashboardLayout>
  );
}
