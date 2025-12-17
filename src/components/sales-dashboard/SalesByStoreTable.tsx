import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StoreData {
  code: string;
  name: string;
  type: "own" | "franchise";
  posSales: number;
  orderSales: number;
  total: number;
  percentage: number;
}

interface SalesByStoreTableProps {
  data: StoreData[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function SalesByStoreTable({ data, loading }: SalesByStoreTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales by Store</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Store</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No store data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Code</TableHead>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">POS Sales</TableHead>
                  <TableHead className="text-right">Order Sales</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((store) => (
                  <TableRow key={store.code}>
                    <TableCell className="font-mono text-sm">
                      {store.code}
                    </TableCell>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={store.type === "own" ? "default" : "secondary"}
                      >
                        {store.type === "own" ? "Own" : "Franchise"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(store.posSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(store.orderSales)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(store.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {store.percentage.toFixed(1)}%
                    </TableCell>
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
