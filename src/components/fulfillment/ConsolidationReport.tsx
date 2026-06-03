import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Printer, Download, Package } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useFulfillmentConsolidation } from "@/hooks/useFulfillment";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface ConsolidatedItem {
  item_code: string;
  item_name: string;
  uom: string;
  total_qty: number;
  order_count: number;
}

export function ConsolidationReport() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(),
    to: new Date(),
  });
  const printRef = useRef<HTMLDivElement>(null);

  const fromStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : fromStr;
  const { data, isLoading } = useFulfillmentConsolidation(fromStr, toStr);

  const consolidated = useMemo(() => {
    if (!data?.lines) return [];
    const map = new Map<string, ConsolidatedItem>();
    const ordersByItem = new Map<string, Set<string>>();

    for (const line of data.lines) {
      const key = line.item_code;
      const existing = map.get(key);
      if (existing) {
        existing.total_qty += line.quantity;
      } else {
        map.set(key, {
          item_code: line.item_code,
          item_name: line.item_name,
          uom: line.uom || "UNIT",
          total_qty: line.quantity,
          order_count: 0,
        });
      }
      if (!ordersByItem.has(key)) ordersByItem.set(key, new Set());
      ordersByItem.get(key)!.add(line.sales_order_id);
    }

    for (const [key, item] of map) {
      item.order_count = ordersByItem.get(key)?.size || 0;
    }

    return Array.from(map.values()).sort((a, b) => a.item_code.localeCompare(b.item_code));
  }, [data?.lines]);

  const dateLabel = () => {
    if (!dateRange.from) return "Pick dates";
    const from = format(dateRange.from, "MMM dd");
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) {
      return format(dateRange.from, "MMM dd, yyyy");
    }
    const to = format(dateRange.to, "MMM dd, yyyy");
    return `${from} – ${to}`;
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Consolidation Report - ${dateLabel()}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        td:nth-child(4), td:nth-child(5), th:nth-child(4), th:nth-child(5) { text-align: right; }
      </style></head><body>
      <h1>Daily Consolidation Report</h1>
      <p>Delivery Date: ${dateLabel()} · ${consolidated.length} items · ${data?.orders?.length || 0} orders</p>
      ${content.querySelector("table")?.outerHTML || ""}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportCSV = () => {
    const headers = ["Item Code", "Item Name", "UOM", "Total Qty", "# Orders"];
    const rows = consolidated.map((item) => [item.item_code, item.item_name, item.uom, item.total_qty, item.order_count]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consolidation-${fromStr}-to-${toStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-lg">Daily Consolidation Report</CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[260px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateLabel()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => range && setDateRange(range)}
                  numberOfMonths={2}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={consolidated.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={consolidated.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
        {data?.orders && (
          <p className="text-sm text-muted-foreground">
            {data.orders.length} order(s) for selected period · {consolidated.length} unique item(s)
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : consolidated.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No orders found for {dateLabel()}</p>
          </div>
        ) : (
          <div ref={printRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right"># Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consolidated.map((item) => (
                  <TableRow key={item.item_code}>
                    <TableCell className="font-mono text-sm">{item.item_code}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell className="text-right font-bold">{item.total_qty.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.order_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
