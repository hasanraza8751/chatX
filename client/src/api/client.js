import axios from 'axios';

// Why axios: interceptors + withCredentials in one place.
// withCredentials:true lets the browser send the httpOnly auth cookie
// on every REST call (approved correction — no token in JS).
// NOTE: no default Content-Type — axios sets application/json for objects
// and multipart/form-data (with boundary) for FormData automatically.
// A fixed default would break file uploads.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 30000,
});

export default api;
