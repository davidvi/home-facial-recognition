import React, { useState, useEffect } from 'react';
import { addKnownFace } from '../api';

const AddPerson = ({ onClose, onSuccess, existingName = null }) => {
  const [name, setName] = useState(existingName || '');
  const [imageFiles, setImageFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadResults, setUploadResults] = useState([]);

  useEffect(() => {
    if (existingName) {
      setName(existingName);
    }
  }, [existingName]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageFiles(files);
    setUploadResults([]);
    
    // Create previews for all selected images
    const newPreviews = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push({ file, preview: reader.result });
        if (newPreviews.length === files.length) {
          setPreviews(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    if (imageFiles.length === 0) {
      setError('Please select at least one image');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setUploadProgress({});
      setUploadResults([]);

      const results = [];
      let successCount = 0;
      let failCount = 0;

      // Upload each image
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        setUploadProgress(prev => ({ ...prev, [i]: 'uploading' }));
        
        try {
          await addKnownFace(name.trim(), file);
          results.push({ index: i, filename: file.name, success: true });
          successCount++;
          setUploadProgress(prev => ({ ...prev, [i]: 'success' }));
        } catch (err) {
          results.push({ index: i, filename: file.name, success: false, error: err.message });
          failCount++;
          setUploadProgress(prev => ({ ...prev, [i]: 'error' }));
        }
      }

      setUploadResults(results);

      if (successCount > 0) {
        // At least one image succeeded
        if (onSuccess) {
          onSuccess();
        }
        if (failCount === 0) {
          // All succeeded, close modal
          onClose();
        }
      } else {
        // All failed
        setError(`Failed to add all images: ${results.map(r => r.error).join(', ')}`);
      }
    } catch (err) {
      setError(`Failed to add person: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setPreviews(newPreviews);
    setUploadResults([]);
    setUploadProgress({});
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Person</h2>
        
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="input"
            placeholder="Person's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading || !!existingName}
          />

          <div className="file-input">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={loading}
            />
            <p style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
              {imageFiles.length > 0 
                ? `${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} selected`
                : 'Select one or more images (multiple images improve recognition accuracy)'}
            </p>
          </div>

          {previews.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ fontSize: '0.9em', marginBottom: '10px', color: '#666' }}>
                Selected Images ({previews.length})
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '10px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {previews.map((item, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img
                      src={item.preview}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '2px solid #ddd',
                      }}
                    />
                    {uploadProgress[index] === 'success' && (
                      <div style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: '#27ae60',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                      }}>
                        ✓
                      </div>
                    )}
                    {uploadProgress[index] === 'error' && (
                      <div style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: '#e74c3c',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                      }}>
                        ×
                      </div>
                    )}
                    {uploadProgress[index] === 'uploading' && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        Uploading...
                      </div>
                    )}
                    {!loading && (
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          left: '5px',
                          background: 'rgba(231, 76, 60, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadResults.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              {uploadResults.filter(r => r.success).length > 0 && (
                <div className="success" style={{ marginBottom: '10px' }}>
                  Successfully added {uploadResults.filter(r => r.success).length} image(s)
                </div>
              )}
              {uploadResults.filter(r => !r.success).length > 0 && (
                <div className="error">
                  Failed to add {uploadResults.filter(r => !r.success).length} image(s):
                  <ul style={{ marginTop: '5px', marginLeft: '20px' }}>
                    {uploadResults.filter(r => !r.success).map((r, i) => (
                      <li key={i}>{r.filename}: {r.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button"
              onClick={onClose}
              disabled={loading}
            >
              {uploadResults.length > 0 && uploadResults.some(r => r.success) ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="button button-success"
              disabled={loading || !name.trim() || imageFiles.length === 0}
            >
              {loading 
                ? `Uploading... (${Object.values(uploadProgress).filter(p => p === 'uploading').length}/${imageFiles.length})`
                : existingName 
                  ? `Add ${imageFiles.length} Image${imageFiles.length === 1 ? '' : 's'}`
                  : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPerson;

