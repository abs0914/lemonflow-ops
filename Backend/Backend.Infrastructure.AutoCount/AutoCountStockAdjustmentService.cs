using System;
using System.Data;
using AutoCount;
using AutoCount.Stock.StockAdjustment;
using Backend.Domain;
using DomainStockAdjustment = Backend.Domain.StockAdjustment;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountStockAdjustmentService using
    /// AutoCount 2.x Stock Adjustment API.
    ///
    /// References:
    /// https://wiki.autocountsoft.com/wiki/Programmer:Stock_Adjustment_v2
    /// </summary>
    public class AutoCountStockAdjustmentService : IAutoCountStockAdjustmentService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountStockAdjustmentService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        /// <inheritdoc />
        public string CreateStockAdjustment(DomainStockAdjustment adjustment)
        {
            if (adjustment == null)
                throw new ArgumentNullException("adjustment");

            if (string.IsNullOrWhiteSpace(adjustment.ItemCode))
                throw new ArgumentException("ItemCode is required.", "adjustment");

            if (adjustment.Quantity == 0)
                throw new ArgumentException("Quantity must not be zero.", "adjustment");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();

                    var cmd = StockAdjustmentCommand.Create(userSession, userSession.DBSetting);
                    var doc = cmd.AddNew();

                    // Header fields
                    doc.DocDate = (adjustment.DocDate ?? DateTime.Today).Date;
                    doc.Description = string.IsNullOrWhiteSpace(adjustment.Description)
                        ? "Adjust Stock Quantity"
                        : adjustment.Description;
                    if (!string.IsNullOrWhiteSpace(adjustment.Reason))
                    {
                        doc.RefDocNo = adjustment.Reason;
                    }

                    // Look up the item's base UOM from AutoCount if not provided
                    string itemUom = adjustment.UOM;
                    if (string.IsNullOrWhiteSpace(itemUom))
                    {
                        // Query the item's base UOM from the database
                        string uomSql = "SELECT BaseUOM FROM Item WHERE ItemCode = @ItemCode";
                        var uomParam = new System.Data.SqlClient.SqlParameter("@ItemCode", adjustment.ItemCode);
                        DataTable uomTable = userSession.DBSetting.GetDataTable(uomSql, false, new[] { uomParam });

                        if (uomTable.Rows.Count > 0 && uomTable.Rows[0]["BaseUOM"] != DBNull.Value)
                        {
                            itemUom = uomTable.Rows[0]["BaseUOM"].ToString();
                        }
                        else
                        {
                            throw new InvalidOperationException(
                                "Item '" + adjustment.ItemCode + "' not found or has no base UOM defined in AutoCount.");
                        }
                    }

                    // Single detail line. Per AutoCount docs, positive Qty
                    // increases stock and must provide UnitCost; negative
                    // Qty decreases stock and UnitCost is for reference only.
                    var dtl = doc.AddDetail();
                    dtl.ItemCode = adjustment.ItemCode;
                    dtl.UOM = itemUom;

                    decimal qty = Math.Abs(adjustment.Quantity);
                    string type = (adjustment.AdjustmentType ?? "IN").ToUpperInvariant();

                    switch (type)
                    {
                        case "IN":
                            dtl.Qty = qty;
                            dtl.UnitCost = adjustment.Quantity > 0 ? adjustment.Quantity : 0M;
                            break;
                        case "OUT":
                            dtl.Qty = -qty;
                            break;
                        case "SET":
                            // Treat SET as an explicit delta; positive for
                            // increase, negative for decrease.
                            dtl.Qty = adjustment.Quantity;
                            if (adjustment.Quantity > 0)
                            {
                                dtl.UnitCost = adjustment.Quantity;
                            }
                            break;
                        default:
                            throw new ArgumentException("Unsupported AdjustmentType: " + adjustment.AdjustmentType, "adjustment");
                    }

                    try
                    {
                        doc.Save();
                    }
                    catch (AppException ex)
                    {
                        throw new InvalidOperationException("AutoCount rejected stock adjustment: " + ex.Message, ex);
                    }

                    return doc.DocNo;
                }
                catch (Exception ex)
                {
                    // Include inner exception details for debugging
                    string errorDetails = ex.Message;
                    if (ex.InnerException != null)
                    {
                        errorDetails += " Inner: " + ex.InnerException.Message;
                    }
                    throw new InvalidOperationException("Failed to create stock adjustment: " + errorDetails, ex);
                }
            }
        }

        /// <inheritdoc />
        public bool CancelStockAdjustment(string documentNo)
        {
            if (string.IsNullOrWhiteSpace(documentNo))
                throw new ArgumentException("Document number is required.", "documentNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var cmd = StockAdjustmentCommand.Create(userSession, userSession.DBSetting);

                    try
                    {
                        return cmd.CancelDocument(documentNo);
                    }
                    catch (AppException ex)
                    {
                        throw new InvalidOperationException("AutoCount failed to cancel stock adjustment '" + documentNo + "': " + ex.Message, ex);
                    }
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to cancel stock adjustment '" + documentNo + "' in AutoCount.", ex);
                }
            }
        }
    }
}
