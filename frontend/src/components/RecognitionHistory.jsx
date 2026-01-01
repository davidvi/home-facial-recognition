import React, { useState, useEffect } from 'react';
import {
  getRecognitionHistory,
  deleteRecognitionEvent,
  getRecognitionOriginalImageUrl,
  getRecognitionFaceImageUrl
} from '../api';

const RecognitionHistory = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState(new Set());

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await getRecognitionHistory();
      setEvents(history);
    } catch (err) {
      setError(`Failed to load recognition history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this recognition event?')) {
      return;
    }

    try {
      setDeleting(eventId);
      await deleteRecognitionEvent(eventId);
      await loadHistory();
    } catch (err) {
      setError(`Failed to delete event: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const toggleExpand = (eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
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
    return <div className="loading">Loading recognition history...</div>;
  }

  return (
    <div className="card">
      <h2>Recognition History</h2>

      {error && <div className="error">{error}</div>}

      {events.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
          No recognition events yet. Recognition events are created when images are processed.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {events.map((event) => {
            const isExpanded = expandedEvents.has(event.event_id);
            const knownFaces = event.faces.filter(f => f.known_person);
            const unknownFaces = event.faces.filter(f => !f.known_person);

            return (
              <div
                key={event.event_id}
                style={{
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1em' }}>
                      {formatTimestamp(event.timestamp)}
                    </h3>
                    <p style={{ margin: '5px 0', color: '#666', fontSize: '0.9em' }}>
                      {event.total_faces} {event.total_faces === 1 ? 'face' : 'faces'} detected
                      {knownFaces.length > 0 && (
                        <span style={{ color: '#27ae60', marginLeft: '10px' }}>
                          {knownFaces.length} known
                        </span>
                      )}
                      {unknownFaces.length > 0 && (
                        <span style={{ color: '#e74c3c', marginLeft: '10px' }}>
                          {unknownFaces.length} unknown
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="button"
                      onClick={() => toggleExpand(event.event_id)}
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                    <button
                      className="button button-danger"
                      onClick={() => handleDelete(event.event_id)}
                      disabled={deleting === event.event_id}
                    >
                      {deleting === event.event_id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ marginBottom: '15px' }}>
                      <h4 style={{ marginBottom: '10px' }}>Original Image</h4>
                      <img
                        src={getRecognitionOriginalImageUrl(event.event_id)}
                        alt="Original"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          borderRadius: '8px',
                          border: '2px solid #ddd'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>

                    <div>
                      <h4 style={{ marginBottom: '10px' }}>Detected Faces</h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '15px'
                      }}>
                        {event.faces.map((face) => (
                          <div
                            key={face.face_index}
                            style={{
                              border: `2px solid ${face.known_person ? '#27ae60' : '#e74c3c'}`,
                              borderRadius: '8px',
                              padding: '10px',
                              backgroundColor: 'white',
                              textAlign: 'center'
                            }}
                          >
                            <img
                              src={getRecognitionFaceImageUrl(event.event_id, face.face_index)}
                              alt={`Face ${face.face_index}`}
                              style={{
                                width: '100%',
                                height: '150px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                marginBottom: '10px'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <div style={{
                              fontWeight: 'bold',
                              color: face.known_person ? '#27ae60' : '#e74c3c',
                              marginBottom: '5px'
                            }}>
                              {face.known_person ? face.name_person : 'Unknown'}
                            </div>
                            {face.distance !== null && face.distance !== undefined && (
                              <div style={{ fontSize: '0.85em', color: '#666' }}>
                                Distance: {face.distance.toFixed(3)}
                              </div>
                            )}
                            <div style={{ fontSize: '0.8em', color: '#999', marginTop: '5px' }}>
                              Face #{face.face_index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecognitionHistory;

