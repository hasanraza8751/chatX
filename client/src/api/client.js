import axios from 'axios';

// Why axios: interceptors + withCredentials in one place.
// withCredentials:true lets the browser send the httpOnly auth cookie
// on every REST call (approved correction — no token in JS).
// NOTE: no default Content-Type — axios sets application/json for objects
// and multipart/form-data (with boundary) for FormData automatically.
// A fixed default would break file uploads.
// Production builds REQUIRE VITE_API_URL (no silent localhost fallback);
// development keeps the localhost default for the local workflow.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : undefined);
if (!API_URL) {
  throw new Error('Missing VITE_API_URL environment variable. Set it in client/.env (see .env.example).');
}
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
});

export default api;
