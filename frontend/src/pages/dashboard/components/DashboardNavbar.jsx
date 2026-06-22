import logo from "../../../assets/vismed-logo.png";

const DashboardNavbar = () => {
  return (
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
  );
};

export default DashboardNavbar;
