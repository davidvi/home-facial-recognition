import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const recognizeFace = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await api.post('/recognize', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const getKnownFaces = async () => {
  const response = await api.get('/known-faces');
  return response.data;
};

export const addKnownFace = async (name, imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('name', name);
  
  const response = await api.post('/known-faces', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const deleteKnownFace = async (name) => {
  const response = await api.delete(`/known-faces/${encodeURIComponent(name)}`);
  return response.data;
};

export const getUnknownFaces = async () => {
  const response = await api.get('/unknown-faces');
  return response.data;
};

export const nameUnknownFace = async (faceId, name) => {
  const response = await api.post(`/unknown-faces/${faceId}/name`, { name });
  return response.data;
};

export const deleteUnknownFace = async (faceId) => {
  const response = await api.delete(`/unknown-faces/${faceId}`);
  return response.data;
};

export const getUnknownFaceImageUrl = (faceId) => {
  return `${API_BASE_URL}/unknown-faces/${faceId}/image`;
};

export const getUnknownFaceFaceUrl = (faceId) => {
  return `${API_BASE_URL}/unknown-faces/${faceId}/face`;
};

export const getKnownFaceImages = async (name) => {
  const response = await api.get(`/known-faces/${encodeURIComponent(name)}/images`);
  return response.data;
};

export const getKnownFaceImageUrl = (name, filename) => {
  return `${API_BASE_URL}/known-faces/${encodeURIComponent(name)}/image/${filename}`;
};

export const deleteKnownFaceImage = async (name, filename) => {
  const response = await api.delete(`/known-faces/${encodeURIComponent(name)}/image/${filename}`);
  return response.data;
};

export const getRecognitionHistory = async () => {
  const response = await api.get('/recognition-history');
  return response.data;
};

export const getRecognitionEvent = async (eventId) => {
  const response = await api.get(`/recognition-history/${eventId}`);
  return response.data;
};

export const deleteRecognitionEvent = async (eventId) => {
  const response = await api.delete(`/recognition-history/${eventId}`);
  return response.data;
};

export const getRecognitionOriginalImageUrl = (eventId) => {
  return `${API_BASE_URL}/recognition-history/${eventId}/original`;
};

export const getRecognitionFaceImageUrl = (eventId, faceIndex) => {
  return `${API_BASE_URL}/recognition-history/${eventId}/face/${faceIndex}`;
};

export const addFaceFromRecognition = async (eventId, faceIndex, name) => {
  const response = await api.post(`/recognition-history/${eventId}/face/${faceIndex}/add-to-known`, { name });
  return response.data;
};

export const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

export const updateSettings = async (settings) => {
  const response = await api.post('/settings', settings);
  return response.data;
};

