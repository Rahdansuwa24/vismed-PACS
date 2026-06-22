import { Image as ImageIcon } from "lucide-react";

const PatientViewerMainContent = ({
  patient,
  selectedSeries,
  seriesData,
  setSelectedSeries,
}) => {
  return (
    <main className="pv-main-content">
      <div className="pv-viewer-container">
        <img
          src={selectedSeries.image}
          alt=""
          className="pv-main-image"
        />
        <div className="pv-overlay">
          <div>
            <p>
              Patient:
              {patient?.patientName}
            </p>
            <p>
              Modality:
              {patient?.modality}
            </p>
          </div>
          <div>
            <p>
              Series:
              {selectedSeries.title}
            </p>
            <p>
              Images:
              {selectedSeries.images}
            </p>
          </div>
        </div>
      </div>

      <div className="pv-series-section">
        <div className="pv-series-header">
          <ImageIcon size={20} />
          <h3>
            Available Series
          </h3>
        </div>
        <div className="pv-series-grid">
          {seriesData.map((series) => (
            <div
              key={series.id}
              className={`pv-series-card ${
                selectedSeries.id ===
                series.id
                ? 'pv-series-active'
                : ''
              }`}
              onClick={() =>
                setSelectedSeries(series)
              }
            >
              <img
                src={series.image}
                alt=""
              />
              <div className="pv-series-content">
                <h4>
                  {series.title}
                </h4>
                <p>
                  {series.description}
                </p>
                <span>
                  {series.images} Images
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default PatientViewerMainContent;
