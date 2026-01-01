# Homey Face Recognition Server

A complete face recognition system for Homey home automation, designed to work with Ring cameras. The system consists of a FastAPI backend server and a React frontend for management. The server receives images via POST requests from Homey's Image Token system.

## Features

- **Face Recognition**: Uses the `face_recognition` library to identify known faces
- **Unknown Face Tracking**: Automatically saves unknown faces for later review and naming
- **Web Interface**: React-based UI for managing known faces and reviewing unknown faces
- **Homey Integration**: Compatible with Homey Image Token POST requests (works with apps like com.svipler.athom.imageposter)
- **Ring Camera Support**: Designed to work with Ring camera images via Homey flows

## Architecture

```
Ring Camera → Homey Flow → Image Token App → FastAPI Server → Face Recognition
                                                                    ↓
                                                              Known/Unknown?
                                                                    ↓
                                                              JSON Response
                                                                    ↓
                                                              Parse in Homey Flow
                                                                    ↓
                                                              Trigger Door Action
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

Or using uvicorn directly:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
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

### Homey Integration

This server is designed to work with Homey's Image Token system. You can use any Homey app that supports posting Image Tokens to a web server (such as `com.svipler.athom.imageposter`).

1. Install an Image Token posting app on your Homey (e.g., `com.svipler.athom.imageposter`)

2. Create a flow in Homey:
   - Trigger: Ring camera motion/detection
   - Action: Send Image Token to URL
   - URL: `http://your-server-ip:8000/api/recognize`
   - The image will be posted with the field name "image" (Homey Image Token standard)

3. The server will recognize the face and return a JSON response with `known_person` and `name_person` fields

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

### Homey Flow Setup

1. Create a flow in Homey that triggers on Ring camera motion/detection
2. Add the "Send Image Token" action from your Image Token posting app
3. Set the URL to: `http://your-server-ip:8000/api/recognize`
4. Connect the image from Ring to the action
5. The server will process the image and return JSON with `known_person` and `name_person`
6. Use a webhook or HTTP response parser to extract the results and trigger actions:
   - If `known_person` is true, you can unlock the door
   - Use `name_person` to log who was detected

Example flow:
```
Ring Motion Detected
  → Send Image Token to http://your-server:8000/api/recognize
  → Parse HTTP Response
  → If known_person = true
    → Unlock Door
    → Send Notification: "Welcome home, {name_person}!"
```

**Note**: The server accepts POST requests with form data where the image field is named "image" (Homey Image Token standard).

## API Endpoints

### `POST /api/recognize`
Recognize a face in an uploaded image. Compatible with Homey Image Token POST requests.

**Request**: Multipart form data with `image` field containing the image (Homey Image Token standard)
**Response**:
```json
{
  "known_person": true,
  "name_person": "John Doe"
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

### Homey Integration Issues

- Verify the server URL is correct and accessible from your Homey device
- Check that the FastAPI server is running and accessible
- Ensure firewall rules allow connections on port 8000
- Verify that the Image Token posting app is configured to send to `/api/recognize` endpoint
- Make sure the image field name is "image" (standard for Homey Image Tokens)

## License

MIT

## Acknowledgments

- Uses [face_recognition](https://github.com/ageitgey/face_recognition) library by Adam Geitgey
- Built with FastAPI and React
- Compatible with Homey Image Token system

