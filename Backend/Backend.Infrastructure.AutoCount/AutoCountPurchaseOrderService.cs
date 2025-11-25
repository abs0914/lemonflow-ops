using System;
using System.Linq;
using AutoCount;
using AutoCount.Invoicing.Purchase.PurchaseOrder;
using Backend.Domain;
using DomainPurchaseOrder = Backend.Domain.PurchaseOrder;
using AutoCountPurchaseOrderDocument = AutoCount.Invoicing.Purchase.PurchaseOrder.PurchaseOrder;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountPurchaseOrderService using
    /// AutoCount 2.x Purchase Order API.
    ///
    /// References:
    /// https://wiki.autocountsoft.com/wiki/Programmer:Purchase_Order_v2
    /// </summary>
    public class AutoCountPurchaseOrderService : IAutoCountPurchaseOrderService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountPurchaseOrderService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        /// <inheritdoc />
        public DomainPurchaseOrder CreatePurchaseOrder(DomainPurchaseOrder purchaseOrder)
        {
            if (purchaseOrder == null)
                throw new ArgumentNullException("purchaseOrder");

            if (string.IsNullOrWhiteSpace(purchaseOrder.SupplierCode))
                throw new ArgumentException("SupplierCode is required.", "purchaseOrder");

            if (purchaseOrder.Details == null || !purchaseOrder.Details.Any())
                throw new ArgumentException("Purchase order must contain at least one detail line.", "purchaseOrder");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var cmd = PurchaseOrderCommand.Create(userSession, userSession.DBSetting);

                    AutoCountPurchaseOrderDocument doc;

                    if (!string.IsNullOrWhiteSpace(purchaseOrder.DocNo))
                    {
                        // Try to edit existing document; if not found, create new.
                        doc = cmd.Edit(purchaseOrder.DocNo);
                        if (doc == null)
                        {
                            doc = cmd.AddNew();
                            doc.DocNo = purchaseOrder.DocNo;
                        }
                        else
                        {
                            doc.ClearDetails();
                        }
                    }
                    else
                    {
                        doc = cmd.AddNew();
                    }

                    // Header fields
                    if (!string.IsNullOrWhiteSpace(purchaseOrder.SupplierCode))
                    {
                        doc.SupplierCode = purchaseOrder.SupplierCode;
                    }

                    doc.DocDate = purchaseOrder.DocDate == default(DateTime)
                        ? DateTime.Today.Date
                        : purchaseOrder.DocDate.Date;

                    if (purchaseOrder.DeliveryDate.HasValue)
                    {
                        doc.DeliveryDate = purchaseOrder.DeliveryDate.Value.Date;
                    }

                    if (!string.IsNullOrWhiteSpace(purchaseOrder.Description))
                    {
                        doc.Description = purchaseOrder.Description;
                    }

                    // Details
                    foreach (var line in purchaseOrder.Details)
                    {
                        var dtl = doc.AddDetail();
                        if (!string.IsNullOrWhiteSpace(line.ItemCode))
                        {
                            dtl.ItemCode = line.ItemCode;
                        }

                        dtl.UOM = string.IsNullOrWhiteSpace(line.UOM) ? "UNIT" : line.UOM;
                        dtl.Location = "HQ"; // Default location; can be parameterized later.
                        dtl.Qty = line.Quantity;
                        dtl.UnitPrice = line.UnitPrice;

                        if (!string.IsNullOrWhiteSpace(line.Description))
                            dtl.Description = line.Description;

                        if (!string.IsNullOrWhiteSpace(line.LineRemarks))
                            dtl.Remark = line.LineRemarks;
                    }

                    try
                    {
                        doc.Save();
                    }
                    catch (AppException ex)
                    {
                        throw new InvalidOperationException("AutoCount rejected purchase order: " + ex.Message, ex);
                    }

                    // Map back to domain model with the final DocNo.
                    purchaseOrder.DocNo = doc.DocNo;
                    return purchaseOrder;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create purchase order in AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public bool CancelPurchaseOrder(string documentNo)
        {
            if (string.IsNullOrWhiteSpace(documentNo))
                throw new ArgumentException("Document number is required.", "documentNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var cmd = PurchaseOrderCommand.Create(userSession, userSession.DBSetting);

                    try
                    {
                        return cmd.CancelDocument(documentNo, userSession.LoginUserID);
                    }
                    catch (AppException ex)
                    {
                        throw new InvalidOperationException("AutoCount failed to cancel purchase order '" + documentNo + "': " + ex.Message, ex);
                    }
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to cancel purchase order '" + documentNo + "' in AutoCount.", ex);
                }
            }
        }
    }
}
