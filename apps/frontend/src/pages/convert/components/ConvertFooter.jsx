const ConvertFooter = ({
  currentPatient,
  currentVideo,
  handleUpload,
  handleSave,
  next,
  prev,
}) => {
  return (
    <footer className="misv-footer">
      <div className="misv-viewer-controls">
        <button className="misv-nav-btn" onClick={prev}>
          Previous
        </button>

        <span className="misv-img-count">
          Video {currentPatient ? currentVideo + 1 : 0} /{" "}
          {currentPatient ? currentPatient.videos.length : 0}
        </span>

        <button className="misv-nav-btn" onClick={next}>
          Next
        </button>
      </div>

      <label className="misv-upload-btn">
        Upload
        <input
          type="file"
          accept="video/*"
          onChange={(e) => handleUpload(e)}
          hidden
        />
      </label>

      <button className="misv-save-btn" onClick={handleSave}>
        Save to Patient Record
      </button>
    </footer>
  );
};

export default ConvertFooter;
