import { Sparkles } from "lucide-react";

const DashboardHero = () => {
  return (
    <div className="vismedX_hero">
      <div className="vismedX_badge">
        <Sparkles size={16} className="vismedX_badgeIcon" />
        Welcome to VisMed Dashboard
      </div>

      <h1>Professional Medical Imaging Solutions</h1>
      <p>
        Advanced diagnostic tools and AI-powered analysis for modern healthcare facilities
      </p>
    </div>
  );
};

export default DashboardHero;
