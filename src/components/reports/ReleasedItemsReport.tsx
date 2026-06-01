import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, Package, Search } from "lucide-react";

interface Props {
  dateRange: { from: Date; to: Date };
}

interface StoreAgg {
  store_id: string;
  store_code: string;
  store_name: string;
  qty: number;
  orderNumbers: Set<string>;
}

interface ItemAgg {
  item_code: string;
  item_name: string;
  uom: string;
  total: number;
  stores: Map<string, StoreAgg>;
}

function useReleasedItems(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["released-items-report", fromDate, toDate],
    queryFn: async () => {
      const { data: orders, error: e1 } = await supabase
        .from("sales_orders")
        .select("id, order_number, store_id, delivery_date, status, stores(store_name, store_code)")
        .gte("delivery_date", fromDate)
        .lte("delivery_date", toDate)
        .in("status", ["submitted", "processing"]);
      if (e1) throw e1;

      if (!orders || orders.length === 0) return { orders: [], lines: [] };

      const { data: lines, error: e2 } = await supabase
        .from("sales_order_lines")
        .select("sales_order_id, item_code, item_name, quantity, uom")
        .in("sales_order_id", orders.map((o) => o.id));
      if (e2) throw e2;

      return { orders, lines: lines || [] };
    },
    enabled: !!fromDate && !!toDate,
  });
}

export function ReleasedItemsReport({ dateRange }: Props) {
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const { data, isLoading } = useReleasedItems(fromStr, toStr);
  const printRef = useRef<HTMLDivElement>(null);

  const [itemFilter, setItemFilter] = useState<string>("__all__");
  const [storeFilter, setStoreFilter] = useState<string>("__all__");
  const [search, setSearch] = useState<string>("");

  const itemOptions = useMemo(() => {
    if (!data) return [] as { code: string; name: string }[];
    const m = new Map<string, string>();
    for (const l of data.lines as any[]) {
      if (!m.has(l.item_code)) m.set(l.item_code, l.item_name);
    }
    return Array.from(m, ([code, name]) => ({ code, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const storeOptions = useMemo(() => {
    if (!data) return [] as { id: string; name: string }[];
    const m = new Map<string, string>();
    for (const o of data.orders as any[]) {
      if (o.store_id) m.set(o.store_id, o.stores?.store_name || o.store_id);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const items = useMemo<ItemAgg[]>(() => {
    if (!data) return [];
    const ordersById = new Map(data.orders.map((o: any) => [o.id, o]));
    const byItem = new Map<string, ItemAgg>();
    const needle = search.trim().toLowerCase();

    for (const line of data.lines as any[]) {
      const order: any = ordersById.get(line.sales_order_id);
      if (!order) continue;
      if (storeFilter !== "__all__" && order.store_id !== storeFilter) continue;
      if (itemFilter !== "__all__" && line.item_code !== itemFilter) continue;
      if (
        needle &&
        !String(line.item_name || "").toLowerCase().includes(needle) &&
        !String(line.item_code || "").toLowerCase().includes(needle)
      )
        continue;

      let it = byItem.get(line.item_code);
      if (!it) {
        it = {
          item_code: line.item_code,
          item_name: line.item_name,
          uom: line.uom || "UNIT",
          total: 0,
          stores: new Map(),
        };
        byItem.set(line.item_code, it);
      }
      const qty = Number(line.quantity) || 0;
      it.total += qty;

      const sid = order.store_id || "__nostore__";
      let s = it.stores.get(sid);
      if (!s) {
        s = {
          store_id: sid,
          store_code: order.stores?.store_code || "",
          store_name: order.stores?.store_name || "—",
          qty: 0,
          orderNumbers: new Set(),
        };
        it.stores.set(sid, s);
      }
      s.qty += qty;
      if (order.order_number) s.orderNumbers.add(order.order_number);
    }

    return Array.from(byItem.values()).sort((a, b) =>
      a.item_name.localeCompare(b.item_name),
    );
  }, [data, itemFilter, storeFilter, search]);

  const kpis = useMemo(() => {
    let totalQty = 0;
    const storeSet = new Set<string>();
    const orderSet = new Set<string>();
    for (const it of items) {
      totalQty += it.total;
      for (const s of it.stores.values()) {
        storeSet.add(s.store_id);
        s.orderNumbers.forEach((n) => orderSet.add(n));
      }
    }
    return {
      items: items.length,
      stores: storeSet.size,
      qty: totalQty,
      orders: orderSet.size,
    };
  }, [items]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Released Items Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;}
        h1{font-size:18px;margin:0 0 4px;}
        h2{font-size:13px;margin:14px 0 4px;}
        .meta{color:#555;font-size:12px;margin-bottom:8px;}
        table{width:100%;border-collapse:collapse;margin-bottom:12px;}
        th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left;}
        th{background:#f3f3f3;}
        td.num,th.num{text-align:right;}
        .item-header{background:#eef;padding:6px 8px;font-weight:600;margin-top:10px;border:1px solid #ccd;}
      </style></head><body>
      <h1>Released Items Report</h1>
      <div class="meta">Delivery Date: ${format(dateRange.from, "MMM dd, yyyy")} – ${format(dateRange.to, "MMM dd, yyyy")}</div>
      ${content.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const handleCSV = () => {
    const rows: (string | number)[][] = [
      [
        "Item Code",
        "Item Name",
        "UOM",
        "Store Code",
        "Store Name",
        "Released Qty",
        "# Orders",
        "Order Numbers",
      ],
    ];
    for (const it of items) {
      for (const s of Array.from(it.stores.values()).sort((a, b) =>
        a.store_name.localeCompare(b.store_name),
      )) {
        rows.push([
          it.item_code,
          it.item_name,
          it.uom,
          s.store_code,
          s.store_name,
          s.qty,
          s.orderNumbers.size,
          Array.from(s.orderNumbers).sort().join("; "),
        ]);
      }
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `released-items-${fromStr}-to-${toStr}.csv`;
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
            <Label className="text-xs">Item</Label>
            <Select value={itemFilter} onValueChange={setItemFilter}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="All items" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="__all__">All items</SelectItem>
                {itemOptions.map((i) => (
                  <SelectItem key={i.code} value={i.code}>
                    {i.name} ({i.code})
                  </SelectItem>
                ))}
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
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Item name or code…"
                className="pl-8 w-[240px]"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={items.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSV} disabled={items.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Released = items in <strong>submitted</strong> / <strong>processing</strong> sales orders with delivery date in range.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-md p-3">
          <div className="text-xs text-muted-foreground">Items</div>
          <div className="text-xl font-semibold">{kpis.items.toLocaleString()}</div>
        </div>
        <div className="border rounded-md p-3">
          <div className="text-xs text-muted-foreground">Stores</div>
          <div className="text-xl font-semibold">{kpis.stores.toLocaleString()}</div>
        </div>
        <div className="border rounded-md p-3">
          <div className="text-xs text-muted-foreground">Total Qty</div>
          <div className="text-xl font-semibold">{kpis.qty.toLocaleString()}</div>
        </div>
        <div className="border rounded-md p-3">
          <div className="text-xs text-muted-foreground">Orders</div>
          <div className="text-xl font-semibold">{kpis.orders.toLocaleString()}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center border rounded-md">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No released items for the selected filters.</p>
        </div>
      ) : (
        <div ref={printRef} className="space-y-4">
          {items.map((it) => {
            const stores = Array.from(it.stores.values()).sort((a, b) =>
              a.store_name.localeCompare(b.store_name),
            );
            return (
              <div key={it.item_code} className="border rounded-md">
                <div className="item-header flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{it.item_code}</span>
                    <span className="font-semibold">{it.item_name}</span>
                    <Badge variant="secondary">{it.uom}</Badge>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">{stores.length} store(s)</Badge>
                    <Badge>Total: {it.total.toLocaleString()}</Badge>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Code</TableHead>
                      <TableHead>Store Name</TableHead>
                      <TableHead className="text-right num">Released Qty</TableHead>
                      <TableHead className="text-right num"># Orders</TableHead>
                      <TableHead>Order Numbers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((s) => {
                      const ordNums = Array.from(s.orderNumbers).sort();
                      return (
                        <TableRow key={s.store_id}>
                          <TableCell className="font-mono text-xs">{s.store_code}</TableCell>
                          <TableCell>{s.store_name}</TableCell>
                          <TableCell className="text-right font-semibold num">
                            {s.qty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right num">{ordNums.length}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {ordNums.join(", ")}
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
