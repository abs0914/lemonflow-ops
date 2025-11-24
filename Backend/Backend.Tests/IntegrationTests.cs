using System;
using System.Configuration;
using NUnit.Framework;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Tests
{
    /// <summary>
    /// Integration tests for AutoCount operations.
    /// 
    /// These tests perform actual round-trip operations against a test AutoCount account book.
    /// They are gated behind configuration flags and should only run in a test environment.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    /// 
    /// IMPORTANT: These tests require:
    /// 1. A test AutoCount account book configured and accessible
    /// 2. Valid SQL Server and AutoCount credentials in app.config
    /// 3. Test data setup and cleanup procedures
    /// </summary>
    [TestFixture]
    public class IntegrationTests
    {
        private IAutoCountSessionProvider _sessionProvider;
        private IAutoCountDebtorService _debtorService;
        private IAutoCountSalesInvoiceService _invoiceService;

        private const string TEST_DEBTOR_CODE = "TEST-DEBTOR-001";
        private const string TEST_INVOICE_NO = "TEST-INV-001";

        [OneTimeSetUp]
        public void OneTimeSetUp()
        {
            // Check if integration tests are enabled
            var enableIntegrationTests = ConfigurationManager.AppSettings["EnableIntegrationTests"];
            if (enableIntegrationTests != "true")
            {
                Assert.Ignore("Integration tests are disabled. Set EnableIntegrationTests=true in app.config to enable.");
            }

            // Initialize AutoCount session
            try
            {
                var config = AutoCountConnectionConfig.LoadFromConfig();
                config.Validate();

                _sessionProvider = AutoCountSessionProvider.Instance as AutoCountSessionProvider;
                if (_sessionProvider != null)
                {
                    (_sessionProvider as AutoCountSessionProvider)?.Initialize(config);
                }

                _debtorService = new AutoCountDebtorService(_sessionProvider);
                _invoiceService = new AutoCountSalesInvoiceService(_sessionProvider);
            }
            catch (Exception ex)
            {
                Assert.Fail($"Failed to initialize AutoCount session for integration tests: {ex.Message}");
            }
        }

        [OneTimeTearDown]
        public void OneTimeTearDown()
        {
            // Cleanup test data
            try
            {
                CleanupTestData();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Failed to cleanup test data: {ex.Message}");
            }
        }

        [Test]
        [Category("Integration")]
        public void CreateAndRetrieveDebtor_RoundTrip()
        {
            // Arrange
            var testDebtor = new Debtor
            {
                Code = TEST_DEBTOR_CODE,
                Name = "Integration Test Debtor",
                ContactPerson = "Test Contact",
                Email = "test@example.com",
                Phone = "555-0123",
                Address1 = "123 Test Street",
                City = "Test City",
                State = "TS",
                PostalCode = "12345",
                Country = "Test Country",
                CurrencyCode = "USD",
                IsActive = true
            };

            try
            {
                // Act - Create
                var createdDebtor = _debtorService.CreateDebtor(testDebtor);

                // Assert - Created
                Assert.IsNotNull(createdDebtor);
                Assert.AreEqual(TEST_DEBTOR_CODE, createdDebtor.Code);
                Assert.AreEqual("Integration Test Debtor", createdDebtor.Name);

                // Act - Retrieve
                var retrievedDebtor = _debtorService.GetDebtorByCode(TEST_DEBTOR_CODE);

                // Assert - Retrieved
                Assert.IsNotNull(retrievedDebtor);
                Assert.AreEqual(TEST_DEBTOR_CODE, retrievedDebtor.Code);
                Assert.AreEqual("Integration Test Debtor", retrievedDebtor.Name);
            }
            finally
            {
                // Cleanup
                try
                {
                    _debtorService.DeleteDebtor(TEST_DEBTOR_CODE);
                }
                catch { }
            }
        }

        [Test]
        [Category("Integration")]
        public void CreateAndRetrieveSalesInvoice_RoundTrip()
        {
            // Arrange
            var testInvoice = new SalesInvoice
            {
                DocumentNo = TEST_INVOICE_NO,
                DebtorCode = TEST_DEBTOR_CODE,
                InvoiceDate = DateTime.Now,
                DueDate = DateTime.Now.AddDays(30),
                CurrencyCode = "USD",
                Lines = new System.Collections.Generic.List<SalesInvoiceLine>
                {
                    new SalesInvoiceLine
                    {
                        LineNo = 1,
                        ItemCode = "ITEM-001",
                        Description = "Test Item",
                        Quantity = 1,
                        UnitOfMeasure = "PCS",
                        UnitPrice = 100m,
                        TaxCode = "SR"
                    }
                }
            };

            try
            {
                // Act - Create
                var createdInvoice = _invoiceService.CreateSalesInvoice(testInvoice);

                // Assert - Created
                Assert.IsNotNull(createdInvoice);
                Assert.AreEqual(TEST_INVOICE_NO, createdInvoice.DocumentNo);

                // Act - Retrieve
                var retrievedInvoice = _invoiceService.GetSalesInvoiceByDocumentNo(TEST_INVOICE_NO);

                // Assert - Retrieved
                Assert.IsNotNull(retrievedInvoice);
                Assert.AreEqual(TEST_INVOICE_NO, retrievedInvoice.DocumentNo);
            }
            finally
            {
                // Cleanup
                try
                {
                    // Note: Deletion logic depends on AutoCount's API
                }
                catch { }
            }
        }

        private void CleanupTestData()
        {
            // Remove test debtor
            try
            {
                if (_debtorService.DebtorExists(TEST_DEBTOR_CODE))
                {
                    _debtorService.DeleteDebtor(TEST_DEBTOR_CODE);
                }
            }
            catch { }

            // Remove test invoice
            try
            {
                if (_invoiceService.SalesInvoiceExists(TEST_INVOICE_NO))
                {
                    // Note: Implement deletion based on AutoCount API
                }
            }
            catch { }
        }
    }
}

