import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Discover } from "./pages/Discover";
import { Saved } from "./pages/Saved";
import { Settings } from "./pages/Settings";
import { Identity } from "./pages/Identity";
import { AuthGuard } from "./components/AuthGuard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/identity" element={<Identity />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
