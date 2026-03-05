import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

interface Workspace {
  id: string;
  workspace_name?: string;
  company_name?: string;
  location?: string;
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
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName: string, email: string) => Promise<void>;
  logout: () => void;
  fetchWorkspace: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    localStorage.getItem('selected_workspace_id')
  );
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
      await fetchWorkspaces();
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/onboarding/');
      const listed = Array.isArray(response.data?.workspaces) ? response.data.workspaces : [];
      setWorkspaces(listed);

      if (response.data.exists && response.data.workspace) {
        const currentId = String(response.data.workspace.id || "");
        setWorkspace(response.data.workspace);
        if (!selectedWorkspaceId || !listed.some((w: Workspace) => w.id === selectedWorkspaceId)) {
          localStorage.setItem('selected_workspace_id', currentId);
          setSelectedWorkspaceId(currentId);
        }
      } else {
        setWorkspace(null);
      }
    } catch (error) {
      setWorkspace(null);
      setWorkspaces([]);
    }
  };

  const fetchWorkspace = fetchWorkspaces;

  const selectWorkspace = async (workspaceId: string) => {
    localStorage.setItem('selected_workspace_id', workspaceId);
    setSelectedWorkspaceId(workspaceId);
    await fetchWorkspaces();
  };

  const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    setUser(response.data.user);
    await fetchWorkspaces();
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
    localStorage.removeItem('selected_workspace_id');
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setSelectedWorkspaceId(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      workspace,
      workspaces,
      selectedWorkspaceId,
      login,
      register,
      logout,
      fetchWorkspace,
      fetchWorkspaces,
      selectWorkspace,
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
