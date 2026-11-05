import { Activity, Brain, Database } from "lucide-react";

const DashboardStats = ({ stats }) => {
  return (
    <div className="vismedX_statsGrid">

      <div className="vismedX_statCard">
        <div className="vismedX_statRow">
          <div>
            <h4>Total Scans Today</h4>
            <h2>{stats.scan.toLocaleString()}</h2>
          </div>

          <div className="vismedX_statIconLarge">
            <Activity size={22} />
          </div>
        </div>

        <div className="vismedX_progress">
          <div className="vismedX_bar vismedX_bar1"></div>
        </div>

        <span className="vismedX_growth">+12%</span>
      </div>

      <div className="vismedX_statCard">
        <div className="vismedX_statRow">
          <div>
            <h4>Active Devices</h4>
            <h2>{stats.device}</h2>
          </div>

          <div className="vismedX_statIconLarge">
            <Database size={22} />
          </div>
        </div>

        <div className="vismedX_progress">
          <div className="vismedX_bar vismedX_bar2"></div>
        </div>

        <span className="vismedX_growth">100%</span>
      </div>

      <div className="vismedX_statCard">
        <div className="vismedX_statRow">
          <div>
            <h4>AI Analyses</h4>
            <h2>{stats.ai}</h2>
          </div>

          <div className="vismedX_statIconLarge">
            <Brain size={22} />
          </div>
        </div>

        <div className="vismedX_progress">
          <div className="vismedX_bar vismedX_bar3"></div>
        </div>

        <span className="vismedX_growth">+8%</span>
      </div>

    </div>
  );
};

export default DashboardStats;
