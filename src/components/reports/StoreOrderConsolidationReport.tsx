import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, Package, Truck, Search } from "lucide-react";
import { cn } from "@/lib/utils";


interface Props {
  dateRange: { from: Date; to: Date };
}

interface AggItem {
  item_code: string;
  item_name: string;
  uom: string;
  released_qty: number;
  on_hand: number | null;
  orders: Map<string, number>;
}

interface DeliveryGroup {
  delivery_date: string | null;
  store_ids: Set<string>;
  store_names: Set<string>;
  order_ids: Set<string>;
  order_numbers: Set<string>;
  items: Map<string, AggItem>;
}

function useStoreOrderConsolidation(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["store-order-consolidation-by-delivery", fromDate, toDate],
    queryFn: async () => {
      // Orders being prepared, by delivery_date in range OR with no delivery_date
      const { data: dated, error: e1 } = await supabase
        .from("sales_orders")
        .select("id, order_number, store_id, delivery_date, status, stores(store_name)")
        .gte("delivery_date", fromDate)
        .lte("delivery_date", toDate)
        .in("status", ["submitted", "processing"]);
      if (e1) throw e1;

      const { data: undated, error: e2 } = await supabase
        .from("sales_orders")
        .select("id, order_number, store_id, delivery_date, status, stores(store_name)")
        .is("delivery_date", null)
        .in("status", ["submitted", "processing"]);
      if (e2) throw e2;

      const orders = [...(dated || []), ...(undated || [])];
      if (orders.length === 0) return { orders: [], lines: [], stockMap: new Map<string, number>() };

      const orderIds = orders.map((o) => o.id);
      const { data: lines, error: e3 } = await supabase
        .from("sales_order_lines")
        .select("sales_order_id, item_code, item_name, quantity, uom")
        .in("sales_order_id", orderIds);
      if (e3) throw e3;

      // Build on-hand map from components + raw_materials
      const [comps, raws] = await Promise.all([
        supabase.from("components").select("sku, autocount_item_code, stock_quantity"),
        supabase.from("raw_materials").select("sku, autocount_item_code, stock_quantity"),
      ]);

      const stockMap = new Map<string, number>();
      const add = (code: string | null | undefined, qty: number | null) => {
        if (!code || qty == null) return;
        if (!stockMap.has(code)) stockMap.set(code, Number(qty) || 0);
      };
      for (const c of comps.data || []) {
        add(c.autocount_item_code, c.stock_quantity);
        add(c.sku, c.stock_quantity);
      }
      for (const r of raws.data || []) {
        add(r.autocount_item_code, r.stock_quantity);
        add(r.sku, r.stock_quantity);
      }

      return { orders, lines: lines || [], stockMap };
    },
    enabled: !!fromDate && !!toDate,
  });
}

export function StoreOrderConsolidationReport({ dateRange }: Props) {
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const { data, isLoading } = useStoreOrderConsolidation(fromStr, toStr);
  const printRef = useRef<HTMLDivElement>(null);
  const [storeFilter, setStoreFilter] = useState<string>("__all__");
  const [itemNameFilter, setItemNameFilter] = useState<string>("");
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>("");

  const storeOptions = useMemo(() => {
    if (!data) return [] as { id: string; name: string }[];
    const m = new Map<string, string>();
    for (const o of data.orders as any[]) {
      if (o.store_id) m.set(o.store_id, o.stores?.store_name || o.store_id);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const groups = useMemo<DeliveryGroup[]>(() => {
    if (!data) return [];
    const ordersById = new Map(data.orders.map((o: any) => [o.id, o]));
    const byDate = new Map<string, DeliveryGroup>();
    const nameNeedle = itemNameFilter.trim().toLowerCase();
    const orderNeedle = orderNumberFilter.trim().toLowerCase();

    for (const line of data.lines as any[]) {
      const order: any = ordersById.get(line.sales_order_id);
      if (!order) continue;
      if (storeFilter !== "__all__" && order.store_id !== storeFilter) continue;
      if (orderNeedle && !String(order.order_number || "").toLowerCase().includes(orderNeedle)) continue;
      if (nameNeedle && !String(line.item_name || "").toLowerCase().includes(nameNeedle)) continue;

      const key = order.delivery_date || "__unscheduled__";
      let g = byDate.get(key);
      if (!g) {
        g = {
          delivery_date: order.delivery_date,
          store_ids: new Set(),
          store_names: new Set(),
          order_ids: new Set(),
          order_numbers: new Set(),
          items: new Map(),
        };
        byDate.set(key, g);
      }
      if (order.store_id) g.store_ids.add(order.store_id);
      if (order.stores?.store_name) g.store_names.add(order.stores.store_name);
      g.order_ids.add(order.id);
      if (order.order_number) g.order_numbers.add(order.order_number);

      const ik = line.item_code;
      const existing = g.items.get(ik);
      const qty = Number(line.quantity) || 0;
      const ordNum = order.order_number || "—";
      if (existing) {
        existing.released_qty += qty;
        existing.orders.set(ordNum, (existing.orders.get(ordNum) || 0) + qty);
      } else {
        const orders = new Map<string, number>();
        orders.set(ordNum, qty);
        g.items.set(ik, {
          item_code: ik,
          item_name: line.item_name,
          uom: line.uom || "UNIT",
          released_qty: qty,
          on_hand: data.stockMap.has(ik) ? data.stockMap.get(ik)! : null,
          orders,
        });
      }
    }

    return Array.from(byDate.values()).sort((a, b) => {
      if (!a.delivery_date) return 1;
      if (!b.delivery_date) return -1;
      return a.delivery_date.localeCompare(b.delivery_date);
    });
  }, [data, storeFilter, itemNameFilter, orderNumberFilter]);


  const fmtDate = (d: string | null) =>
    d ? format(new Date(d + "T00:00:00"), "EEE, MMM dd, yyyy") : "Unscheduled";

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Store Order Consolidation</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;}
        h1{font-size:18px;margin:0 0 4px;}
        h2{font-size:14px;margin:20px 0 4px;border-bottom:1px solid #ccc;padding-bottom:4px;}
        .meta{color:#555;font-size:12px;margin-bottom:8px;}
        table{width:100%;border-collapse:collapse;margin-bottom:12px;}
        th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left;}
        th{background:#f3f3f3;}
        td.num,th.num{text-align:right;}
        .neg{color:#b00020;font-weight:600;}
      </style></head><body>
      <h1>Store Order Consolidation</h1>
      <div class="meta">Delivery Date range: ${format(dateRange.from, "MMM dd, yyyy")} – ${format(dateRange.to, "MMM dd, yyyy")}</div>
      ${content.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const handleCSV = () => {
    const rows: (string | number)[][] = [
      ["Delivery Date", "# Stores", "# Orders", "Item Code", "Item Name", "Orders", "UOM", "Released Qty", "On-hand", "Balance"],
    ];
    for (const g of groups) {
      for (const item of Array.from(g.items.values()).sort((a, b) => a.item_code.localeCompare(b.item_code))) {
        const variance = item.on_hand == null ? "" : item.on_hand - item.released_qty;
        const ordersStr = Array.from(item.orders.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([num, qty]) => `${num} (${qty})`)
          .join("; ");
        rows.push([
          g.delivery_date || "Unscheduled",
          g.store_ids.size,
          g.order_ids.size,
          item.item_code,
          item.item_name,
          ordersStr,
          item.uom,
          item.released_qty,
          item.on_hand == null ? "N/A" : item.on_hand,
          variance,
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-order-consolidation-${fromStr}-to-${toStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:flex md:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Store</Label>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All stores</SelectItem>
                {storeOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Item name</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={itemNameFilter}
                onChange={(e) => setItemNameFilter(e.target.value)}
                placeholder="Filter by item name…"
                className="pl-8 w-[240px]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order #</Label>
            <Input
              value={orderNumberFilter}
              onChange={(e) => setOrderNumberFilter(e.target.value)}
              placeholder="Filter by order number…"
              className="w-[220px]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={groups.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSV} disabled={groups.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Date range is set above (delivery date). Showing orders in <strong>submitted</strong> / <strong>processing</strong>.
        On-hand is from local inventory and may differ from AutoCount in real time.
      </p>


      {groups.length === 0 ? (
        <div className="py-12 text-center border rounded-md">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No store orders being prepared for the selected range.</p>
        </div>
      ) : (
        <div ref={printRef} className="space-y-6">
          {groups.map((g) => {
            const items = Array.from(g.items.values()).sort((a, b) => a.item_code.localeCompare(b.item_code));
            return (
              <div key={g.delivery_date || "unscheduled"} className="border rounded-md">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-2 font-semibold">
                    <Truck className="h-4 w-4 text-primary" />
                    {fmtDate(g.delivery_date)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{g.store_ids.size} store(s)</Badge>
                    <Badge variant="secondary">{g.order_ids.size} order(s)</Badge>
                    <Badge variant="secondary">{items.length} item(s)</Badge>
                  </div>
                </div>
                {g.store_names.size > 0 && (
                  <div className="px-3 pt-2 text-xs text-muted-foreground">
                    Stores: {Array.from(g.store_names).sort().join(", ")}
                  </div>
                )}
                {g.order_numbers.size > 0 && (
                  <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                    <span>Orders:</span>
                    {Array.from(g.order_numbers).sort().map((num) => (
                      <Badge key={num} variant="outline" className="font-mono text-[10px]">
                        {num}
                      </Badge>
                    ))}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right num">Released Qty</TableHead>
                      <TableHead className="text-right num">On-hand</TableHead>
                      <TableHead className="text-right num">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const variance = item.on_hand == null ? null : item.on_hand - item.released_qty;
                      const negative = variance !== null && variance < 0;
                      const orderEntries = Array.from(item.orders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                      const allOrdersStr = orderEntries.map(([n, q]) => `${n} (${q})`).join(", ");
                      const shown = orderEntries.slice(0, 3).map(([n]) => n).join(", ");
                      const moreCount = orderEntries.length - 3;
                      return (
                        <TableRow key={item.item_code}>
                          <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground" title={allOrdersStr}>
                            {shown}{moreCount > 0 ? ` +${moreCount} more` : ""}
                          </TableCell>
                          <TableCell>{item.uom}</TableCell>
                          <TableCell className="text-right font-semibold num">
                            {item.released_qty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right num">
                            {item.on_hand == null ? <span className="text-muted-foreground">N/A</span> : item.on_hand.toLocaleString()}
                          </TableCell>
                          <TableCell className={cn("text-right num", negative && "neg text-destructive font-semibold")}>
                            {variance === null ? "—" : variance.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
