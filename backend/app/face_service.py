import numpy as np
import face_recognition
import logging
from typing import Optional, Tuple, List, Dict
from io import BytesIO
from .storage import FaceStorage

logger = logging.getLogger(__name__)


class FaceRecognitionService:
    def __init__(self, storage: FaceStorage, tolerance: float = 0.75):
        self.storage = storage
        self.tolerance = tolerance
        self._known_encodings_cache = None
        self._cache_dirty = True
    
    def _load_encodings(self):
        """Load encodings from storage, using cache if available."""
        if self._known_encodings_cache is None or self._cache_dirty:
            self._known_encodings_cache = self.storage.load_known_encodings()
            self._cache_dirty = False
        return self._known_encodings_cache
    
    def invalidate_cache(self):
        """Invalidate the cache when faces are added/removed."""
        self._cache_dirty = True
    
    def _process_all_faces(self, image_data: bytes) -> Dict:
        """
        Process all faces in an image and return recognition results for each.
        Returns: {
            'faces': [{'face_index': int, 'known_person': bool, 'name_person': str, 'distance': float, 'location': tuple}],
            'total_faces': int,
            'image': numpy array
        }
        """
        image = face_recognition.load_image_file(BytesIO(image_data))
        
        # Get all face locations using CNN model for better accuracy
        face_locations = face_recognition.face_locations(image, model="cnn")
        logger.info(f"Detected {len(face_locations)} face(s) in image using CNN model")
        
        if not face_locations:
            return {
                'faces': [],
                'total_faces': 0,
                'image': image
            }
        
        # Get encodings for all faces
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        # Load known encodings
        known_encodings = self._load_encodings()
        
        results = []
        for i, (face_encoding, face_location) in enumerate(zip(face_encodings, face_locations)):
            # Compare with all known faces
            best_match = None
            best_distance = float('inf')
            
            for name, person_encodings in known_encodings.items():
                distances = face_recognition.face_distance(person_encodings, face_encoding)
                min_distance = np.min(distances)
                
                if min_distance < best_distance:
                    best_distance = min_distance
                    best_match = name
            
            # Check if best match is within tolerance
            known_person = bool(best_match is not None and best_distance <= self.tolerance)
            name_person = best_match if known_person else ""
            
            results.append({
                'face_index': i,
                'known_person': known_person,
                'name_person': name_person,
                'distance': float(best_distance) if best_match else None,
                'location': face_location  # (top, right, bottom, left)
            })
            
            logger.info(f"Face {i}: known={known_person}, name={name_person}, distance={best_distance if best_match else 'N/A'}")
        
        return {
            'faces': results,
            'total_faces': len(results),
            'image': image
        }
    
    def recognize_face(self, image_data: bytes) -> Tuple[bool, str]:
        """
        Recognize faces in the given image (legacy method for backward compatibility).
        Returns: (known_person: bool, name_person: str) for first face
        """
        result = self.recognize_all_faces(image_data)
        
        if result['total_faces'] == 0:
            return False, ""
        
        # Return result for first face
        first_face = result['faces'][0]
        return first_face['known_person'], first_face['name_person']
    
    def recognize_all_faces(self, image_data: bytes) -> Dict:
        """
        Recognize all faces in the given image.
        Returns: {
            'faces': [{'face_index': int, 'known_person': bool, 'name_person': str, 'distance': float}],
            'total_faces': int
        }
        """
        processed = self._process_all_faces(image_data)
        
        # Save recognition event (this also saves the face images)
        event_id = self.storage.save_recognition_event(image_data, processed)
        logger.info(f"Saved recognition event: event_id={event_id}, total_faces={processed['total_faces']}")
        
        # Save unknown faces separately to unknown faces list
        for face_result in processed['faces']:
            if not face_result['known_person']:
                # Extract and save this specific face as unknown
                top, right, bottom, left = face_result['location']
                face_image = processed['image'][top:bottom, left:right]
                
                # Convert to bytes
                from PIL import Image
                pil_image = Image.fromarray(face_image)
                output = BytesIO()
                pil_image.save(output, format='JPEG', quality=95)
                face_image_data = output.getvalue()
                
                unknown_face_id = self.storage.save_unknown_face(face_image_data)
                logger.info(f"Saved unknown face from recognition: face_id={unknown_face_id}, event_id={event_id}")
        
        return {
            'faces': processed['faces'],
            'total_faces': processed['total_faces'],
            'event_id': event_id
        }

