import os
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Tuple
import numpy as np
import face_recognition
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)


class FaceStorage:
    def __init__(self, base_path: str = "faces"):
        self.base_path = Path(base_path)
        self.known_path = self.base_path / "known"
        self.unknown_path = self.base_path / "unknown"
        self.recognitions_path = self.base_path / "recognitions"
        
        # Create directories if they don't exist
        self.known_path.mkdir(parents=True, exist_ok=True)
        self.unknown_path.mkdir(parents=True, exist_ok=True)
        self.recognitions_path.mkdir(parents=True, exist_ok=True)
    
    def _extract_face_image(self, image_data: bytes) -> Optional[bytes]:
        """Extract and crop the first detected face from an image."""
        try:
            image = face_recognition.load_image_file(BytesIO(image_data))
            face_locations = face_recognition.face_locations(image)
            
            if not face_locations:
                logger.warning("No faces detected in image for extraction")
                return None
            
            # Use the first face (or largest if we want to be smarter)
            top, right, bottom, left = face_locations[0]
            
            # Convert to PIL Image for cropping
            pil_image = Image.fromarray(image)
            face_image = pil_image.crop((left, top, right, bottom))
            
            # Convert back to bytes
            output = BytesIO()
            face_image.save(output, format='JPEG', quality=95)
            return output.getvalue()
        except Exception as e:
            logger.exception(f"Error extracting face from image: {str(e)}")
            return None
    
    def save_known_face(self, name: str, image_data: bytes) -> bool:
        """Save a known face with its encoding."""
        import logging
        logger = logging.getLogger(__name__)
        
        person_dir = self.known_path / name
        person_dir.mkdir(exist_ok=True)
        
        try:
            # Load image and find faces
            logger.info(f"Processing image for known face: name={name}, image_size={len(image_data)} bytes")
            
            image = face_recognition.load_image_file(BytesIO(image_data))
            face_encodings = face_recognition.face_encodings(image)
            
            if not face_encodings:
                logger.warning(f"save_known_face failed: No face detected in image - name={name}")
                return False
            
            logger.info(f"Found {len(face_encodings)} face(s) in image for name={name}, using first face")
            
            # Use the first face found
            encoding = face_encodings[0]
            
            # Save encoding
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            encoding_file = person_dir / f"{timestamp}.npy"
            try:
                np.save(encoding_file, encoding)
                logger.info(f"Saved face encoding: name={name}, encoding_file={encoding_file}")
            except Exception as e:
                logger.error(f"save_known_face failed: Could not save encoding - name={name}, error={str(e)}")
                return False
            
            # Save original image
            image_file = person_dir / f"{timestamp}.jpg"
            try:
                with open(image_file, "wb") as f:
                    f.write(image_data)
                logger.info(f"Saved face image: name={name}, image_file={image_file}")
            except Exception as e:
                logger.error(f"save_known_face failed: Could not save image - name={name}, error={str(e)}")
                return False
            
            return True
        except Exception as e:
            logger.exception(f"save_known_face exception: name={name}, error={str(e)}")
            return False
    
    def load_known_encodings(self) -> dict:
        """Load all known face encodings from filesystem."""
        encodings = {}
        
        for person_dir in self.known_path.iterdir():
            if not person_dir.is_dir():
                continue
            
            name = person_dir.name
            person_encodings = []
            
            for encoding_file in person_dir.glob("*.npy"):
                encoding = np.load(encoding_file)
                person_encodings.append(encoding)
            
            if person_encodings:
                encodings[name] = person_encodings
        
        return encodings
    
    def save_unknown_face(self, image_data: bytes) -> str:
        """Save an unknown face and return its ID."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        face_id = f"unknown_{timestamp}"
        
        face_dir = self.unknown_path / face_id
        face_dir.mkdir(exist_ok=True)
        
        # Save full image
        image_file = face_dir / "image.jpg"
        try:
            with open(image_file, "wb") as f:
                f.write(image_data)
            logger.info(f"Saved unknown face full image: face_id={face_id}, size={len(image_data)} bytes")
        except Exception as e:
            logger.error(f"Failed to save unknown face image: face_id={face_id}, error={str(e)}")
            raise
        
        # Extract and save cropped face
        face_image_data = self._extract_face_image(image_data)
        if face_image_data:
            face_file = face_dir / "face.jpg"
            try:
                with open(face_file, "wb") as f:
                    f.write(face_image_data)
                logger.info(f"Saved unknown face cropped image: face_id={face_id}, size={len(face_image_data)} bytes")
            except Exception as e:
                logger.warning(f"Failed to save cropped face (continuing anyway): face_id={face_id}, error={str(e)}")
        else:
            logger.warning(f"Could not extract face from image: face_id={face_id}")
        
        # Save metadata
        metadata = {
            "id": face_id,
            "timestamp": datetime.now().isoformat(),
            "image_path": str(image_file.relative_to(self.base_path)),
            "has_face_image": face_image_data is not None
        }
        
        metadata_file = face_dir / "metadata.json"
        try:
            with open(metadata_file, "w") as f:
                json.dump(metadata, f)
        except Exception as e:
            logger.error(f"Failed to save metadata: face_id={face_id}, error={str(e)}")
            raise
        
        return face_id
    
    def get_unknown_faces(self) -> List[dict]:
        """Get list of all unknown faces."""
        unknown_faces = []
        
        for face_dir in self.unknown_path.iterdir():
            if not face_dir.is_dir():
                continue
            
            metadata_file = face_dir / "metadata.json"
            if not metadata_file.exists():
                continue
            
            with open(metadata_file, "r") as f:
                metadata = json.load(f)
            
            # Add image URL paths
            image_path = face_dir / "image.jpg"
            face_path = face_dir / "face.jpg"
            if image_path.exists():
                metadata["image_url"] = f"/api/unknown-faces/{metadata['id']}/image"
                if face_path.exists():
                    metadata["face_url"] = f"/api/unknown-faces/{metadata['id']}/face"
                unknown_faces.append(metadata)
        
        # Sort by timestamp (newest first)
        unknown_faces.sort(key=lambda x: x["timestamp"], reverse=True)
        return unknown_faces
    
    def name_unknown_face(self, face_id: str, name: str) -> bool:
        """Move an unknown face to known faces."""
        import logging
        logger = logging.getLogger(__name__)
        
        unknown_dir = self.unknown_path / face_id
        if not unknown_dir.exists():
            logger.error(f"name_unknown_face failed: Unknown face directory does not exist - face_id={face_id}, path={unknown_dir}")
            return False
        
        # Try to use cropped face image first, fallback to full image
        face_file = unknown_dir / "face.jpg"
        image_file = unknown_dir / "image.jpg"
        
        image_data = None
        if face_file.exists():
            try:
                with open(face_file, "rb") as f:
                    image_data = f.read()
                logger.info(f"Using cropped face image for naming: face_id={face_id}, name={name}, size={len(image_data)} bytes")
            except Exception as e:
                logger.warning(f"Could not read cropped face image, trying full image: face_id={face_id}, error={str(e)}")
        
        if not image_data and image_file.exists():
            try:
                with open(image_file, "rb") as f:
                    image_data = f.read()
                logger.info(f"Using full image for naming: face_id={face_id}, name={name}, size={len(image_data)} bytes")
            except Exception as e:
                logger.error(f"name_unknown_face failed: Could not read image file - face_id={face_id}, path={image_file}, error={str(e)}")
                return False
        
        if not image_data:
            logger.error(f"name_unknown_face failed: No image file found - face_id={face_id}")
            return False
        
        # Save as known face
        logger.info(f"Attempting to save as known face: name={name}, face_id={face_id}")
        if not self.save_known_face(name, image_data):
            logger.error(f"name_unknown_face failed: save_known_face returned False - name={name}, face_id={face_id}. Possible reasons: no face detected in image, face encoding failed")
            return False
        
        logger.info(f"Successfully saved as known face: name={name}, face_id={face_id}")
        
        # Delete unknown face directory
        try:
            shutil.rmtree(unknown_dir)
            logger.info(f"Deleted unknown face directory: face_id={face_id}, path={unknown_dir}")
        except Exception as e:
            logger.warning(f"Failed to delete unknown face directory (face already moved): face_id={face_id}, error={str(e)}")
            # Don't fail the operation if deletion fails - the face was already moved
        
        return True
    
    def delete_unknown_face(self, face_id: str) -> bool:
        """Delete an unknown face."""
        unknown_dir = self.unknown_path / face_id
        if unknown_dir.exists():
            shutil.rmtree(unknown_dir)
            return True
        return False
    
    def delete_known_face(self, name: str) -> bool:
        """Delete a known person and all their faces."""
        person_dir = self.known_path / name
        if person_dir.exists():
            shutil.rmtree(person_dir)
            return True
        return False
    
    def get_known_faces(self) -> List[dict]:
        """Get list of all known people with their face counts."""
        known_faces = []
        
        for person_dir in self.known_path.iterdir():
            if not person_dir.is_dir():
                continue
            
            name = person_dir.name
            image_count = len(list(person_dir.glob("*.jpg")))
            
            known_faces.append({
                "name": name,
                "image_count": image_count
            })
        
        return known_faces
    
    def get_unknown_face_image_path(self, face_id: str) -> Optional[Path]:
        """Get the image path for an unknown face."""
        unknown_dir = self.unknown_path / face_id
        image_file = unknown_dir / "image.jpg"
        
        if image_file.exists():
            return image_file
        return None
    
    def get_unknown_face_face_path(self, face_id: str) -> Optional[Path]:
        """Get the cropped face image path for an unknown face."""
        unknown_dir = self.unknown_path / face_id
        face_file = unknown_dir / "face.jpg"
        
        if face_file.exists():
            return face_file
        return None
    
    def get_known_face_images(self, name: str) -> List[dict]:
        """Get list of all face images for a known person."""
        person_dir = self.known_path / name
        if not person_dir.exists():
            return []
        
        images = []
        for image_file in person_dir.glob("*.jpg"):
            images.append({
                "filename": image_file.name,
                "url": f"/api/known-faces/{name}/image/{image_file.name}"
            })
        
        return sorted(images, key=lambda x: x["filename"], reverse=True)
    
    def save_recognition_event(self, image_data: bytes, processed_result: dict) -> str:
        """Save a recognition event with all detected faces."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        event_id = f"recognition_{timestamp}"
        
        event_dir = self.recognitions_path / event_id
        event_dir.mkdir(exist_ok=True)
        
        # Save original image
        original_file = event_dir / "original.jpg"
        with open(original_file, "wb") as f:
            f.write(image_data)
        logger.info(f"Saved original image for recognition event: event_id={event_id}")
        
        # Save each detected face
        faces_data = []
        image = processed_result['image']
        
        for face_result in processed_result['faces']:
            face_index = face_result['face_index']
            top, right, bottom, left = face_result['location']
            
            # Extract face from image
            face_image = image[top:bottom, left:right]
            
            # Convert to PIL and save
            pil_image = Image.fromarray(face_image)
            face_file = event_dir / f"face_{face_index}.jpg"
            pil_image.save(face_file, format='JPEG', quality=95)
            
            faces_data.append({
                "face_index": face_index,
                "known_person": face_result['known_person'],
                "name_person": face_result['name_person'],
                "distance": face_result.get('distance'),
                "location": {
                    "top": int(top),
                    "right": int(right),
                    "bottom": int(bottom),
                    "left": int(left)
                },
                "face_image": f"face_{face_index}.jpg"
            })
        
        # Save metadata
        metadata = {
            "event_id": event_id,
            "timestamp": datetime.now().isoformat(),
            "total_faces": processed_result['total_faces'],
            "faces": faces_data
        }
        
        metadata_file = event_dir / "metadata.json"
        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved recognition event metadata: event_id={event_id}, faces={processed_result['total_faces']}")
        return event_id
    
    def get_recognition_history(self) -> List[dict]:
        """Get all recognition events."""
        events = []
        
        for event_dir in self.recognitions_path.iterdir():
            if not event_dir.is_dir():
                continue
            
            metadata_file = event_dir / "metadata.json"
            if not metadata_file.exists():
                continue
            
            try:
                with open(metadata_file, "r") as f:
                    metadata = json.load(f)
                
                # Add image URLs
                metadata["original_image_url"] = f"/api/recognition-history/{metadata['event_id']}/original"
                
                # Add face image URLs
                for face in metadata.get('faces', []):
                    face["face_image_url"] = f"/api/recognition-history/{metadata['event_id']}/face/{face['face_index']}"
                
                events.append(metadata)
            except Exception as e:
                logger.error(f"Error loading recognition event {event_dir.name}: {str(e)}")
                continue
        
        # Sort by timestamp (newest first)
        events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return events
    
    def get_recognition_event(self, event_id: str) -> Optional[dict]:
        """Get a specific recognition event."""
        event_dir = self.recognitions_path / event_id
        if not event_dir.exists():
            return None
        
        metadata_file = event_dir / "metadata.json"
        if not metadata_file.exists():
            return None
        
        with open(metadata_file, "r") as f:
            metadata = json.load(f)
        
        # Add image URLs
        metadata["original_image_url"] = f"/api/recognition-history/{event_id}/original"
        for face in metadata.get('faces', []):
            face["face_image_url"] = f"/api/recognition-history/{event_id}/face/{face['face_index']}"
        
        return metadata
    
    def get_recognition_image_path(self, event_id: str, image_type: str = "original", face_index: Optional[int] = None) -> Optional[Path]:
        """Get the path to a recognition event image."""
        event_dir = self.recognitions_path / event_id
        if not event_dir.exists():
            return None
        
        if image_type == "original":
            image_file = event_dir / "original.jpg"
        elif image_type == "face" and face_index is not None:
            image_file = event_dir / f"face_{face_index}.jpg"
        else:
            return None
        
        if image_file.exists():
            return image_file
        return None
    
    def delete_recognition_event(self, event_id: str) -> bool:
        """Delete a recognition event."""
        event_dir = self.recognitions_path / event_id
        if event_dir.exists():
            shutil.rmtree(event_dir)
            logger.info(f"Deleted recognition event: event_id={event_id}")
            return True
        return False

