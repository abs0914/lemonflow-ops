import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BomManager from "./pages/BomManager";
import Production from "./pages/Production";
import ProductionCreate from "./pages/ProductionCreate";
import Labels from "./pages/Labels";
import Warehouse from "./pages/Warehouse";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import Purchasing from "./pages/Purchasing";
import PurchasingCreate from "./pages/PurchasingCreate";
import PurchasingEdit from "./pages/PurchasingEdit";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import NotFound from "./pages/NotFound";

// Create QueryClient instance outside component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bom" element={<BomManager />} />
            <Route path="/production" element={<Production />} />
            <Route path="/production/create" element={<ProductionCreate />} />
            <Route path="/labels" element={<Labels />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/purchasing" element={<Purchasing />} />
          <Route path="/purchasing/create" element={<PurchasingCreate />} />
          <Route path="/purchasing/:id" element={<PurchaseOrderDetail />} />
          <Route path="/purchasing/:id/edit" element={<PurchasingEdit />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
