import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

interface Workspace {
  modules: string[];
  gateway_id?: string;
  devices?: Array<{
    id: string;
    microcontroller_id: string;
    type: string;
    zone_id?: string | null;
    lat: number | null;
    lng: number | null;
    status: string;
    metric: string;
    reading: number | string;
    last_seen: string;
    anomaly?: boolean;
    anomaly_meta?: {
      family?: string;
      metric?: string;
      previous?: number;
      current?: number;
      delta?: number;
      abs_delta?: number;
      pct_delta?: number | null;
      reason?: string;
      ts?: string;
    } | null;
  }>;
  layout_polygon?: number[][];
  layout_area_m2?: number;
  layout_notes?: string;
  layout_status?: string;
}

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName: string, email: string) => Promise<void>;
  logout: () => void;
  fetchWorkspace: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/profile/');
      setUser(response.data);
      await fetchWorkspace();
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspace = async () => {
    try {
      const response = await api.get('/onboarding/');
      if (response.data.exists) {
        setWorkspace(response.data.workspace);
      }
    } catch (error) {
      // workspace not found, leave as null
    }
  };

  const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    setUser(response.data.user);
    await fetchWorkspace();
  };

  const register = async (username: string, password: string, fullName: string, email: string) => {
    const response = await api.post('/auth/register/', {
      username,
      password,
      full_name: fullName,
      email,
    });
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    setUser(response.data.user);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setWorkspace(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      workspace,
      login,
      register,
      logout,
      fetchWorkspace,
      isAuthenticated: !!user,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
