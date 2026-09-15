const localFallbackApiBase = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : "http://localhost:8000/api";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? localFallbackApiBase;

export const FILE_LIMITS = {
  image: 100 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  text: 100 * 1024 * 1024,
};

export const SECRET_LIMITS = {
  image: 100 * 1024 * 1024,
  audio: 4 * 1024 * 1024,
  video: 8 * 1024 * 1024,
  text: 100 * 1024 * 1024,
};

