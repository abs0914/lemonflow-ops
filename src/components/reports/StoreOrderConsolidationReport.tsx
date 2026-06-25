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
import { Printer, Download, Package, Truck, Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";


interface Props {
  dateRange: { from: Date; to: Date };
}

interface OrderContribution {
  order_number: string;
  store_name: string;
  qty: number;
}

interface AggItem {
  item_code: string;
  item_name: string;
  uom: string;
  released_qty: number;
  on_hand: number | null;
  unit_cost: number | null;
  orders: Map<string, OrderContribution>;
}

interface DeliveryGroup {
  delivery_date: string | null;
  store_ids: Set<string>;
  store_names: Set<string>;
  order_ids: Set<string>;
  order_numbers: Set<string>;
  items: Map<string, AggItem>;
}

type DateField = "delivery_date" | "submitted_at" | "created_at";

function useStoreOrderConsolidation(fromDate: string, toDate: string, dateField: DateField) {
  return useQuery({
    queryKey: ["store-order-consolidation", dateField, fromDate, toDate],
    queryFn: async () => {
      const selectCols =
        "id, order_number, store_id, delivery_date, submitted_at, created_at, status, stores(store_name)";

      const isTimestamp = dateField !== "delivery_date";
      const fromBound = isTimestamp ? `${fromDate}T00:00:00` : fromDate;
      const toBound = isTimestamp ? `${toDate}T23:59:59.999` : toDate;

      const { data: dated, error: e1 } = await supabase
        .from("sales_orders")
        .select(selectCols)
        .gte(dateField, fromBound)
        .lte(dateField, toBound)
        .in("status", ["submitted", "processing"]);
      if (e1) throw e1;

      let undated: any[] = [];
      if (dateField === "delivery_date") {
        const { data, error: e2 } = await supabase
          .from("sales_orders")
          .select(selectCols)
          .is("delivery_date", null)
          .in("status", ["submitted", "processing"]);
        if (e2) throw e2;
        undated = data || [];
      }

      const orders = [...(dated || []), ...undated];
      if (orders.length === 0) {
        return {
          orders: [],
          lines: [],
          stockMap: new Map<string, number>(),
          costMap: new Map<string, number>(),
        };
      }

      const orderIds = orders.map((o) => o.id);
      const { data: lines, error: e3 } = await supabase
        .from("sales_order_lines")
        .select("sales_order_id, item_code, item_name, quantity, uom")
        .in("sales_order_id", orderIds);
      if (e3) throw e3;

      const [comps, raws] = await Promise.all([
        supabase.from("components").select("sku, autocount_item_code, stock_quantity, cost_per_unit"),
        supabase.from("raw_materials").select("sku, autocount_item_code, stock_quantity, cost_per_unit"),
      ]);

      const stockMap = new Map<string, number>();
      const costMap = new Map<string, number>();
      const addStock = (code: string | null | undefined, qty: number | null) => {
        if (!code || qty == null) return;
        if (!stockMap.has(code)) stockMap.set(code, Number(qty) || 0);
      };
      const addCost = (code: string | null | undefined, cost: number | null) => {
        if (!code || cost == null) return;
        if (!costMap.has(code)) costMap.set(code, Number(cost) || 0);
      };
      for (const c of comps.data || []) {
        addStock(c.autocount_item_code, c.stock_quantity);
        addStock(c.sku, c.stock_quantity);
        addCost(c.autocount_item_code, c.cost_per_unit);
        addCost(c.sku, c.cost_per_unit);
      }
      for (const r of raws.data || []) {
        addStock(r.autocount_item_code, r.stock_quantity);
        addStock(r.sku, r.stock_quantity);
        addCost(r.autocount_item_code, r.cost_per_unit);
        addCost(r.sku, r.cost_per_unit);
      }

      return { orders, lines: lines || [], stockMap, costMap };
    },
    enabled: !!fromDate && !!toDate,
  });
}

export function StoreOrderConsolidationReport({ dateRange }: Props) {
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const [dateField, setDateField] = useState<DateField>("delivery_date");
  const { data, isLoading } = useStoreOrderConsolidation(fromStr, toStr, dateField);
  const printRef = useRef<HTMLDivElement>(null);
  const [storeFilter, setStoreFilter] = useState<string>("__all__");
  const [itemNameFilter, setItemNameFilter] = useState<string>("");
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

      const rawVal: string | null = order[dateField] ?? null;
      const groupDate = rawVal ? String(rawVal).slice(0, 10) : null;
      const key = groupDate || "__unscheduled__";
      let g = byDate.get(key);
      if (!g) {
        g = {
          delivery_date: groupDate,
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
      const storeName = order.stores?.store_name || "—";
      if (existing) {
        existing.released_qty += qty;
        const prior = existing.orders.get(ordNum);
        existing.orders.set(ordNum, {
          order_number: ordNum,
          store_name: storeName,
          qty: (prior?.qty || 0) + qty,
        });
      } else {
        const orders = new Map<string, OrderContribution>();
        orders.set(ordNum, { order_number: ordNum, store_name: storeName, qty });
        g.items.set(ik, {
          item_code: ik,
          item_name: line.item_name,
          uom: line.uom || "UNIT",
          released_qty: qty,
          on_hand: data.stockMap.has(ik) ? data.stockMap.get(ik)! : null,
          unit_cost: data.costMap.has(ik) ? data.costMap.get(ik)! : null,
          orders,
        });
      }
    }

    return Array.from(byDate.values()).sort((a, b) => {
      if (!a.delivery_date) return 1;
      if (!b.delivery_date) return -1;
      return a.delivery_date.localeCompare(b.delivery_date);
    });
  }, [data, storeFilter, itemNameFilter, orderNumberFilter, dateField]);


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
        [data-print-only]{display:table-row !important;}
        [data-screen-only]{display:none !important;}
        .toggle-cell{display:none !important;}
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
      [
        "Delivery Date",
        "Row Type",
        "Item Code",
        "Item Name",
        "UOM",
        "Order #",
        "Store",
        "Unit Cost",
        "Qty",
        "Subtotal",
        "On-hand",
        "Balance",
        "# Stores (Item)",
        "# Orders (Item)",
      ],
    ];
    for (const g of groups) {
      const items = Array.from(g.items.values()).sort((a, b) => a.item_code.localeCompare(b.item_code));
      for (const item of items) {
        const orderEntries = Array.from(item.orders.values()).sort((a, b) =>
          a.order_number.localeCompare(b.order_number),
        );
        const itemSubtotal = item.unit_cost == null ? "" : item.unit_cost * item.released_qty;
        const variance = item.on_hand == null ? "" : item.on_hand - item.released_qty;
        const itemStoreCount = new Set(orderEntries.map((o) => o.store_name)).size;

        // Aggregated item-level row
        rows.push([
          g.delivery_date || "Unscheduled",
          "ITEM TOTAL",
          item.item_code,
          item.item_name,
          item.uom,
          "",
          "",
          item.unit_cost == null ? "N/A" : item.unit_cost,
          item.released_qty,
          itemSubtotal,
          item.on_hand == null ? "N/A" : item.on_hand,
          variance,
          itemStoreCount,
          orderEntries.length,
        ]);

        // Per-order breakdown rows
        for (const o of orderEntries) {
          const lineSubtotal = item.unit_cost == null ? "" : item.unit_cost * o.qty;
          rows.push([
            g.delivery_date || "Unscheduled",
            "Order Line",
            item.item_code,
            item.item_name,
            item.uom,
            o.order_number,
            o.store_name,
            item.unit_cost == null ? "N/A" : item.unit_cost,
            o.qty,
            lineSubtotal,
            "",
            "",
            "",
            "",
          ]);
        }
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

  const TOTAL_COLS = 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:flex md:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Date basis</Label>
            <Select value={dateField} onValueChange={(v) => setDateField(v as DateField)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery_date">Delivery date</SelectItem>
                <SelectItem value="submitted_at">Submitted at</SelectItem>
                <SelectItem value="created_at">Created at</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        On-hand is from local inventory and may differ from AutoCount in real time. Unit cost is the value set on the inventory master.
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
            const groupKey = g.delivery_date || "unscheduled";
            return (
              <div key={groupKey} className="border rounded-md">
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
                      <TableHead className="w-8 toggle-cell"></TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right num">Unit Cost</TableHead>
                      <TableHead className="text-right num">Released Qty</TableHead>
                      <TableHead className="text-right num">On-hand</TableHead>
                      <TableHead className="text-right num">Balance</TableHead>
                      <TableHead className="text-right num">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const variance = item.on_hand == null ? null : item.on_hand - item.released_qty;
                      const negative = variance !== null && variance < 0;
                      const orderEntries = Array.from(item.orders.values()).sort((a, b) =>
                        a.order_number.localeCompare(b.order_number),
                      );
                      const allOrdersStr = orderEntries.map((o) => `${o.order_number} (${o.qty})`).join(", ");
                      const shown = orderEntries.slice(0, 3).map((o) => o.order_number).join(", ");
                      const moreCount = orderEntries.length - 3;
                      const subtotal = item.unit_cost == null ? null : item.unit_cost * item.released_qty;
                      const expandKey = `${groupKey}|${item.item_code}`;
                      const isExpanded = expandedKeys.has(expandKey);

                      const expandedDetails = (
                        <td colSpan={TOTAL_COLS} className="p-0 bg-muted/30">
                          <div className="p-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Order #</TableHead>
                                  <TableHead className="text-xs">Store</TableHead>
                                  <TableHead className="text-right text-xs num">Qty</TableHead>
                                  <TableHead className="text-right text-xs num">Unit Cost</TableHead>
                                  <TableHead className="text-right text-xs num">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {orderEntries.map((o) => {
                                  const lineSub = item.unit_cost == null ? null : item.unit_cost * o.qty;
                                  return (
                                    <TableRow key={o.order_number}>
                                      <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                                      <TableCell className="text-xs">{o.store_name}</TableCell>
                                      <TableCell className="text-right text-xs num">{o.qty.toLocaleString()}</TableCell>
                                      <TableCell className="text-right text-xs num">
                                        {item.unit_cost == null ? "—" : formatCurrency(item.unit_cost)}
                                      </TableCell>
                                      <TableCell className="text-right text-xs num">
                                        {lineSub == null ? "—" : formatCurrency(lineSub)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="font-semibold bg-muted/40">
                                  <TableCell colSpan={2} className="text-xs">Total</TableCell>
                                  <TableCell className="text-right text-xs num">{item.released_qty.toLocaleString()}</TableCell>
                                  <TableCell />
                                  <TableCell className="text-right text-xs num">
                                    {subtotal == null ? "—" : formatCurrency(subtotal)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </td>
                      );

                      return (
                        <>
                          <TableRow
                            key={item.item_code}
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={() => toggleExpand(expandKey)}
                          >
                            <TableCell className="toggle-cell">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                            <TableCell>{item.item_name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground" title={allOrdersStr}>
                              {shown}{moreCount > 0 ? ` +${moreCount} more` : ""}
                            </TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell className="text-right num">
                              {item.unit_cost == null ? <span className="text-muted-foreground">—</span> : formatCurrency(item.unit_cost)}
                            </TableCell>
                            <TableCell className="text-right font-semibold num">
                              {item.released_qty.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right num">
                              {item.on_hand == null ? <span className="text-muted-foreground">N/A</span> : item.on_hand.toLocaleString()}
                            </TableCell>
                            <TableCell className={cn("text-right num", negative && "neg text-destructive font-semibold")}>
                              {variance === null ? "—" : variance.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right num font-medium">
                              {subtotal == null ? "—" : formatCurrency(subtotal)}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <tr data-screen-only key={`${item.item_code}-exp`}>
                              {expandedDetails}
                            </tr>
                          )}
                          <tr data-print-only style={{ display: "none" }} key={`${item.item_code}-print`}>
                            {expandedDetails}
                          </tr>
                        </>
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
