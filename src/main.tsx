import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// Lazy load the main App component
const App = lazy(() => import("./App.tsx"));

// Loading component
const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading Map Viewer...</p>
    </div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<Loading />}>
    <App />
  </Suspense>
);
