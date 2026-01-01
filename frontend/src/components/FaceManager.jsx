import React, { useState, useEffect } from 'react';
import { getKnownFaces, deleteKnownFace, getKnownFaceImages, getKnownFaceImageUrl } from '../api';
import AddPerson from './AddPerson';

const FaceManager = ({ onAddPerson }) => {
  const [knownFaces, setKnownFaces] = useState([]);
  const [faceImages, setFaceImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [expandedFaces, setExpandedFaces] = useState(new Set());
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    loadKnownFaces();
  }, []);

  const loadKnownFaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const faces = await getKnownFaces();
      setKnownFaces(faces);
      
      // Load images for each face
      const imagesMap = {};
      for (const face of faces) {
        try {
          const images = await getKnownFaceImages(face.name);
          imagesMap[face.name] = images;
        } catch (err) {
          console.error(`Failed to load images for ${face.name}:`, err);
          imagesMap[face.name] = [];
        }
      }
      setFaceImages(imagesMap);
    } catch (err) {
      setError(`Failed to load known faces: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      setDeleting(name);
      await deleteKnownFace(name);
      await loadKnownFaces();
      if (onAddPerson) {
        onAddPerson();
      }
    } catch (err) {
      setError(`Failed to delete person: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handlePersonAdded = () => {
    setShowAddModal(false);
    loadKnownFaces();
    if (onAddPerson) {
      onAddPerson();
    }
  };

  const toggleExpand = (name) => {
    setExpandedFaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const handleImageClick = (name, filename) => {
    setZoomedImage({ name, filename });
  };

  const closeZoom = () => {
    setZoomedImage(null);
  };

  if (loading) {
    return <div className="loading">Loading known faces...</div>;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Known Faces</h2>
        <button className="button" onClick={() => setShowAddModal(true)}>
          + Add Person
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {knownFaces.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
          No known faces yet. Add your first person to get started!
        </p>
      ) : (
        <div className="face-list">
          {knownFaces.map((face) => {
            const images = faceImages[face.name] || [];
            const firstImage = images.length > 0 ? images[0] : null;
            const isExpanded = expandedFaces.has(face.name);
            
            return (
              <div key={face.name} className="face-item" style={{ position: 'relative' }}>
                {firstImage && (
                  <img
                    src={getKnownFaceImageUrl(face.name, firstImage.filename)}
                    alt={face.name}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleImageClick(face.name, firstImage.filename)}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <h3>{face.name}</h3>
                <p>{face.image_count} {face.image_count === 1 ? 'face' : 'faces'}</p>
                
                {isExpanded && images.length > 0 && (
                  <div style={{ marginTop: '15px', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.9em', marginBottom: '10px', color: '#666' }}>
                      All Faces ({images.length})
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: '10px'
                    }}>
                      {images.map((image) => (
                        <img
                          key={image.filename}
                          src={getKnownFaceImageUrl(face.name, image.filename)}
                          alt={`${face.name} - ${image.filename}`}
                          style={{
                            width: '100%',
                            height: '100px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: '2px solid #667eea',
                            transition: 'transform 0.2s'
                          }}
                          onClick={() => handleImageClick(face.name, image.filename)}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {images.length > 1 && (
                    <button
                      className="button"
                      onClick={() => toggleExpand(face.name)}
                      style={{ flex: 1 }}
                    >
                      {isExpanded ? 'Collapse' : 'Show All'}
                    </button>
                  )}
                  <button
                    className="button button-danger"
                    onClick={() => handleDelete(face.name)}
                    disabled={deleting === face.name}
                    style={{ flex: images.length > 1 ? 1 : 'none' }}
                  >
                    {deleting === face.name ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoomedImage && (
        <div
          className="modal"
          onClick={closeZoom}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              position: 'relative'
            }}
          >
            <img
              src={getKnownFaceImageUrl(zoomedImage.name, zoomedImage.filename)}
              alt={zoomedImage.name}
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}
            />
            <button
              onClick={closeZoom}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                textAlign: 'center'
              }}
            >
              {zoomedImage.name}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPerson
          onClose={() => setShowAddModal(false)}
          onSuccess={handlePersonAdded}
        />
      )}
    </div>
  );
};

export default FaceManager;

