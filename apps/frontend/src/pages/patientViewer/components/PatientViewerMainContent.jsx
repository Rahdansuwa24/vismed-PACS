import { Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

const PatientViewerMainContent = ({
  patient,
  selectedSeries,
  seriesData,
  setSelectedSeries,
  currentInstanceIndex,
  setCurrentInstanceIndex
}) => {
  const hasInstances = selectedSeries?.instances && selectedSeries.instances.length > 0;
  const numInstances = selectedSeries?.instances ? selectedSeries.instances.length : 0;

  // Active image source
  const activeImageSrc = hasInstances 
    ? `data:image/png;base64,${selectedSeries.instances[currentInstanceIndex]?.imagePngBase64}` 
    : selectedSeries?.image;

  const nextSlice = (e) => {
    e.stopPropagation();
    if (numInstances > 1) {
      setCurrentInstanceIndex((prev) => (prev < numInstances - 1 ? prev + 1 : 0));
    }
  };

  const prevSlice = (e) => {
    e.stopPropagation();
    if (numInstances > 1) {
      setCurrentInstanceIndex((prev) => (prev > 0 ? prev - 1 : numInstances - 1));
    }
  };

  return (
    <main className="pv-main-content">
      <div className="pv-viewer-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#090d16', minHeight: '55vh' }}>
        {/* Main image viewer */}
        <img
          src={activeImageSrc}
          alt=""
          className="pv-main-image"
          style={{ objectFit: 'contain', maxHeight: '70vh', width: '100%', height: 'auto', display: 'block' }}
        />

        {/* Slice Navigation Overlay Arrows */}
        {numInstances > 1 && (
          <>
            <button className="pv-nav-arrow left" onClick={prevSlice} aria-label="Previous slice">
              <ChevronLeft size={24} />
            </button>
            <button className="pv-nav-arrow right" onClick={nextSlice} aria-label="Next slice">
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Bottom range slider for navigating instances */}
        {numInstances > 1 && (
          <div className="pv-instance-slider">
            <input
              type="range"
              min="0"
              max={numInstances - 1}
              value={currentInstanceIndex}
              onChange={(e) => setCurrentInstanceIndex(parseInt(e.target.value, 10))}
              className="pv-slider-input"
            />
            <span className="pv-slider-label">
              Slice {currentInstanceIndex + 1} of {numInstances}
            </span>
          </div>
        )}

        {/* Metadata HUD Overlay */}
        <div className="pv-overlay">
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>
              Patient: {patient?.patientName}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Modality: {patient?.modality}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>
              Series: {selectedSeries?.title}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Images: {hasInstances ? numInstances : selectedSeries?.images}
            </p>
          </div>
        </div>
      </div>

      {/* Series Grid */}
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
                selectedSeries?.id === series.id
                ? 'pv-series-active'
                : ''
              }`}
              onClick={() => setSelectedSeries(series)}
            >
              <img
                src={series.image}
                alt=""
                style={{ objectFit: 'cover' }}
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
