import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import CreditHub from "./pages/CreditHub";
import NotFound from "./pages/NotFound";
import { persistReferralCodeFromUrl } from "@/lib/creditHubAuth";

const queryClient = new QueryClient();

const GlobalReferralTracker = () => {
  const location = useLocation();

  useEffect(() => {
    persistReferralCodeFromUrl(location.search);
  }, [location.search]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <GlobalReferralTracker />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/credit-hub" element={<CreditHub />} />
          <Route path="/credit-hub/auth/callback" element={<CreditHub />} />
          <Route path="/credit-hub/payment/result" element={<CreditHub />} />
          <Route path="/payment/result" element={<CreditHub />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
