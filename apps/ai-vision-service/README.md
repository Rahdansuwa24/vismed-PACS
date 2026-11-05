# PACS ONNX Vision Service

Local CPU inference service for endoscopy frames and X-ray images.

The service is intentionally configured to return `model_not_configured`
until validated medical ONNX models and their exact preprocessing settings
are installed.

## Endpoints

- `GET /health`
- `GET /models`
- `POST /reload-models`
- `POST /analyze`

## Run manually

```bash
cd /home/pacs/servers/apps/ai-vision-service
VISION_MODEL_DIR=/home/pacs/servers/models \
  /home/pacs/servers/runtime/venvs/ai-vision-service/bin/uvicorn app_inference:app --host 127.0.0.1 --port 5000 --workers 1
```

## Analyze an image or extracted video frame

```bash
curl -X POST http://127.0.0.1:5000/analyze \
  -F domain=endoscopy \
  -F 'metadata={"modality":"ES","seriesDescription":"Endoscopy Frames"}' \
  -F files=@frame.jpg
```

For several extracted video frames, repeat the `files` field:

```bash
curl -X POST http://127.0.0.1:5000/analyze \
  -F domain=endoscopy \
  -F files=@frame-001.jpg \
  -F files=@frame-002.jpg
```

## Installing a model

1. Put the validated model at one of:

```text
/home/pacs/servers/models/endoscopy/model.onnx
/home/pacs/servers/models/xray/model.onnx
```

2. Update the corresponding JSON file in `config/` with the model's exact:

- input dimensions and channel count;
- tensor layout;
- normalization scale, mean, and standard deviation;
- output activation, confidence threshold, and labels.

3. Reload:

```bash
curl -X POST http://127.0.0.1:5000/reload-models
```

Do not use an unvalidated generic image model for medical findings. A model
must only receive images from the domain, modality, and body part it was
trained and validated for.
