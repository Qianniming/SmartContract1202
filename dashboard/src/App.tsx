import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Deploy from "@/pages/Deploy";
import Overview from "@/pages/Overview";
import Assets from "@/pages/Assets";
import Security from "@/pages/Security";
import History from "@/pages/History";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/security" element={<Security />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}
