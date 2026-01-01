# Face Recognition Server

A complete face recognition system with web interface for managing known faces and detecting unknown visitors. The system consists of a FastAPI backend server and a React frontend for management. The server receives images via POST requests and can trigger webhooks when known faces are recognized.

## Features

- **Face Recognition**: Uses the `face_recognition` library to identify known faces
- **Unknown Face Tracking**: Automatically saves unknown faces for later review and naming
- **Web Interface**: React-based UI for managing known faces and reviewing unknown faces
- **Webhook Integration**: Configure webhook URLs to trigger actions when known faces are recognized
- **Recognition History**: View complete history of all face recognition events with images

## Architecture

```
Camera/System → POST Image → FastAPI Server → Face Recognition
                                              ↓
                                        Known/Unknown?
                                              ↓
                                        JSON Response
                                              ↓
                                        Webhook (if configured)
```

## Installation

### Backend Server

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

**Note**: The `dlib` and `face_recognition` libraries may require additional system dependencies. On macOS, you may need:
```bash
brew install cmake
```

On Linux (Ubuntu/Debian):
```bash
sudo apt-get install build-essential cmake libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev
```

4. Run the server:
```bash
python -m app.main
```

The server will automatically reload when you make changes to Python files (auto-reload enabled).

Or using uvicorn directly:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at `http://localhost:8000`

### Frontend

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Build the React app:
```bash
npm run build
```

This will build the frontend and place it in `backend/static/` for the FastAPI server to serve.

4. For development, you can run the dev server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` (Vite default port) with API proxying to the backend.

### API Integration

This server accepts POST requests with images for face recognition. The image should be sent as multipart form data with the field name "image".

1. Send a POST request to `http://your-server-ip:8000/api/recognize` with an image file
2. The server will process the image and return a JSON response with recognition results
3. If a webhook URL is configured in Settings, a GET request will be sent when a known face is recognized

## Configuration

### Backend

The backend server runs on port 8000 by default. You can change this in `backend/app/main.py` or by setting environment variables.

Face recognition tolerance is set to 0.75 (loose) by default. You can adjust this in `backend/app/main.py`:
```python
face_service = FaceRecognitionService(storage, tolerance=0.75)
```

Lower values (e.g., 0.5) = more strict matching
Higher values (e.g., 0.8) = more lenient matching

## Usage

### Adding Known Faces

1. Open the web interface at `http://your-server:8000`
2. Click "Add Person" in the Known Faces tab
3. Enter the person's name and upload an image containing their face
4. The system will extract and save the face encoding

### Reviewing Unknown Faces

1. When an unknown face is detected, it's automatically saved
2. Go to the "Unknown Faces" tab in the web interface
3. Review the detected faces
4. Enter a name and click "Name" to add them to known faces
5. Or click "Delete" to remove unwanted detections

### Webhook Configuration

1. Open the web interface and navigate to the Settings tab
2. Enter a webhook URL (e.g., `https://your-automation-system.com/webhook`)
3. Enable the webhook toggle
4. Save the settings

When a known face is recognized, the server will send a GET request to your webhook URL with query parameters:
- `known_person=true`
- `name_persons=John,Doe` (comma-separated list of recognized names)
- `total_faces=2` (number of faces detected)
- `event_id=recognition_20260101_123456` (unique event identifier)

**Note**: The server accepts POST requests with form data where the image field is named "image".

## API Endpoints

### `POST /api/recognize`
Recognize faces in an uploaded image.

**Request**: Multipart form data with `image` field containing the image file
**Response**:
```json
{
  "known_person": true,
  "name_persons": ["John Doe", "Jane Doe"]
}
```

### `GET /api/known-faces`
Get list of all known people.

**Response**:
```json
[
  {
    "name": "John Doe",
    "image_count": 3
  }
]
```

### `POST /api/known-faces`
Add a new known person.

**Request**: Multipart form data with `name` (query parameter or form field) and `image` (file field)

### `DELETE /api/known-faces/{name}`
Delete a known person and all their faces.

### `GET /api/unknown-faces`
Get list of all unknown faces.

### `POST /api/unknown-faces/{face_id}/name`
Name an unknown face (move it to known faces).

**Request**: JSON body with `name` field

### `DELETE /api/unknown-faces/{face_id}`
Delete an unknown face.

### `GET /api/settings`
Get current server settings (webhook URL and enabled status).

### `POST /api/settings`
Update server settings.

**Request**: JSON body with `webhook_url` (string) and `webhook_enabled` (boolean)

## File Structure

Faces are stored in the `backend/faces/` directory:
- `known/{name}/` - Contains face encodings and images for each known person
- `unknown/{face_id}/` - Contains images and metadata for unknown faces

## Troubleshooting

### dlib Installation Issues

If you encounter issues installing `dlib`, try:
- On macOS: Ensure Xcode command line tools are installed
- On Linux: Install the required system dependencies (see Installation section)
- Consider using a pre-built wheel or Docker image

### Face Recognition Not Working

- Ensure images contain clear, front-facing faces
- Check that the tolerance setting is appropriate for your use case
- Verify that face encodings are being saved correctly in the `faces/known/` directory

### API Integration Issues

- Verify the server URL is correct and accessible from your client
- Check that the FastAPI server is running and accessible
- Ensure firewall rules allow connections on port 8000
- Verify that POST requests are sent to `/api/recognize` endpoint
- Make sure the image field name is "image" in the multipart form data
- Check webhook URL is valid and accessible if webhooks are enabled

## License

MIT

## Acknowledgments

- Uses [face_recognition](https://github.com/ageitgey/face_recognition) library by Adam Geitgey
- Built with FastAPI and React

