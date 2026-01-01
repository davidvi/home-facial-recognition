from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging
from typing import List
import httpx

from .models import RecognizeResponse, RecognizeAllResponse, SimpleRecognizeResponse, FaceResult, KnownFace, UnknownFace, NameFaceRequest, Settings
from .face_service import FaceRecognitionService
from .storage import FaceStorage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Face Recognition Server")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
storage = FaceStorage()
face_service = FaceRecognitionService(storage, tolerance=0.75)

# Static files directory (will be created when React is built)
static_dir = Path(__file__).parent.parent / "static"
static_dir.mkdir(exist_ok=True)  # Create directory if it doesn't exist


@app.post("/api/recognize", response_model=SimpleRecognizeResponse)
async def recognize_face(image: UploadFile = File(..., alias="image")):
    """Recognize all faces in the uploaded image. Returns simplified format for API integration.
    Accepts form POST with field name 'image'."""
    try:
        logger.info(f"Received face recognition request: filename={image.filename}, content_type={image.content_type}")
        image_data = await image.read()
        logger.info(f"Image size: {len(image_data)} bytes")
        
        result = face_service.recognize_all_faces(image_data)
        
        logger.info(f"Face recognition result: total_faces={result['total_faces']}, event_id={result.get('event_id')}")
        
        # Extract unique names from recognized faces
        recognized_names = set()
        for face in result['faces']:
            if face['known_person'] and face['name_person']:
                recognized_names.add(face['name_person'])
        
        known_person = len(recognized_names) > 0
        name_persons = sorted(list(recognized_names))  # Sort for consistency
        
        logger.info(f"Simplified response: known_person={known_person}, name_persons={name_persons}")
        
        # Trigger webhook if enabled and known person detected
        if known_person:
            try:
                settings = storage.load_settings()
                if settings.get("webhook_enabled") and settings.get("webhook_url"):
                    webhook_url = settings["webhook_url"].strip()
                    if webhook_url:
                        # Build query parameters - only send tag with comma-separated names
                        params = {
                            "tag": ",".join(name_persons)
                        }
                        
                        # Make async GET request (non-blocking)
                        async with httpx.AsyncClient(timeout=5.0) as client:
                            try:
                                response = await client.get(webhook_url, params=params)
                                logger.info(f"Webhook called successfully: url={webhook_url}, status={response.status_code}")
                            except Exception as webhook_error:
                                logger.warning(f"Webhook call failed (non-blocking): url={webhook_url}, error={str(webhook_error)}")
            except Exception as webhook_exception:
                # Don't fail the recognition request if webhook fails
                logger.warning(f"Error processing webhook (non-blocking): {str(webhook_exception)}")
        
        return SimpleRecognizeResponse(
            known_person=known_person,
            name_persons=name_persons
        )
    except Exception as e:
        logger.exception(f"Error processing image for recognition: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.get("/api/known-faces", response_model=List[KnownFace])
async def get_known_faces():
    """Get list of all known people."""
    logger.info("Getting list of known faces")
    faces = storage.get_known_faces()
    logger.info(f"Found {len(faces)} known faces")
    return [KnownFace(name=f["name"], image_count=f["image_count"]) for f in faces]


@app.get("/api/known-faces/{name}/images")
async def get_known_face_images(name: str):
    """Get list of all face images for a known person."""
    logger.info(f"Getting face images for: name={name}")
    images = storage.get_known_face_images(name)
    logger.info(f"Found {len(images)} images for name={name}")
    return images


@app.get("/api/known-faces/{name}/image/{filename}")
async def get_known_face_image(name: str, filename: str):
    """Get a specific face image for a known person."""
    person_dir = storage.known_path / name
    image_file = person_dir / filename
    
    if not image_file.exists() or not image_file.is_file():
        logger.warning(f"get_known_face_image: Image not found - name={name}, filename={filename}")
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Security check: ensure the file is within the person's directory
    try:
        image_file.resolve().relative_to(person_dir.resolve())
    except ValueError:
        logger.error(f"get_known_face_image: Security violation - attempted path traversal - name={name}, filename={filename}")
        raise HTTPException(status_code=403, detail="Invalid filename")
    
    return FileResponse(image_file, media_type="image/jpeg")


@app.delete("/api/known-faces/{name}/image/{filename}")
async def delete_known_face_image(name: str, filename: str):
    """Delete a specific face image for a known person."""
    logger.info(f"Deleting face image: name={name}, filename={filename}")
    try:
        success = storage.delete_known_face_image(name, filename)
        if not success:
            raise HTTPException(status_code=404, detail="Image not found")
        
        face_service.invalidate_cache()
        logger.info(f"Successfully deleted face image: name={name}, filename={filename}")
        return {"message": "Face image deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting face image: name={name}, filename={filename}, error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting face image: {str(e)}")


@app.post("/api/known-faces")
async def add_known_face(name: str, image: UploadFile = File(..., alias="image")):
    """Add a new known person with their face image."""
    if not name or not name.strip():
        logger.warning(f"add_known_face failed: Empty name provided")
        raise HTTPException(status_code=400, detail="Name is required")
    
    name = name.strip()
    logger.info(f"Adding known face: name={name}, filename={image.filename}")
    
    try:
        image_data = await image.read()
        logger.info(f"Image size: {len(image_data)} bytes")
        
        success = storage.save_known_face(name, image_data)
        
        if not success:
            logger.error(f"add_known_face failed: No face found in image - name={name}")
            raise HTTPException(status_code=400, detail="No face found in image")
        
        face_service.invalidate_cache()
        logger.info(f"Successfully added known face: name={name}")
        return {"message": "Face added successfully", "name": name}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error adding known face: name={name}, error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Error adding face: {str(e)}")


@app.delete("/api/known-faces/{name}")
async def delete_known_face(name: str):
    """Delete a known person."""
    try:
        success = storage.delete_known_face(name)
        if not success:
            raise HTTPException(status_code=404, detail="Person not found")
        
        face_service.invalidate_cache()
        return {"message": "Person deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting person: {str(e)}")


@app.get("/api/unknown-faces", response_model=List[UnknownFace])
async def get_unknown_faces():
    """Get list of all unknown faces."""
    faces = storage.get_unknown_faces()
    return [UnknownFace(**f) for f in faces]


@app.get("/api/unknown-faces/{face_id}/image")
async def get_unknown_face_image(face_id: str):
    """Get the full image for an unknown face."""
    image_path = storage.get_unknown_face_image_path(face_id)
    
    if not image_path:
        logger.warning(f"get_unknown_face_image: Face not found - face_id={face_id}")
        raise HTTPException(status_code=404, detail="Face not found")
    
    return FileResponse(image_path, media_type="image/jpeg")


@app.get("/api/unknown-faces/{face_id}/face")
async def get_unknown_face_face(face_id: str):
    """Get the cropped face image for an unknown face."""
    face_path = storage.get_unknown_face_face_path(face_id)
    
    if not face_path:
        logger.warning(f"get_unknown_face_face: Cropped face not found, trying full image - face_id={face_id}")
        # Fallback to full image if cropped face doesn't exist
        image_path = storage.get_unknown_face_image_path(face_id)
        if not image_path:
            raise HTTPException(status_code=404, detail="Face not found")
        return FileResponse(image_path, media_type="image/jpeg")
    
    return FileResponse(face_path, media_type="image/jpeg")


@app.post("/api/unknown-faces/{face_id}/name")
async def name_unknown_face(face_id: str, request: NameFaceRequest):
    """Name an unknown face (move it to known faces)."""
    if not request.name or not request.name.strip():
        logger.warning(f"name_unknown_face failed: Empty name provided for face_id={face_id}")
        raise HTTPException(status_code=400, detail="Name is required")
    
    name = request.name.strip()
    logger.info(f"Attempting to name unknown face: face_id={face_id}, name={name}")
    
    try:
        success = storage.name_unknown_face(face_id, name)
        if not success:
            logger.error(f"Failed to name unknown face: face_id={face_id}, name={name} - storage.name_unknown_face returned False")
            raise HTTPException(status_code=404, detail="Face not found or could not be processed")
        
        face_service.invalidate_cache()
        logger.info(f"Successfully named unknown face: face_id={face_id}, name={name}")
        return {"message": "Face named successfully", "name": name}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error naming face: face_id={face_id}, name={name}, error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Error naming face: {str(e)}")


@app.delete("/api/unknown-faces/{face_id}")
async def delete_unknown_face(face_id: str):
    """Delete an unknown face."""
    try:
        success = storage.delete_unknown_face(face_id)
        if not success:
            raise HTTPException(status_code=404, detail="Face not found")
        
        return {"message": "Face deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting face: {str(e)}")


@app.get("/api/recognition-history")
async def get_recognition_history():
    """Get all recognition events."""
    logger.info("Getting recognition history")
    events = storage.get_recognition_history()
    logger.info(f"Found {len(events)} recognition events")
    return events


@app.get("/api/recognition-history/{event_id}")
async def get_recognition_event(event_id: str):
    """Get a specific recognition event."""
    logger.info(f"Getting recognition event: event_id={event_id}")
    event = storage.get_recognition_event(event_id)
    
    if not event:
        logger.warning(f"Recognition event not found: event_id={event_id}")
        raise HTTPException(status_code=404, detail="Recognition event not found")
    
    return event


@app.get("/api/recognition-history/{event_id}/original")
async def get_recognition_original_image(event_id: str):
    """Get the original image for a recognition event."""
    image_path = storage.get_recognition_image_path(event_id, "original")
    
    if not image_path:
        logger.warning(f"Original image not found for event: event_id={event_id}")
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(image_path, media_type="image/jpeg")


@app.get("/api/recognition-history/{event_id}/face/{face_index}")
async def get_recognition_face_image(event_id: str, face_index: int):
    """Get a specific face image from a recognition event."""
    image_path = storage.get_recognition_image_path(event_id, "face", face_index)
    
    if not image_path:
        logger.warning(f"Face image not found: event_id={event_id}, face_index={face_index}")
        raise HTTPException(status_code=404, detail="Face image not found")
    
    return FileResponse(image_path, media_type="image/jpeg")


@app.delete("/api/recognition-history/{event_id}")
async def delete_recognition_event(event_id: str):
    """Delete a recognition event."""
    logger.info(f"Deleting recognition event: event_id={event_id}")
    try:
        success = storage.delete_recognition_event(event_id)
        if not success:
            raise HTTPException(status_code=404, detail="Recognition event not found")
        
        logger.info(f"Successfully deleted recognition event: event_id={event_id}")
        return {"message": "Recognition event deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting recognition event: event_id={event_id}, error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting recognition event: {str(e)}")


@app.post("/api/recognition-history/{event_id}/face/{face_index}/add-to-known")
async def add_face_from_recognition(event_id: str, face_index: int, request: NameFaceRequest):
    """Add a face from a recognition event to known faces."""
    logger.info(f"Adding face from recognition event to known faces: event_id={event_id}, face_index={face_index}, name={request.name}")
    try:
        # Get the face image data from the recognition event
        face_image_data = storage.get_recognition_face_image_data(event_id, face_index)
        if not face_image_data:
            logger.warning(f"Face image not found: event_id={event_id}, face_index={face_index}")
            raise HTTPException(status_code=404, detail="Face image not found in recognition event")
        
        # Save it as a known face
        success = storage.save_known_face(request.name, face_image_data)
        if not success:
            logger.error(f"Failed to save known face: name={request.name}, event_id={event_id}, face_index={face_index}")
            raise HTTPException(status_code=500, detail="Failed to save face as known person")
        
        # Invalidate cache so the new face is immediately available
        face_service.invalidate_cache()
        
        logger.info(f"Successfully added face to known faces: name={request.name}, event_id={event_id}, face_index={face_index}")
        return {"message": f"Face added to known person '{request.name}' successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error adding face from recognition event: event_id={event_id}, face_index={face_index}, name={request.name}, error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Error adding face to known person: {str(e)}")


@app.get("/api/settings", response_model=Settings)
async def get_settings():
    """Get current server settings."""
    try:
        settings = storage.load_settings()
        return Settings(**settings)
    except Exception as e:
        logger.exception(f"Error loading settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading settings: {str(e)}")


@app.post("/api/settings", response_model=Settings)
async def update_settings(settings: Settings):
    """Update server settings."""
    try:
        settings_dict = {
            "webhook_url": settings.webhook_url or "",
            "webhook_enabled": settings.webhook_enabled
        }
        
        success = storage.save_settings(settings_dict)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save settings")
        
        logger.info(f"Settings updated: webhook_enabled={settings.webhook_enabled}, webhook_url={'*' * 20 if settings.webhook_url else 'empty'}")
        return Settings(**settings_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating settings: {str(e)}")


# Serve static files (React app)
if static_dir.exists():
    # Mount the entire static directory to serve assets
    # This will serve files from /assets/, /static/, etc. as they exist in the static_dir
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")
    
    # Serve index.html for root path
    @app.get("/")
    async def serve_index():
        """Serve React app index.html."""
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(
                index_file,
                media_type="text/html"
            )
        else:
            return HTMLResponse(
                content="<h1>React app not built yet. Run 'npm run build' in the frontend directory.</h1>",
                status_code=503
            )
    
    # Serve index.html for all other non-API routes (SPA routing)
    # This catch-all should come after the mount, so /assets/* is handled by the mount first
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        """Serve React app for all non-API routes (SPA fallback)."""
        # Don't serve API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        
        # Assets should be handled by the mount above, but if they reach here, return 404
        if full_path.startswith("assets/"):
            raise HTTPException(status_code=404)
        
        # Serve index.html for SPA routing
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(
                index_file,
                media_type="text/html"
            )
        else:
            return HTMLResponse(
                content="<h1>React app not built yet. Run 'npm run build' in the frontend directory.</h1>",
                status_code=503
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

