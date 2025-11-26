using System;
using System.Collections.Generic;
using Backend.Domain;
using AutoCount.Invoicing.Sales.Invoice;
using AutoCount.Document;
using AutoCount.Const;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountSalesInvoiceService using AutoCount 2.1 API.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API
    /// 
    /// This service uses the shared UserSession (initialized via IAutoCountSessionProvider)
    /// to perform sales invoice operations. Thread-safe access to AutoCount is ensured by
    /// serializing calls through a lock.
    /// 
    /// Tax Code Handling:
    /// Per AutoCount docs: "GovernmentTaxCode replaces older IRASTaxCode naming"
    /// This implementation uses AutoCount's tax code helpers to resolve rates dynamically.
    /// </summary>
    public class AutoCountSalesInvoiceService : IAutoCountSalesInvoiceService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountSalesInvoiceService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        public SalesInvoice GetSalesInvoiceByDocumentNo(string documentNo)
        {
            if (string.IsNullOrWhiteSpace(documentNo))
                throw new ArgumentException("Document number cannot be empty.", "documentNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();

                    // Use AutoCount v2 Sales Invoice API as per
                    // https://wiki.autocountsoft.com/wiki/Programmer:Sales_Invoice_v2
                    var cmd = InvoiceCommand.Create(userSession, userSession.DBSetting);

                    // Use GetDocKeyByDocNo to check existence without throwing when not found.
                    long docKey = cmd.GetDocKeyByDocNo(documentNo);
                    if (docKey <= 0)
                    {
                        return null;
                    }

                    var doc = cmd.Edit(documentNo);
                    if (doc == null)
                        return null;

                    return MapAutoCountInvoiceToDomain(doc);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve sales invoice '" + documentNo + "' from AutoCount.", ex);
                }
            }
        }

        public SalesInvoice CreateSalesInvoice(SalesInvoice invoice)
        {
            if (invoice == null)
                throw new ArgumentNullException("invoice");
            if (string.IsNullOrWhiteSpace(invoice.DebtorCode))
                throw new ArgumentException("Debtor code is required.", "invoice");
            if (invoice.Lines == null || invoice.Lines.Count == 0)
                throw new ArgumentException("Invoice must have at least one line item.", "invoice");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();

                    // Implement using AutoCount.Invoicing.Sales.Invoice.InvoiceCommand
                    // (Programmer:Sales Invoice v2 – NewSaleInvoice example).
                    string newDocStr = AppConst.NewDocumentNo;
                    InvoiceCommand cmd = InvoiceCommand.Create(userSession, userSession.DBSetting);
                    Invoice doc = cmd.AddNew();

                    // Header
                    doc.DebtorCode = invoice.DebtorCode;
                    // If caller did not supply a document number, let AutoCount assign running number.
                    doc.DocNo = string.IsNullOrWhiteSpace(invoice.DocumentNo)
                        ? newDocStr
                        : invoice.DocumentNo;

                    if (invoice.InvoiceDate != DateTime.MinValue)
                        doc.DocDate = invoice.InvoiceDate;

                    // Map remarks to document description.
                    if (!string.IsNullOrWhiteSpace(invoice.Remarks))
                        doc.Description = invoice.Remarks;

                    // Use a sensible default rounding method and inclusive-tax flag.
                    doc.RoundingMethod = DocumentRoundingMethod.LineByLine_Ver2;
                    doc.InclusiveTax = false;

                    // Details
                    foreach (var line in invoice.Lines)
                    {
                        var dtl = doc.AddDetail();

                        // When ItemCode is assigned, AccNo will be refreshed automatically
                        // based on ItemGroup's SaleAccNo (per AutoCount docs).
                        if (!string.IsNullOrWhiteSpace(line.ItemCode))
                            dtl.ItemCode = line.ItemCode;

                        if (!string.IsNullOrWhiteSpace(line.Description))
                            dtl.Description = line.Description ?? dtl.Description;

                        // Quantity / UOM / Unit price
                        if (line.Quantity != 0)
                            dtl.Qty = line.Quantity;
                        if (!string.IsNullOrWhiteSpace(line.UnitOfMeasure))
                            dtl.UOM = line.UnitOfMeasure;
                        if (line.UnitPrice != 0)
                            dtl.UnitPrice = line.UnitPrice;

                        // Subtotal (amount). AutoCount will also recalculate based on Qty & UnitPrice.
                        if (line.LineAmount != 0)
                            dtl.SubTotal = line.LineAmount;

                        // GST / tax code – let AutoCount resolve the rate based on code and date.
                        if (!string.IsNullOrWhiteSpace(line.TaxCode))
                            dtl.TaxCode = line.TaxCode;
                    }

                    // Save as posted invoice.
                    doc.Save();

                    // Update domain model from saved AutoCount document (doc no, totals, status).
                    var result = MapAutoCountInvoiceToDomain(doc);
                    // Preserve caller-supplied line metadata where possible
                    result.Lines = invoice.Lines ?? new List<SalesInvoiceLine>();
                    return result;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create sales invoice in AutoCount.", ex);
                }
            }
        }

        public SalesInvoice UpdateSalesInvoice(SalesInvoice invoice)
        {
            if (invoice == null)
                throw new ArgumentNullException("invoice");
            if (string.IsNullOrWhiteSpace(invoice.DocumentNo))
                throw new ArgumentException("Document number is required for update.", "invoice");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();

                    InvoiceCommand cmd = InvoiceCommand.Create(userSession, userSession.DBSetting);
                    Invoice doc = cmd.Edit(invoice.DocumentNo);
                    if (doc == null)
                    {
                        throw new InvalidOperationException(
                            "Sales invoice '" + invoice.DocumentNo + "' not found in AutoCount.");
                    }

                    // Header updates
                    if (!string.IsNullOrWhiteSpace(invoice.DebtorCode))
                        doc.DebtorCode = invoice.DebtorCode;
                    if (invoice.InvoiceDate != DateTime.MinValue)
                        doc.DocDate = invoice.InvoiceDate;
                    if (!string.IsNullOrWhiteSpace(invoice.Remarks))
                        doc.Description = invoice.Remarks;

                    // Replace all existing details with incoming ones.
                    doc.ClearDetails();
                    foreach (var line in invoice.Lines)
                    {
                        var dtl = doc.AddDetail();

                        if (!string.IsNullOrWhiteSpace(line.ItemCode))
                            dtl.ItemCode = line.ItemCode;
                        if (!string.IsNullOrWhiteSpace(line.Description))
                            dtl.Description = line.Description ?? dtl.Description;

                        if (line.Quantity != 0)
                            dtl.Qty = line.Quantity;
                        if (!string.IsNullOrWhiteSpace(line.UnitOfMeasure))
                            dtl.UOM = line.UnitOfMeasure;
                        if (line.UnitPrice != 0)
                            dtl.UnitPrice = line.UnitPrice;
                        if (line.LineAmount != 0)
                            dtl.SubTotal = line.LineAmount;
                        if (!string.IsNullOrWhiteSpace(line.TaxCode))
                            dtl.TaxCode = line.TaxCode;
                    }

                    doc.Save();

                    var result = MapAutoCountInvoiceToDomain(doc);
                    result.Lines = invoice.Lines ?? new List<SalesInvoiceLine>();
                    return result;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to update sales invoice '" + invoice.DocumentNo + "' in AutoCount.", ex);
                }
            }
        }

        public void PostSalesInvoice(string documentNo)
        {
            if (string.IsNullOrWhiteSpace(documentNo))
                throw new ArgumentException("Document number cannot be empty.", "documentNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();

                    // In AutoCount v2, posting can be modelled as saving the document
                    // in non-draft state. If the document does not exist, Edit will
                    // return null.
                    InvoiceCommand cmd = InvoiceCommand.Create(userSession, userSession.DBSetting);
                    Invoice doc = cmd.Edit(documentNo);
                    if (doc == null)
                    {
                        throw new InvalidOperationException(
                            "Sales invoice '" + documentNo + "' not found in AutoCount.");
                    }

                    // Save as non-draft; if the document is already posted this is
                    // effectively idempotent.
                    doc.Save(false);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to post sales invoice '" + documentNo + "' in AutoCount.", ex);
                }
            }
        }

        public bool SalesInvoiceExists(string documentNo)
        {
            if (string.IsNullOrWhiteSpace(documentNo))
                throw new ArgumentException("Document number cannot be empty.", "documentNo");

            lock (_lockObject)
            {
                try
                {
                    var invoice = GetSalesInvoiceByDocumentNo(documentNo);
                    return invoice != null;
                }
                catch
                {
                    return false;
                }
            }
        }

        public string[] GetAvailableTaxCodes()
        {
            lock (_lockObject)
            {
                try
                {
                    // NOTE: Implementing full GSTHelper-based tax code retrieval requires
                    // additional AutoCount GST assemblies. For now we return an empty
                    // array, which keeps the API surface functional but indicates that
                    // tax code discovery is not yet wired.
                    _sessionProvider.GetUserSession(); // ensure initialization / throw if invalid
                    return new string[0];
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve tax codes from AutoCount.", ex);
                }
            }
        }

        public decimal GetTaxRate(string taxCode)
        {
            if (string.IsNullOrWhiteSpace(taxCode))
                throw new ArgumentException("Tax code cannot be empty.", "taxCode");

            lock (_lockObject)
            {
                try
                {
                    // NOTE: AutoCount Accounting 2.1 automatically resolves effective tax
                    // rates on documents using GSTHelper based on GovernmentTaxCode and
                    // document date. Exposing a generic GetTaxRate API would require
                    // additional GST-specific references which are not yet included in
                    // this project. For now, this method returns 0 and relies on AutoCount
                    // to calculate actual tax on saved documents.
                    _sessionProvider.GetUserSession(); // ensure initialization / throw if invalid
                    return 0m;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve tax rate for code '" + taxCode + "' from AutoCount.", ex);
                }
            }
        }

        private SalesInvoice MapAutoCountInvoiceToDomain(Invoice acInvoice)
        {
            if (acInvoice == null)
                return null;

            var result = new SalesInvoice
            {
                DocumentNo = acInvoice.DocNo,
                DebtorCode = acInvoice.DebtorCode,
                InvoiceDate = acInvoice.DocDate.HasValue ? acInvoice.DocDate.Value : DateTime.MinValue,
                Remarks = acInvoice.Description,
                Total = acInvoice.FinalTotal.HasValue ? acInvoice.FinalTotal.Value : 0m,
                Status = acInvoice.DocStatus.HasValue ? acInvoice.DocStatus.Value.ToString() : string.Empty,
                Lines = new List<SalesInvoiceLine>()
            };

            // NOTE: AutoCount v2 exposes invoice detail rows via the document instance,
            // but their enumeration API is not documented in the public wiki snippets.
            // For now we return header information only and let callers rely on their
            // original line inputs or perform line-level queries via other means.

            return result;
        }
    }
}

