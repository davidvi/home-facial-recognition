import React, { useState } from 'react';
import FaceManager from './components/FaceManager';
import UnknownFaces from './components/UnknownFaces';
import RecognitionHistory from './components/RecognitionHistory';
import Settings from './components/Settings';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('known');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Face Recognition Manager</h1>
        <p>Manage known faces and review unknown faces detected by your cameras</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'known' ? 'active' : ''}`}
          onClick={() => setActiveTab('known')}
        >
          Known Faces
        </button>
        <button
          className={`tab ${activeTab === 'unknown' ? 'active' : ''}`}
          onClick={() => setActiveTab('unknown')}
        >
          Unknown Faces
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Recognition History
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'known' && (
        <FaceManager key={refreshKey} onAddPerson={handleRefresh} />
      )}

      {activeTab === 'unknown' && (
        <UnknownFaces key={refreshKey} onFaceNamed={handleRefresh} />
      )}

      {activeTab === 'history' && (
        <RecognitionHistory key={refreshKey} />
      )}

      {activeTab === 'settings' && (
        <Settings />
      )}
    </div>
  );
}

export default App;

