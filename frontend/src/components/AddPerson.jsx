import React, { useState } from 'react';
import { addKnownFace } from '../api';

const AddPerson = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    if (!imageFile) {
      setError('Please select an image');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await addKnownFace(name.trim(), imageFile);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(`Failed to add person: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
          />

          <div className="file-input">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>

          {preview && (
            <div style={{ marginBottom: '15px', textAlign: 'center' }}>
              <img
                src={preview}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  border: '2px solid #ddd',
                }}
              />
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-success"
              disabled={loading || !name.trim() || !imageFile}
            >
              {loading ? 'Adding...' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPerson;

