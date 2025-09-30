// src/api/axios.js
import axios from "axios";

const BASE = process.env.REACT_APP_API_BASE || ""; // "" for same origin or "http://localhost:5000"
const api = axios.create({
  baseURL: BASE,
  withCredentials: true, // crucial: always send cookies
});

export default api;
