import React, { useState, useEffect } from 'react';
import { getUnknownFaces, nameUnknownFace, deleteUnknownFace, getUnknownFaceImageUrl, getUnknownFaceFaceUrl } from '../api';

const UnknownFaces = ({ onFaceNamed }) => {
  const [unknownFaces, setUnknownFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [naming, setNaming] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [nameInputs, setNameInputs] = useState({});

  useEffect(() => {
    loadUnknownFaces();
  }, []);

  const loadUnknownFaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const faces = await getUnknownFaces();
      setUnknownFaces(faces);
      // Initialize name inputs
      const inputs = {};
      faces.forEach(face => {
        inputs[face.id] = '';
      });
      setNameInputs(inputs);
    } catch (err) {
      setError(`Failed to load unknown faces: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (faceId, value) => {
    setNameInputs(prev => ({
      ...prev,
      [faceId]: value
    }));
  };

  const handleNameFace = async (faceId) => {
    const name = nameInputs[faceId]?.trim();
    if (!name) {
      setError('Please enter a name');
      return;
    }

    try {
      setNaming(prev => ({ ...prev, [faceId]: true }));
      setError(null);
      await nameUnknownFace(faceId, name);
      await loadUnknownFaces();
      if (onFaceNamed) {
        onFaceNamed();
      }
    } catch (err) {
      setError(`Failed to name face: ${err.message}`);
    } finally {
      setNaming(prev => ({ ...prev, [faceId]: false }));
    }
  };

  const handleDelete = async (faceId) => {
    if (!window.confirm('Are you sure you want to delete this unknown face?')) {
      return;
    }

    try {
      setDeleting(faceId);
      await deleteUnknownFace(faceId);
      await loadUnknownFaces();
    } catch (err) {
      setError(`Failed to delete face: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return <div className="loading">Loading unknown faces...</div>;
  }

  return (
    <div className="card">
      <h2>Unknown Faces</h2>

      {error && <div className="error">{error}</div>}

      {unknownFaces.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
          No unknown faces. All detected faces are recognized!
        </p>
      ) : (
        <div className="unknown-face-grid">
          {unknownFaces.map((face) => (
            <div key={face.id} className="unknown-face-item">
              <img
                src={face.face_url ? getUnknownFaceFaceUrl(face.id) : getUnknownFaceImageUrl(face.id)}
                alt="Unknown face"
                onError={(e) => {
                  // Fallback to full image if cropped face fails
                  if (face.face_url && e.target.src.includes('/face')) {
                    e.target.src = getUnknownFaceImageUrl(face.id);
                  } else {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                  }
                }}
              />
              <div className="content">
                <div className="timestamp">
                  {formatTimestamp(face.timestamp)}
                </div>
                <div className="actions">
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={nameInputs[face.id] || ''}
                    onChange={(e) => handleNameChange(face.id, e.target.value)}
                    disabled={naming[face.id] || deleting === face.id}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleNameFace(face.id);
                      }
                    }}
                  />
                  <button
                    className="button button-success"
                    onClick={() => handleNameFace(face.id)}
                    disabled={naming[face.id] || deleting === face.id || !nameInputs[face.id]?.trim()}
                  >
                    {naming[face.id] ? 'Naming...' : 'Name'}
                  </button>
                  <button
                    className="button button-danger"
                    onClick={() => handleDelete(face.id)}
                    disabled={naming[face.id] || deleting === face.id}
                  >
                    {deleting === face.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UnknownFaces;

