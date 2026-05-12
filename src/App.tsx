import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AppContext, type ConnectionState, initialConnectionState } from "@/lib/store";
import Connect from "./pages/Connect";
import Overview from "./pages/Overview";
import Cardinality from "./pages/Cardinality";
import Churn from "./pages/Churn";
import Exported from "./pages/Exported";
import Histograms from "./pages/Histograms";
import Labels from "./pages/Labels";
import Scrapes from "./pages/Scrapes";
import Simulate from "./pages/Simulate";
import Recommendations from "./pages/Recommendations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [connection, setConnection] = useState<ConnectionState>(initialConnectionState);

  const disconnect = () => {
    setConnection(initialConnectionState);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContext.Provider value={{ connection, setConnection, disconnect }}>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Connect />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/cardinality" element={<Cardinality />} />
                <Route path="/churn" element={<Churn />} />
                <Route path="/histograms" element={<Histograms />} />
                <Route path="/labels" element={<Labels />} />
                <Route path="/scrapes" element={<Scrapes />} />
                <Route path="/exported" element={<Exported />} />
                <Route path="/simulate" element={<Simulate />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </AppContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
