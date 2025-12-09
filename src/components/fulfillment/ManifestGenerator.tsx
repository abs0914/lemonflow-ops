import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useFulfillmentOrdersByIds, useFulfillmentOrderLines } from "@/hooks/useFulfillment";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import tlcLogo from "@/assets/tlc-logo.png";

interface ManifestGeneratorProps {
  orderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManifestGenerator({ orderIds, open, onOpenChange }: ManifestGeneratorProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: orders, isLoading: ordersLoading } = useFulfillmentOrdersByIds(orderIds);
  const { data: lines, isLoading: linesLoading } = useFulfillmentOrderLines(orderIds);

  const isLoading = ordersLoading || linesLoading;

  // Group items by item code to show consolidated quantities
  const consolidatedItems = lines?.reduce((acc, line) => {
    const key = line.item_code;
    if (!acc[key]) {
      acc[key] = {
        item_code: line.item_code,
        item_name: line.item_name,
        uom: line.uom,
        total_quantity: 0,
      };
    }
    acc[key].total_quantity += line.quantity;
    return acc;
  }, {} as Record<string, { item_code: string; item_name: string; uom: string; total_quantity: number }>);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Delivery Manifest</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; }
                .header { text-align: center; margin-bottom: 20px; }
                .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 10px; }
                .checkbox { width: 20px; height: 20px; border: 1px solid #000; display: inline-block; }
                @media print { button { display: none; } }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Delivery Manifest</span>
            <Button onClick={handlePrint} disabled={isLoading}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div ref={printRef}>
            <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
              <img src={tlcLogo} alt="The Lemon Co" style={{ height: "60px", marginBottom: "10px" }} />
              <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "5px" }}>
                THE LEMON CO
              </h1>
              <h2 style={{ fontSize: "18px", marginBottom: "5px" }}>
                Delivery Manifest
              </h2>
              <p style={{ fontSize: "12px", color: "#666" }}>
                Generated: {format(new Date(), "MMMM dd, yyyy HH:mm")}
              </p>
            </div>

            <div className="section-title">Orders Included ({orders?.length || 0})</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "30px" }}>✓</th>
                  <th>Order #</th>
                  <th>Store</th>
                  <th>Address</th>
                  <th>Contact</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((order) => (
                  <tr key={order.id}>
                    <td><div className="checkbox"></div></td>
                    <td>{order.order_number}</td>
                    <td>{order.stores?.store_name}</td>
                    <td>{order.stores?.address || "-"}</td>
                    <td>
                      {order.stores?.contact_person || "-"}
                      {order.stores?.phone && <br />}
                      {order.stores?.phone}
                    </td>
                    <td style={{ fontWeight: "bold" }}>
                      ₱{order.total_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="section-title">Consolidated Items</div>
            <table>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Total Qty</th>
                  <th>UOM</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(consolidatedItems || {}).map((item) => (
                  <tr key={item.item_code}>
                    <td>{item.item_code}</td>
                    <td>{item.item_name}</td>
                    <td style={{ fontWeight: "bold" }}>{item.total_quantity}</td>
                    <td>{item.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ marginBottom: "40px" }}>Prepared By: ___________________</p>
                <p>Date: ___________________</p>
              </div>
              <div>
                <p style={{ marginBottom: "40px" }}>Driver: ___________________</p>
                <p>Vehicle #: ___________________</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
