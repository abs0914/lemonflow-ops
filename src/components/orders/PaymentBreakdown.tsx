interface PaymentBreakdownProps {
  order: {
    total_amount?: number | null;
    delivery_fee?: number | null;
    shipping_fee?: number | null;
    expedite_fee?: number | null;
    vat_amount?: number | null;
    ewt_amount?: number | null;
    underpayment?: number | null;
    overpayment?: number | null;
    discount_amount?: number | null;
  };
}

export function PaymentBreakdown({ order }: PaymentBreakdownProps) {
  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = order.total_amount || 0;
  const delivery = order.delivery_fee || 0;
  const shipping = order.shipping_fee || 0;
  const expedite = order.expedite_fee || 0;
  const vat = order.vat_amount || 0;
  const ewt = order.ewt_amount || 0;
  const underpayment = order.underpayment || 0;
  const overpayment = order.overpayment || 0;
  const discount = order.discount_amount || 0;

  const hasAdjustments =
    delivery || shipping || expedite || vat || ewt || underpayment || overpayment || discount;
  if (!hasAdjustments) return null;

  const amountDue =
    total + delivery + shipping + expedite + vat + underpayment - ewt - overpayment - discount;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="text-sm font-medium mb-2">Payment Breakdown</div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Order Total</span>
        <span>{fmt(total)}</span>
      </div>
      {delivery > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Delivery Fee</span>
          <span>+ {fmt(delivery)}</span>
        </div>
      )}
      {shipping > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping Fee</span>
          <span>+ {fmt(shipping)}</span>
        </div>
      )}
      {expedite > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Expedite Fee</span>
          <span>+ {fmt(expedite)}</span>
        </div>
      )}
      {vat > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">VAT</span>
          <span>+ {fmt(vat)}</span>
        </div>
      )}
      {underpayment > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Underpayment</span>
          <span>+ {fmt(underpayment)}</span>
        </div>
      )}
      {ewt > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">EWT</span>
          <span>- {fmt(ewt)}</span>
        </div>
      )}
      {overpayment > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overpayment Credit</span>
          <span>- {fmt(overpayment)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Discount</span>
          <span>- {fmt(discount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold border-t pt-2">
        <span>Amount Due</span>
        <span className="text-lg">{fmt(amountDue)}</span>
      </div>
    </div>
  );
}
