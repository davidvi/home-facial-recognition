from pydantic import BaseModel
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


class KnownFace(BaseModel):
    name: str
    image_count: int


class UnknownFace(BaseModel):
    id: str
    timestamp: str
    image_url: str


class NameFaceRequest(BaseModel):
    name: str

