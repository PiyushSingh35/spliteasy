/**
 * Axios instance with JWT handling.
 *  - Request interceptor: attaches the access token to every request.
 *  - Response interceptor: on a 401, tries the refresh token once, then retries
 *    the original request. If refresh fails, clears tokens and redirects to login.
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

// Token helpers (single source of truth = localStorage)
export const tokenStore = {
  get access() { return localStorage.getItem("access"); },
  get refresh() { return localStorage.getItem("refresh"); },
  set({ access, refresh }) {
    if (access) localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
  },
  clear() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
  },
};

const api = axios.create({ baseURL: BASE_URL });

// Attach access token to outgoing requests.
api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle expired access tokens by refreshing once.
let refreshing = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Only try refresh once per request, and never for the refresh call itself.
    if (status === 401 && !original._retried && tokenStore.refresh &&
        !original.url.includes("/auth/refresh")) {
      original._retried = true;
      try {
        // De-duplicate concurrent refreshes.
        refreshing = refreshing || axios.post(`${BASE_URL}/auth/refresh/`, {
          refresh: tokenStore.refresh,
        });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set({ access: data.access, refresh: data.refresh });
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        tokenStore.clear();
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
