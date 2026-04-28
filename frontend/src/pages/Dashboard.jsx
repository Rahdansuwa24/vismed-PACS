import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import logo from "../assets/vismed-logo.png";

import {
  Database,
  Video,
  Brain,
  Activity,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    scan: 0,
    device: 0,
    ai: 0,
  });

  useEffect(() => {
    let s = 0, d = 0, a = 0;

    const interval = setInterval(() => {
      s += 30;
      d += 1;
      a += 15;

      if (s >= 1247) s = 1247;
      if (d >= 24) d = 24;
      if (a >= 892) a = 892;

      setStats({ scan: s, device: d, ai: a });

      if (s === 1247 && d === 24 && a === 892) {
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      icon: <Database className="vismedX_svg" size={28} />,
      title: "DICOM Modality Worklist",
      tag: "MWL",
      desc: "Manage and schedule medical imaging procedures with comprehensive worklist management",
      info: "125 Active Studies",
    },
    {
      icon: <Video className="vismedX_svg" size={28} />,
      title: "Convert Video",
      tag: "Video Processing",
      desc: "Convert and process medical imaging videos with advanced compression and format support",
      info: "42 Conversions Today",
    },
    {
      icon: <Brain className="vismedX_svg" size={28} />,
      title: "PACS AI",
      tag: "Intelligent Analysis",
      desc: "AI-powered diagnostic assistance and automated image analysis for enhanced accuracy",
      info: "98.7% Accuracy Rate",
    },
  ];

  return (
    <div className="vismedX_container">

      {/* NAVBAR */}
      <div className="vismedX_navbar">
        <div className="vismedX_logoBox">
          <img src={logo} alt="logo" className="vismedX_logoImg" />
          <div>
            <h2>VisMed</h2>
            <p>Medical Imaging Platform</p>
          </div>
        </div>

        <div className="vismedX_status">
          <span className="vismedX_dot"></span>
          System Active
        </div>
      </div>

      {/* HERO */}
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

      {/* CARDS */}
      <div className="vismedX_cardGrid">
        {cards.map((item, i) => (
          <div key={i} className="vismedX_card">

            <div className="vismedX_iconBox">
              {item.icon}
            </div>

            <h3 className="vismedX_title">{item.title}</h3>
            <span className="vismedX_sub">{item.tag}</span>

            <p className="vismedX_desc">{item.desc}</p>

            <div className="vismedX_cardFooter">
              <div className="vismedX_tag">{item.info}</div>

              <div className="vismedX_launch">
                Launch <ArrowRight size={14} />
              </div>
            </div>

            <div className="vismedX_bottomLine"></div>
          </div>
        ))}
      </div>

      {/* STATS */}
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

      {/* FOOTER */}
      <div className="vismedX_footer">
        VisMed © 2026 - Advanced Medical Imaging Platform
      </div>

    </div>
  );
};

export default Dashboard;