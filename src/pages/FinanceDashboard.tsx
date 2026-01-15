import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinanceOrders } from "@/hooks/useFinanceOrders";
import { useFinanceProcurementStats } from "@/hooks/useFinanceProcurementStats";
import { ProcurementSpendChart } from "@/components/finance/ProcurementSpendChart";
import { PendingReceiptPOsWidget } from "@/components/finance/PendingReceiptPOsWidget";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { Search, DollarSign, Clock, AlertCircle, ShoppingCart, Package, FileText, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("sales");
  const { data: orders, isLoading: ordersLoading } = useFinanceOrders();
  const { data: procurementStats, isLoading: procurementLoading } = useFinanceProcurementStats();

  const filteredOrders = orders?.filter(
    (order) =>
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.stores?.store_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPendingValue = orders?.reduce(
    (sum, order) => sum + (order.total_amount || 0),
    0
  ) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-muted-foreground">
            Manage payments, procurement, and financial tracking
          </p>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="sales" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Sales Orders
            </TabsTrigger>
            <TabsTrigger value="procurement" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Procurement
            </TabsTrigger>
          </TabsList>

          {/* Sales Orders Tab */}
          <TabsContent value="sales" className="space-y-6 mt-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Confirmation
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{orders?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Orders awaiting payment confirmation
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Pending Value
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(totalPendingValue)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total value of pending orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Action Required</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {orders?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Confirm or reject payments
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order number or store..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Payment Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredOrders?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No orders pending payment confirmation
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Store Type</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders?.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.order_number}
                          </TableCell>
                          <TableCell>{order.stores?.store_name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {order.stores?.store_type?.replace("_", " ") || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.doc_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(order.total_amount || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-orange-100 text-orange-800">
                              Pending Payment
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => navigate(`/finance/orders/${order.id}`)}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Procurement Tab */}
          <TabsContent value="procurement" className="space-y-6 mt-6">
            {/* Procurement Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Approved POs
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {procurementLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{procurementStats?.approvedPOs || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Total approved orders
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Receipt
                  </CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  {procurementLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-yellow-600">
                        {procurementStats?.pendingReceipt || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Awaiting goods receipt
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Goods Received
                  </CardTitle>
                  <Package className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  {procurementLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-green-600">
                        {procurementStats?.goodsReceived || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Completed receipts
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Value
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  {procurementLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(procurementStats?.pendingReceiptValue || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Value awaiting receipt
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts and Widgets Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              <ProcurementSpendChart 
                data={procurementStats?.monthlySpend || []} 
                isLoading={procurementLoading}
              />
              <PendingReceiptPOsWidget />
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => navigate("/purchasing")}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    View All Purchase Orders
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/incoming-inventory")}>
                    <Package className="h-4 w-4 mr-2" />
                    Incoming Inventory
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
