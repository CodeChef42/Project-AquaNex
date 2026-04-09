import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const publicRoutes = ['/auth/register/', '/auth/login/', '/auth/refresh/'];
  const isPublic = publicRoutes.some(route => config.url.includes(route));

  if (!isPublic) {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const workspaceId = localStorage.getItem('selected_workspace_id');
    if (workspaceId) {
      config.headers['X-Workspace-Id'] = workspaceId;
    }
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 🚨 DEBUG TRAP 1: Why did the original request (Onboarding) fail?
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.error("🚨 401 CRASH REASON:", error.response?.data);
      alert(`ONBOARDING REJECTED! Reason: ${JSON.stringify(error.response?.data)}`);

      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh');
        
        // 🚨 DEBUG TRAP 2: What refresh token are we sending?
        console.log("🔄 Attempting refresh with token:", refreshToken);

        const response = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access', access);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
        
      } catch (err: any) {
        // 🚨 DEBUG TRAP 3: Why did the refresh fail?
        console.error("🚨 400 REFRESH CRASH REASON:", err.response?.data);
        alert(`REFRESH REJECTED! Reason: ${JSON.stringify(err.response?.data)}`);
        
        // 🛑 WE COMMENTED THESE OUT SO THE PAGE FREEZES INSTEAD OF REDIRECTING
        // localStorage.clear();
        // window.location.href = '/signin'; 
        
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;