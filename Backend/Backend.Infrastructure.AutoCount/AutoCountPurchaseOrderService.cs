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
                    global::AutoCount.Authentication.UserSession userSession;
                    try
                    {
                        userSession = _sessionProvider.GetUserSession();
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException("Exception getting user session: " + ex.Message, ex);
                    }
                    if (userSession == null)
                        throw new InvalidOperationException("Failed to get AutoCount user session - returned null.");

                    PurchaseOrderCommand cmd;
                    try
                    {
                        cmd = PurchaseOrderCommand.Create(userSession, userSession.DBSetting);
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException("Exception creating PurchaseOrderCommand: " + ex.Message, ex);
                    }
                    if (cmd == null)
                        throw new InvalidOperationException("Failed to create PurchaseOrderCommand - returned null.");

                    AutoCountPurchaseOrderDocument doc;

                    if (!string.IsNullOrWhiteSpace(purchaseOrder.DocNo))
                    {
                        // Try to edit existing document; if not found, create new.
                        try
                        {
                            doc = cmd.Edit(purchaseOrder.DocNo);
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Exception editing document: " + ex.Message, ex);
                        }
                        if (doc == null)
                        {
                            try
                            {
                                doc = cmd.AddNew();
                            }
                            catch (Exception ex)
                            {
                                throw new InvalidOperationException("Exception in AddNew after Edit: " + ex.Message, ex);
                            }
                            if (doc == null)
                                throw new InvalidOperationException("Failed to create new purchase order document - returned null.");
                            try
                            {
                                doc.DocNo = purchaseOrder.DocNo;
                            }
                            catch (Exception ex)
                            {
                                throw new InvalidOperationException("Exception setting DocNo: " + ex.Message, ex);
                            }
                        }
                        else
                        {
                            try
                            {
                                doc.ClearDetails();
                            }
                            catch (Exception ex)
                            {
                                throw new InvalidOperationException("Exception clearing details: " + ex.Message, ex);
                            }
                        }
                    }
                    else
                    {
                        try
                        {
                            doc = cmd.AddNew();
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Exception in AddNew: " + ex.Message, ex);
                        }
                        if (doc == null)
                            throw new InvalidOperationException("Failed to create new purchase order document - returned null.");
                    }

                    // Header fields
                    // Note: Purchase Orders in AutoCount may not require CreditorCode at header level.
                    // The supplier association typically happens when converting to GRN or Purchase Invoice.
                    // Storing SupplierCode in Description for reference if needed.

                    doc.DocDate = purchaseOrder.DocDate == default(DateTime)
                        ? DateTime.Today.Date
                        : purchaseOrder.DocDate.Date;

                    // Note: DeliveryDate is set on detail lines, not header

                    if (!string.IsNullOrWhiteSpace(purchaseOrder.Description))
                    {
                        doc.Description = purchaseOrder.Description;
                    }

                    // Details
                    int lineIndex = 0;
                    foreach (var line in purchaseOrder.Details)
                    {
                        lineIndex++;
                        PurchaseOrderDetail dtl;
                        try
                        {
                            dtl = doc.AddDetail();
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Exception adding detail line " + lineIndex + ": " + ex.Message, ex);
                        }
                        if (dtl == null)
                            throw new InvalidOperationException("Failed to add detail line " + lineIndex);

                        try
                        {
                            if (!string.IsNullOrWhiteSpace(line.ItemCode))
                            {
                                dtl.ItemCode = line.ItemCode;
                            }
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Failed to set ItemCode '" + line.ItemCode + "' on line " + lineIndex + ": " + ex.Message, ex);
                        }

                        try
                        {
                            dtl.UOM = string.IsNullOrWhiteSpace(line.UOM) ? "UNIT" : line.UOM;
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Failed to set UOM on line " + lineIndex + ": " + ex.Message, ex);
                        }

                        try
                        {
                            // Skip Location - it may not be required
                            // dtl.Location = "HQ";
                            dtl.Qty = line.Quantity;
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Failed to set Qty on line " + lineIndex + ": " + ex.Message, ex);
                        }

                        try
                        {
                            dtl.UnitPrice = line.UnitPrice;
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException("Failed to set UnitPrice on line " + lineIndex + ": " + ex.Message, ex);
                        }

                        // Set delivery date on detail line if provided
                        if (purchaseOrder.DeliveryDate.HasValue)
                        {
                            try
                            {
                                dtl.DeliveryDate = purchaseOrder.DeliveryDate.Value.Date;
                            }
                            catch (Exception ex)
                            {
                                throw new InvalidOperationException("Failed to set DeliveryDate on line " + lineIndex + ": " + ex.Message, ex);
                            }
                        }

                        if (!string.IsNullOrWhiteSpace(line.Description))
                        {
                            try
                            {
                                dtl.Description = line.Description;
                            }
                            catch (Exception ex)
                            {
                                throw new InvalidOperationException("Failed to set Description on line " + lineIndex + ": " + ex.Message, ex);
                            }
                        }
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
                catch (InvalidOperationException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create purchase order in AutoCount: " + ex.Message, ex);
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
