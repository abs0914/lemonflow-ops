import { useState, useMemo, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStoresData, usePOSSalesData, useSalesOrdersData } from "@/hooks/useSalesData";
import { SalesDashboardLayout } from "@/components/sales-dashboard/SalesDashboardLayout";
import { SummaryCard } from "@/components/sales-dashboard/SummaryCard";
import { SalesTrendChart } from "@/components/sales-dashboard/SalesTrendChart";
import { PaymentBreakdownChart } from "@/components/sales-dashboard/PaymentBreakdownChart";
import { SalesByStoreTable } from "@/components/sales-dashboard/SalesByStoreTable";
import { TopProductsTable } from "@/components/sales-dashboard/TopProductsTable";
import { DashboardFilters } from "@/components/sales-dashboard/DashboardFilters";
import { DollarSign, CreditCard, ShoppingCart, Receipt } from "lucide-react";
import { format, subDays, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import type { DateRange, SalesChannel, SalesOrder } from "@/lib/salesApi/types";

const ALLOWED_ROLES = ["Admin", "CEO"];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function SalesDashboard() {
  const { session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [channel, setChannel] = useState<SalesChannel>("all");
  const [selectedStore, setSelectedStore] = useState("all");

  // Check role access
  const hasAccess = profile && ALLOWED_ROLES.includes(profile.role);

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading && session && profile && !hasAccess) {
      toast.error("You don't have access to the Sales Dashboard");
      navigate("/dashboard");
    }
  }, [authLoading, session, profile, hasAccess, navigate]);

  const { data: storesData, isLoading: storesLoading } = useStoresData();
  const { data: posData, isLoading: posLoading } = usePOSSalesData(dateRange);
  const { data: ordersData, isLoading: ordersLoading } = useSalesOrdersData();

  const isLoading = storesLoading || posLoading || ordersLoading;
  const stores = storesData?.data || [];

  // Filter POS data by store
  const filteredPOSData = useMemo(() => {
    if (!posData?.data) return [];
    let data = posData.data;
    
    if (selectedStore === "own") {
      data = data.filter((s) => s.storeCode.startsWith("STR-"));
    } else if (selectedStore === "franchise") {
      data = data.filter((s) => s.storeCode.startsWith("FRC-"));
    } else if (selectedStore !== "all") {
      data = data.filter((s) => s.storeCode === selectedStore);
    }
    
    return data;
  }, [posData, selectedStore]);

  // Filter orders by date range and store
  const filteredOrders = useMemo(() => {
    if (!ordersData) return [];
    
    return ordersData.filter((order: SalesOrder) => {
      const orderDate = parseISO(order.docDate);
      const inRange = isWithinInterval(orderDate, { start: dateRange.from, end: dateRange.to });
      
      if (!inRange || order.isCancelled) return false;
      
      if (selectedStore === "own") {
        return order.debtorCode.startsWith("STR-");
      } else if (selectedStore === "franchise") {
        return order.debtorCode.startsWith("FRC-");
      } else if (selectedStore !== "all") {
        return order.debtorCode === selectedStore;
      }
      
      return true;
    });
  }, [ordersData, dateRange, selectedStore]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const posSalesTotal = filteredPOSData.reduce((sum, s) => sum + s.grandTotal, 0);
    const orderSalesTotal = filteredOrders.reduce((sum: number, o: SalesOrder) => sum + o.totalAmount, 0);
    const posTransactions = filteredPOSData.length;
    const orderTransactions = filteredOrders.length;
    
    let totalSales = 0;
    let transactions = 0;
    
    if (channel === "all") {
      totalSales = posSalesTotal + orderSalesTotal;
      transactions = posTransactions + orderTransactions;
    } else if (channel === "pos") {
      totalSales = posSalesTotal;
      transactions = posTransactions;
    } else {
      totalSales = orderSalesTotal;
      transactions = orderTransactions;
    }
    
    return {
      totalSales,
      posSalesTotal,
      orderSalesTotal,
      transactions,
      avgTransaction: transactions > 0 ? totalSales / transactions : 0,
    };
  }, [filteredPOSData, filteredOrders, channel]);

  // Calculate sales trend data
  const trendData = useMemo(() => {
    const dailySales: Record<string, { posSales: number; orderSales: number }> = {};
    
    filteredPOSData.forEach((sale) => {
      const date = sale.salesDate;
      if (!dailySales[date]) {
        dailySales[date] = { posSales: 0, orderSales: 0 };
      }
      dailySales[date].posSales += sale.grandTotal;
    });
    
    filteredOrders.forEach((order: SalesOrder) => {
      const date = order.docDate.split("T")[0];
      if (!dailySales[date]) {
        dailySales[date] = { posSales: 0, orderSales: 0 };
      }
      dailySales[date].orderSales += order.totalAmount;
    });
    
    return Object.entries(dailySales)
      .map(([date, sales]) => ({
        date: format(parseISO(date), "MMM d"),
        ...sales,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPOSData, filteredOrders]);

  // Calculate payment breakdown
  const paymentData = useMemo(() => {
    const payments: Record<string, number> = {};
    
    filteredPOSData.forEach((sale) => {
      sale.payments?.forEach((payment) => {
        const method = payment.paymentMethod;
        payments[method] = (payments[method] || 0) + payment.amount;
      });
    });
    
    return Object.entries(payments).map(([name, value]) => ({
      name: name.replace("_", " "),
      value,
    }));
  }, [filteredPOSData]);

  // Calculate sales by store
  const storeData = useMemo(() => {
    const storeSales: Record<string, { posSales: number; orderSales: number }> = {};
    
    filteredPOSData.forEach((sale) => {
      const code = sale.storeCode;
      if (!storeSales[code]) {
        storeSales[code] = { posSales: 0, orderSales: 0 };
      }
      storeSales[code].posSales += sale.grandTotal;
    });
    
    filteredOrders.forEach((order: SalesOrder) => {
      const code = order.debtorCode;
      if (!storeSales[code]) {
        storeSales[code] = { posSales: 0, orderSales: 0 };
      }
      storeSales[code].orderSales += order.totalAmount;
    });
    
    const totalSales = Object.values(storeSales).reduce(
      (sum, s) => sum + s.posSales + s.orderSales,
      0
    );
    
    return Object.entries(storeSales).map(([code, sales]) => {
      const store = stores.find((s) => s.code === code);
      const total = sales.posSales + sales.orderSales;
      return {
        code,
        name: store?.name || code,
        type: (store?.type || (code.startsWith("STR-") ? "own" : "franchise")) as "own" | "franchise",
        posSales: sales.posSales,
        orderSales: sales.orderSales,
        total,
        percentage: totalSales > 0 ? (total / totalSales) * 100 : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredPOSData, filteredOrders, stores]);

  // Calculate top products
  const topProducts = useMemo(() => {
    const products: Record<string, { description: string; category: string; quantity: number; revenue: number }> = {};
    
    filteredPOSData.forEach((sale) => {
      sale.lines?.forEach((line) => {
        const key = line.itemCode;
        if (!products[key]) {
          products[key] = {
            description: line.description,
            category: line.category || "Uncategorized",
            quantity: 0,
            revenue: 0,
          };
        }
        products[key].quantity += line.quantity;
        products[key].revenue += line.lineAmount;
      });
    });
    
    filteredOrders.forEach((order: SalesOrder) => {
      order.lines?.forEach((line) => {
        const key = line.itemCode;
        if (!products[key]) {
          products[key] = {
            description: line.description,
            category: "Uncategorized",
            quantity: 0,
            revenue: 0,
          };
        }
        products[key].quantity += line.quantity;
        products[key].revenue += line.subTotal;
      });
    });
    
    return Object.entries(products)
      .map(([itemCode, data], index) => ({
        rank: index + 1,
        itemCode,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, [filteredPOSData, filteredOrders]);

  // Export to CSV
  const handleExport = () => {
    const rows = [
      ["Store Code", "Store Name", "Type", "POS Sales", "Order Sales", "Total", "% of Total"],
      ...storeData.map((s) => [
        s.code,
        s.name,
        s.type,
        s.posSales.toString(),
        s.orderSales.toString(),
        s.total.toString(),
        s.percentage.toFixed(1) + "%",
      ]),
    ];
    
    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // No access
  if (!hasAccess) {
    return null; // Will redirect via useEffect
  }

  return (
    <SalesDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of sales performance across all channels
            </p>
          </div>
          <DashboardFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            channel={channel}
            onChannelChange={setChannel}
            selectedStore={selectedStore}
            onStoreChange={setSelectedStore}
            stores={stores}
            onExport={handleExport}
            loading={isLoading}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Sales"
            value={formatCurrency(metrics.totalSales)}
            icon={DollarSign}
            loading={isLoading}
          />
          <SummaryCard
            title="POS Sales"
            value={formatCurrency(metrics.posSalesTotal)}
            icon={CreditCard}
            loading={isLoading}
          />
          <SummaryCard
            title="Order Sales"
            value={formatCurrency(metrics.orderSalesTotal)}
            icon={ShoppingCart}
            loading={isLoading}
          />
          <SummaryCard
            title="Transactions"
            value={metrics.transactions.toLocaleString()}
            icon={Receipt}
            loading={isLoading}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SalesTrendChart data={trendData} loading={isLoading} />
          <PaymentBreakdownChart data={paymentData} loading={isLoading} />
        </div>

        {/* Tables */}
        <SalesByStoreTable data={storeData} loading={isLoading} />
        <TopProductsTable data={topProducts} loading={isLoading} />
      </div>
    </SalesDashboardLayout>
  );
}
