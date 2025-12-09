import { useEffect } from "react";
import { formatCurrency } from "@/lib/currency";
import { dateFormatters } from "@/lib/datetime";
import tlcLogo from "@/assets/tlc-logo.png";

interface POPrintViewProps {
  purchaseOrder: any;
  lines: any[];
  onClose: () => void;
}

export function POPrintView({ purchaseOrder, lines, onClose }: POPrintViewProps) {
  useEffect(() => {
    // Auto-print when component mounts
    window.print();
    // Close after printing
    const handleAfterPrint = () => {
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onClose]);

  const totalAmount = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);

  return (
    <div className="print:block hidden">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .page-break {
            page-break-after: always;
          }
          @page {
            margin: 20mm;
            size: A4;
          }
        }
      `}</style>

      {/* Print 2 copies */}
      {[1, 2].map((copyNumber) => (
        <div key={copyNumber} className={`print-container ${copyNumber === 1 ? 'page-break' : ''}`}>
          <div className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
              <div className="flex items-center gap-4">
                <img src={tlcLogo} alt="The Lemon Co" className="h-16 w-auto" />
                <div>
                  <h1 className="text-3xl font-bold">PURCHASE ORDER</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Copy {copyNumber} of 2 - {copyNumber === 1 ? 'CEO Copy' : 'Accounting Copy'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">PO #: {purchaseOrder.po_number}</p>
                <p className="text-sm text-gray-600">Date: {dateFormatters.medium(purchaseOrder.doc_date)}</p>
                {purchaseOrder.is_cash_purchase && (
                  <p className="text-sm font-semibold text-orange-600 mt-1">CASH PURCHASE</p>
                )}
              </div>
            </div>

            {/* Supplier Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Supplier Information:</h3>
              <p className="text-sm">
                <strong>Company:</strong> {purchaseOrder.suppliers?.company_name}
              </p>
              <p className="text-sm">
                <strong>Code:</strong> {purchaseOrder.suppliers?.supplier_code}
              </p>
              {purchaseOrder.suppliers?.address && (
                <p className="text-sm">
                  <strong>Address:</strong> {purchaseOrder.suppliers?.address}
                </p>
              )}
            </div>

            {/* PO Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm">
                  <strong>Delivery Date:</strong>{" "}
                  {purchaseOrder.delivery_date ? dateFormatters.medium(purchaseOrder.delivery_date) : "Not specified"}
                </p>
                <p className="text-sm">
                  <strong>Status:</strong> <span className="uppercase">{purchaseOrder.status}</span>
                </p>
              </div>
              <div>
                {purchaseOrder.approved_by && (
                  <>
                    <p className="text-sm">
                      <strong>Approved By:</strong> CEO
                    </p>
                    <p className="text-sm">
                      <strong>Approved On:</strong> {dateFormatters.medium(purchaseOrder.approved_at)}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Cash Purchase Details */}
            {purchaseOrder.is_cash_purchase && (
              <div className="mb-6 p-4 border-2 border-orange-500 rounded">
                <h3 className="font-semibold mb-2 text-orange-600">Cash Purchase Details:</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Cash Advance:</strong> {formatCurrency(purchaseOrder.cash_advance || 0)}</p>
                  {purchaseOrder.cash_returned > 0 && (
                    <p><strong>Cash Returned:</strong> {formatCurrency(purchaseOrder.cash_returned)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div className="mb-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="text-left py-2 text-sm">#</th>
                    <th className="text-left py-2 text-sm">Item Description</th>
                    <th className="text-left py-2 text-sm">SKU</th>
                    <th className="text-right py-2 text-sm">Qty</th>
                    <th className="text-right py-2 text-sm">Unit Price</th>
                    <th className="text-center py-2 text-sm">UOM</th>
                    <th className="text-right py-2 text-sm">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const item = line.item_type === 'raw_material' ? line.raw_materials : line.components;
                    return (
                      <tr key={line.id} className="border-b border-gray-300">
                        <td className="py-2 text-sm">{index + 1}</td>
                        <td className="py-2 text-sm">{item?.name}</td>
                        <td className="py-2 text-sm font-mono">{item?.sku}</td>
                        <td className="py-2 text-sm text-right">{line.quantity}</td>
                        <td className="py-2 text-sm text-right">{formatCurrency(line.unit_price)}</td>
                        <td className="py-2 text-sm text-center">{line.uom}</td>
                        <td className="py-2 text-sm text-right font-semibold">
                          {formatCurrency(line.quantity * line.unit_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-800">
                    <td colSpan={6} className="py-3 text-right font-bold text-lg">
                      TOTAL AMOUNT:
                    </td>
                    <td className="py-3 text-right font-bold text-lg">
                      {formatCurrency(totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarks */}
            {purchaseOrder.remarks && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Remarks:</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{purchaseOrder.remarks}</p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t">
              <div>
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-sm text-center">Prepared By</p>
                  <p className="text-xs text-center text-gray-600 mt-1">
                    {purchaseOrder.user_profiles?.full_name}
                  </p>
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-sm text-center">Approved By (CEO)</p>
                  {purchaseOrder.approved_at && (
                    <p className="text-xs text-center text-gray-600 mt-1">
                      {dateFormatters.medium(purchaseOrder.approved_at)}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-sm text-center">Received By</p>
                  <p className="text-xs text-center text-gray-600 mt-1">Date: __________</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-500">
              <p>This is a computer-generated document. No signature is required.</p>
              <p className="mt-1">Generated on: {dateFormatters.medium(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
