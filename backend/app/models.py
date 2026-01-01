from pydantic import BaseModel, Field
from typing import Optional, List


class FaceResult(BaseModel):
    face_index: int
    known_person: bool
    name_person: str
    distance: Optional[float] = None


class RecognizeResponse(BaseModel):
    known_person: bool
    name_person: str


class RecognizeAllResponse(BaseModel):
    faces: List[FaceResult]
    total_faces: int
    event_id: Optional[str] = None


class SimpleRecognizeResponse(BaseModel):
    known_person: bool
    name_persons: List[str]


class KnownFace(BaseModel):
    name: str
    image_count: int


class UnknownFace(BaseModel):
    id: str
    timestamp: str
    image_url: str


class NameFaceRequest(BaseModel):
    name: str


class Settings(BaseModel):
    webhook_url: Optional[str] = ""
    webhook_enabled: bool = False
    tolerance: float = Field(default=0.75, ge=0.0, le=1.0, description="Face recognition tolerance (0.0=strict, 1.0=lenient)")

