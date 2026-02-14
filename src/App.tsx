import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import UsersPage from "./pages/UsersPage";
import ProductsPage from "./pages/ProductsPage";
import AssignedPage from "./pages/AssignedPage";
import PredictionListsPage from "./pages/PredictionListsPage";
import PredictionListDetail from "./pages/PredictionListDetail";
import PredictionLeadsPage from "./pages/PredictionLeadsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/assigned" element={<AssignedPage />} />
          <Route path="/predictions" element={<PredictionListsPage />} />
          <Route path="/predictions/:id" element={<PredictionListDetail />} />
          <Route path="/prediction-leads" element={<PredictionLeadsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
