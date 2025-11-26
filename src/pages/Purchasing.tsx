import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobilePOCard } from "@/components/purchasing/MobilePOCard";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateFormatters } from "@/lib/datetime";
import { formatCurrency } from "@/lib/currency";
export default function Purchasing() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    data: allOrders,
    isLoading
  } = usePurchaseOrders();
  const filteredOrders = allOrders?.filter(order => {
    const matchesSearch = order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) || order.suppliers?.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || order.status === activeTab;
    return matchesSearch && matchesTab;
  });
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      submitted: "secondary",
      approved: "default",
      cancelled: "destructive"
    };
    return <Badge variant={variants[status] || "outline"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:items-center md:justify-between px-[20px] py-[23px] md:flex md:flex-row">
          <div>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground">Manage purchase orders and procurement</p>
          </div>
          {!isMobile && <Button onClick={() => navigate("/purchasing/create")}>
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input placeholder="Search purchase orders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="submitted">Submitted</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div> : isMobile ? <div className="space-y-4">
                {filteredOrders?.map(order => <MobilePOCard key={order.id} order={order} onClick={() => navigate(`/purchasing/${order.id}`)} />)}
                {filteredOrders?.length === 0 && <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No purchase orders found</p>
                  </div>}
              </div> : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AutoCount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.map(order => <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.po_number}</TableCell>
                      <TableCell className="font-medium">{order.suppliers?.company_name}</TableCell>
                      <TableCell>{dateFormatters.short(order.doc_date)}</TableCell>
                      <TableCell>{order.delivery_date ? dateFormatters.short(order.delivery_date) : "-"}</TableCell>
                      <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Badge variant={order.autocount_synced ? "default" : "outline"}>
                          {order.autocount_synced ? "Synced" : "Not Synced"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/purchasing/${order.id}`)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>)}
                  {filteredOrders?.length === 0 && <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No purchase orders found</p>
                      </TableCell>
                    </TableRow>}
                </TableBody>
              </Table>}
          </CardContent>
        </Card>

        {isMobile && <FloatingActionButton onClick={() => navigate("/purchasing/create")} icon={Plus} />}
      </div>
    </DashboardLayout>;
}