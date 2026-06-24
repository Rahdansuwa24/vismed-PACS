// import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

import {
  Video,
  Brain,
  ClipboardPlus,
  FolderHeart,
  ClipboardList,
} from "lucide-react";
import DashboardCardGrid from "./dashboard/components/DashboardCardGrid";
import DashboardFooter from "./dashboard/components/DashboardFooter";
import DashboardHero from "./dashboard/components/DashboardHero";
import DashboardNavbar from "./dashboard/components/DashboardNavbar";
// import DashboardStats from "./dashboard/components/DashboardStats";

const Dashboard = () => {
  const navigate = useNavigate();
  // const [stats, setStats] = useState({
  //   scan: 0,
  //   device: 0,
  //   ai: 0,
  // });

  // useEffect(() => {
  //   let s = 0, d = 0, a = 0;

  //   const interval = setInterval(() => {
  //     s += 30;
  //     d += 1;
  //     a += 15;

  //     if (s >= 1247) s = 1247;
  //     if (d >= 24) d = 24;
  //     if (a >= 892) a = 892;

  //     setStats({ scan: s, device: d, ai: a });

  //     if (s === 1247 && d === 24 && a === 892) {
  //       clearInterval(interval);
  //     }
  //   }, 20);

  //   return () => clearInterval(interval);
  // }, []);

  const cards = [
    // {
    //   icon: <Database className="vismedX_svg" size={28} />,
    //   title: "DICOM Modality Worklist",
    //   tag: "MWL",
    //   desc: "Manage and schedule medical imaging procedures with comprehensive worklist management",
    //   info: "125 Active Studies",
    //   path: "/modality",
    // },
    {
      icon: <ClipboardPlus className="vismedX_svg" size={28} />,
      title: "Simulasi MWL",
      tag: "DICOM .wl",
      desc: "Send patient metadata to create modality worklist simulation files",
      info: "Manual Metadata Input",
      path: "/worklist-simulator",
    },
    {
      icon: <Video className="vismedX_svg" size={28} />,
      title: "Convert Video",
      tag: "Video Processing",
      desc: "Convert and process medical imaging videos with advanced compression and format support",
      info: "42 Conversions Today",
      path: "/post-pacs",
    },
    {
      icon: <Brain className="vismedX_svg" size={28} />,
      title: "PACS AI",
      tag: "Intelligent Analysis",
      desc: "AI-powered diagnostic assistance and automated image analysis for enhanced accuracy",
      info: "98.7% Accuracy Rate",
      path: "/chat-ai",
    },
  //   {
  //   icon: <MonitorPlay className="vismedX_svg" size={28} />,
  //   title: "Study Worklist",
  //   tag: "Radiology Workspace",
  //   desc: "View and manage diagnostic imaging studies from multiple DICOM modalities in a centralized PACS workspace",
  //   info: "342 Active Examinations",
  //   path: "/dicom-worklist",
  // },
  {
    icon: <FolderHeart className="vismedX_svg" size={28} />,
    title: "Patient Examination Results",
    tag: "Patient Portal",
    desc: "Read-only patient portal for accessing radiology reports, DICOM images, and examination history securely",
    info: "Patient Access Viewer",
    path: "/patient-viewer",
  },
  {
    icon: <ClipboardList className="vismedX_svg" size={28} />,
    title: "Radiology Worklist",
    tag: "Radiology",
    desc: "Manage radiology examination worklists, imaging studies, and workflow assignments efficiently",
    info: "Radiology Worklist",
    path: "/worklist-radiology",
  },
  {
    icon: <ClipboardList className="vismedX_svg" size={28} />,
    title: "Polyclinic Worklist",
    tag: "Polyclinic",
    desc: "Manage polyclinic patient queues, clinic visits, doctors, and examination status efficiently",
    info: "Polyclinic Worklist",
    path: "/worklist-polyclinic",
  },
  {
    icon: <Activity className="vismedX_svg" size={28} />,
    title: "ECG Forwarder Monitor",
    tag: "ECG Integration",
    desc: "Monitor FTP file receipt, conversion progress, and transmission to Orthanc PACS & SIMRS",
    info: "Real-time Gateway",
    path: "/ecg-forwarder",
  },
  ];

  return (
    <div className="vismedX_container">
      <DashboardNavbar />
      <DashboardHero />
      <DashboardCardGrid cards={cards} navigate={navigate} />
      {/* <DashboardStats stats={stats} /> */}
      <DashboardFooter />
    </div>
  );
};

export default Dashboard;
