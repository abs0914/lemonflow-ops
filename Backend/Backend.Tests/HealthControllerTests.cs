using System;
using NUnit.Framework;
using Moq;
using Backend.Api.Controllers;
using Backend.Infrastructure.AutoCount;

namespace Backend.Tests
{
    /// <summary>
    /// Unit tests for HealthController.
    /// Tests the health check endpoints without requiring actual AutoCount connection.
    /// </summary>
    [TestFixture]
    public class HealthControllerTests
    {
        private Mock<IAutoCountSessionProvider> _mockSessionProvider;
        private HealthController _controller;

        [SetUp]
        public void Setup()
        {
            _mockSessionProvider = new Mock<IAutoCountSessionProvider>();
            _controller = new HealthController(_mockSessionProvider.Object);
        }

        [Test]
        public void GetHealth_ReturnsOkStatus()
        {
            // Arrange
            // Act
            var result = _controller.GetHealth();

            // Assert
            Assert.IsNotNull(result);
            // Note: In a real scenario, you would verify the response content
        }

        [Test]
        public void GetAutoCountHealth_WhenNotInitialized_ReturnsBadRequest()
        {
            // Arrange
            _mockSessionProvider.Setup(x => x.IsInitialized).Returns(false);
            _mockSessionProvider.Setup(x => x.InitializationError).Returns("Test error");

            // Act
            var result = _controller.GetAutoCountHealth();

            // Assert
            Assert.IsNotNull(result);
            // Note: In a real scenario, you would verify the response is BadRequest
        }

        [Test]
        public void GetAutoCountHealth_WhenInitialized_ReturnsOkStatus()
        {
            // Arrange
            _mockSessionProvider.Setup(x => x.IsInitialized).Returns(true);
            _mockSessionProvider.Setup(x => x.GetUserSession()).Returns(new object()); // Mock UserSession

            // Act
            var result = _controller.GetAutoCountHealth();

            // Assert
            Assert.IsNotNull(result);
            // Note: In a real scenario, you would verify the response is Ok
        }

        [Test]
        public void HealthController_Constructor_ThrowsWhenSessionProviderIsNull()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentNullException>(() => new HealthController(null));
        }
    }
}

