import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./Layout.js";
import { Overview } from "./pages/Overview.js";
import { Keywords } from "./pages/Keywords.js";
import { RankTracker } from "./pages/RankTracker.js";
import { Audit } from "./pages/Audit.js";
import { Competitors } from "./pages/Competitors.js";
import { Backlinks } from "./pages/Backlinks.js";
import { Strategy } from "./pages/Strategy.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/keywords" element={<Keywords />} />
          <Route path="/rank-tracker" element={<RankTracker />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/backlinks" element={<Backlinks />} />
          <Route path="/strategy" element={<Strategy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
