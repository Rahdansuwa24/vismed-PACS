import { ArrowRight } from "lucide-react";

const DashboardCardGrid = ({ cards, navigate }) => {
  return (
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

            <div
              className="vismedX_launch"
              onClick={() => navigate(item.path)}
              style={{ cursor: "pointer" }}
            >
              Launch <ArrowRight size={14} />
            </div>
          </div>

          <div className="vismedX_bottomLine"></div>
        </div>
      ))}
    </div>
  );
};

export default DashboardCardGrid;
