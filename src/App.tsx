import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import UsersPage from "./pages/UsersPage";
import ProductsPage from "./pages/ProductsPage";
import AssignedPage from "./pages/AssignedPage";
import PredictionListsPage from "./pages/PredictionListsPage";
import PredictionListDetail from "./pages/PredictionListDetail";
import PredictionLeadsPage from "./pages/PredictionLeadsPage";
import AgentPerformancePage from "./pages/AgentPerformancePage";
import ShiftsManagementPage from "./pages/ShiftsManagementPage";
import MyShiftsPage from "./pages/MyShiftsPage";
import CallScriptsPage from "./pages/CallScriptsPage";
import CallHistoryPage from "./pages/CallHistoryPage";
import WarehousePage from "./pages/WarehousePage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetails /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
            <Route path="/assigned" element={<ProtectedRoute><AssignedPage /></ProtectedRoute>} />
            <Route path="/predictions" element={<ProtectedRoute><PredictionListsPage /></ProtectedRoute>} />
            <Route path="/predictions/:id" element={<ProtectedRoute><PredictionListDetail /></ProtectedRoute>} />
            <Route path="/prediction-leads" element={<ProtectedRoute><PredictionLeadsPage /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><AgentPerformancePage /></ProtectedRoute>} />
            <Route path="/shifts" element={<ProtectedRoute><ShiftsManagementPage /></ProtectedRoute>} />
            <Route path="/my-shifts" element={<ProtectedRoute><MyShiftsPage /></ProtectedRoute>} />
            <Route path="/call-scripts" element={<ProtectedRoute><CallScriptsPage /></ProtectedRoute>} />
            <Route path="/call-history" element={<ProtectedRoute><CallHistoryPage /></ProtectedRoute>} />
            <Route path="/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
