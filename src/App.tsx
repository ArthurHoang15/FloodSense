import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Intelligence from "@/pages/Intelligence";
import RouteResults from "@/pages/RouteResults";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/route-results" element={<RouteResults />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
