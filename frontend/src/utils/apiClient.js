// central axios client used by your admin UI
import axios from 'axios';

const BASE = process.env.REACT_APP_API_BASE || 'https://universalparts.onrender.com';

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// optional: unwrap backend error messages for nicer UI errors
api.interceptors.response.use(
  res => res,
  err => {
    const message = err?.response?.data?.message || err?.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

export default api;
