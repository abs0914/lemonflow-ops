using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using AutoCount;
using AutoCount.Invoicing.Purchase.PurchaseOrder;
using Backend.Domain;
using DomainPurchaseOrder = Backend.Domain.PurchaseOrder;
using DomainPurchaseOrderLine = Backend.Domain.PurchaseOrderLine;
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
        public List<DomainPurchaseOrder> GetPurchaseOrders(int? limit = null)
        {
            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Query PO table for document numbers
                    string sql = @"
                        SELECT TOP {0}
                            p.DocNo, p.DocDate, p.CreditorCode, p.Description, p.Cancelled
                        FROM PO p
                        ORDER BY p.DocDate DESC, p.DocNo DESC";

                    int maxRows = limit.HasValue && limit.Value > 0 ? limit.Value : 100;
                    sql = string.Format(sql, maxRows);

                    DataTable tbl = dbSetting.GetDataTable(sql, false);

                    var result = new List<DomainPurchaseOrder>();
                    foreach (DataRow row in tbl.Rows)
                    {
                        var po = new DomainPurchaseOrder
                        {
                            DocNo = GetString(row, "DocNo"),
                            SupplierCode = GetString(row, "CreditorCode"),
                            DocDate = GetDateTime(row, "DocDate") ?? DateTime.Today,
                            Description = GetString(row, "Description"),
                            IsCancelled = GetBool(row, "Cancelled", false)
                        };
                        result.Add(po);
                    }

                    return result;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve purchase orders from AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public DomainPurchaseOrder GetPurchaseOrder(string docNo)
        {
            if (string.IsNullOrWhiteSpace(docNo))
                throw new ArgumentException("Document number is required.", "docNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Query PO header
                    string headerSql = @"
                        SELECT p.DocNo, p.DocDate, p.CreditorCode, p.Description, p.Cancelled
                        FROM PO p
                        WHERE p.DocNo = @DocNo";

                    var param = new System.Data.SqlClient.SqlParameter("@DocNo", docNo);
                    DataTable headerTbl = dbSetting.GetDataTable(headerSql, false, new[] { param });

                    if (headerTbl.Rows.Count == 0)
                        return null;

                    var headerRow = headerTbl.Rows[0];
                    var po = new DomainPurchaseOrder
                    {
                        DocNo = GetString(headerRow, "DocNo"),
                        SupplierCode = GetString(headerRow, "CreditorCode"),
                        DocDate = GetDateTime(headerRow, "DocDate") ?? DateTime.Today,
                        Description = GetString(headerRow, "Description"),
                        IsCancelled = GetBool(headerRow, "Cancelled", false),
                        Details = new List<DomainPurchaseOrderLine>()
                    };

                    // Query PO details
                    string detailSql = @"
                        SELECT d.Seq, d.ItemCode, d.Description, d.Qty, d.UnitPrice, d.UOM, d.DeliveryDate, d.Remark
                        FROM PODtl d
                        WHERE d.DocNo = @DocNo
                        ORDER BY d.Seq";

                    var detailParam = new System.Data.SqlClient.SqlParameter("@DocNo", docNo);
                    DataTable detailTbl = dbSetting.GetDataTable(detailSql, false, new[] { detailParam });

                    int lineNumber = 0;
                    foreach (DataRow detailRow in detailTbl.Rows)
                    {
                        lineNumber++;
                        var detail = new DomainPurchaseOrderLine
                        {
                            LineNumber = lineNumber,
                            ItemCode = GetString(detailRow, "ItemCode"),
                            Description = GetString(detailRow, "Description"),
                            Quantity = GetDecimal(detailRow, "Qty") ?? 0,
                            UnitPrice = GetDecimal(detailRow, "UnitPrice") ?? 0,
                            UOM = GetString(detailRow, "UOM"),
                            LineRemarks = GetString(detailRow, "Remark")
                        };

                        // Set delivery date from first detail line
                        if (!po.DeliveryDate.HasValue)
                        {
                            po.DeliveryDate = GetDateTime(detailRow, "DeliveryDate");
                        }

                        po.Details.Add(detail);
                    }

                    return po;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve purchase order '" + docNo + "' from AutoCount.", ex);
                }
            }
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
                    doc.DocDate = purchaseOrder.DocDate == default(DateTime)
                        ? DateTime.Today.Date
                        : purchaseOrder.DocDate.Date;

                    // Set CreditorCode (supplier) - required for FK_PO_DisplayTerm constraint
                    try
                    {
                        doc.CreditorCode = purchaseOrder.SupplierCode;
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException(
                            "Failed to set CreditorCode '" + purchaseOrder.SupplierCode + "': " + ex.Message, ex);
                    }

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

        #region Helper Methods

        private static string GetString(DataRow row, string columnName)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return null;

            return row[columnName] as string;
        }

        private static DateTime? GetDateTime(DataRow row, string columnName)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return null;

            return Convert.ToDateTime(row[columnName]);
        }

        private static decimal? GetDecimal(DataRow row, string columnName)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return null;

            return Convert.ToDecimal(row[columnName]);
        }

        private static bool GetBool(DataRow row, string columnName, bool defaultValue)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return defaultValue;

            var value = row[columnName];

            // Handle AutoCount's 'T'/'F' boolean representation
            if (value is string strVal)
            {
                return strVal.Equals("T", StringComparison.OrdinalIgnoreCase) ||
                       strVal.Equals("True", StringComparison.OrdinalIgnoreCase) ||
                       strVal.Equals("1", StringComparison.Ordinal);
            }

            return Convert.ToBoolean(value);
        }

        #endregion
    }
}
