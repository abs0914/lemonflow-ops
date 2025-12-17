import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceOrders } from "@/hooks/useFinanceOrders";
import { format } from "date-fns";
import { Search, DollarSign, Clock, AlertCircle } from "lucide-react";
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
  const { data: orders, isLoading } = useFinanceOrders();

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
            Manage payment confirmations for franchisee orders
          </p>
        </div>

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
                ₱{totalPendingValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
            {isLoading ? (
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
                        ₱{(order.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
      </div>
    </DashboardLayout>
  );
}
