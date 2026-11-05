const ConvertVideoViewer = ({ currentPatient, currentVideo }) => {
  return (
    <main className="misv-viewer-wrapper">
      <div className="misv-viewer">
        {currentPatient?.videos.length > 0 && (
          <video
            src={URL.createObjectURL(
              currentPatient.videos[currentVideo]
            )}
            className="misv-image"
            controls
            autoPlay
          />
        )}

        {currentPatient &&
          currentPatient.videos.length === 0 && (
            <div>No Data</div>
          )}
      </div>
    </main>
  );
};

export default ConvertVideoViewer;
