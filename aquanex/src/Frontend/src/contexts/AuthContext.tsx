import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  demand_forecasting_plants?: Array<{ name: string; quantity: number }>;
  demand_forecasting_systems?: Array<{ name: string; quantity: number }>;
}


interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName: string, email: string) => Promise<string>;
  logout: () => void;
  fetchWorkspace: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  loggingOut: boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SIM_RUNNING_KEY = "aquanex_sim_running";
const SIM_STARTED_AT_KEY = "aquanex_sim_started_at";
const SIM_INTERVAL_SEC_KEY = "aquanex_sim_interval_sec";
const SIM_LAST_PUSH_AT_KEY = "aquanex_sim_last_push_at";
const LOGOUT_DELAY_MS = 1800;


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    localStorage.getItem('selected_workspace_id')
  );
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);


  const enableSimulationSession = () => {
    localStorage.setItem(SIM_RUNNING_KEY, "true");
    if (!localStorage.getItem(SIM_STARTED_AT_KEY)) {
      localStorage.setItem(SIM_STARTED_AT_KEY, String(Date.now()));
    }
    if (!localStorage.getItem(SIM_INTERVAL_SEC_KEY)) {
      localStorage.setItem(SIM_INTERVAL_SEC_KEY, "5");
    }
  };


  // ✅ Stable reference — empty deps because only uses React state setters (always stable) and api (module constant)
  const fetchWorkspaces = useCallback(async () => {
    try {
      const response = await api.get('/onboarding/');
      const listed = Array.isArray(response.data?.workspaces) ? response.data.workspaces : [];

      // Deduplicate by id in case backend returns duplicates
      const unique: Workspace[] = listed.filter(
        (w: Workspace, i: number, arr: Workspace[]) => arr.findIndex((x) => x.id === w.id) === i
      );
      setWorkspaces(unique);

      if (response.data.exists && response.data.workspace) {
        const currentId = String(response.data.workspace.id || "");
        setWorkspace(response.data.workspace);
        // ✅ Functional update avoids needing selectedWorkspaceId in deps
        setSelectedWorkspaceId((prev) => {
          if (!prev || !unique.some((w: Workspace) => w.id === prev)) {
            localStorage.setItem('selected_workspace_id', currentId);
            return currentId;
          }
          return prev;
        });
      } else {
        setWorkspace(null);
      }
    } catch (error) {
      setWorkspace(null);
      setWorkspaces([]);
    }
  }, []); // empty — only uses stable setters + api


  // ✅ Stable alias
  const fetchWorkspace = fetchWorkspaces;


  // ✅ Depends on fetchWorkspaces which is now stable
  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/profile/');
      setUser(response.data);
      enableSimulationSession();
      await fetchWorkspaces();
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaces]);


  // ✅ Runs exactly once on mount because fetchUser is stable
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);


  const selectWorkspace = async (workspaceId: string) => {
    localStorage.setItem('selected_workspace_id', workspaceId);
    setSelectedWorkspaceId(workspaceId);
    const localMatch = workspaces.find((w) => w.id === workspaceId);
    if (localMatch) {
      setWorkspace(localMatch);
    }
    await fetchWorkspaces();
  };


  const deleteWorkspace = async (workspaceId: string) => {
    await api.delete(`/onboarding/${workspaceId}/delete/`);
    if (workspace?.id === workspaceId) {
      setWorkspace(null);
      setSelectedWorkspaceId(null);
      localStorage.removeItem('selected_workspace_id');
    }
    await fetchWorkspaces();
  };


  const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    setUser(response.data.user);
    enableSimulationSession();
    await fetchWorkspaces();
  };


  const register = async (username: string, password: string, fullName: string, email: string): Promise<string> => {
    const response = await api.post('/auth/register/', {
      username,
      password,
      full_name: fullName,
      email,
    });
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    setUser(response.data.user);
    enableSimulationSession();
    return response.data.secret_key;
  };


  const logout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('selected_workspace_id');
      localStorage.removeItem(SIM_RUNNING_KEY);
      localStorage.removeItem(SIM_STARTED_AT_KEY);
      localStorage.removeItem(SIM_INTERVAL_SEC_KEY);
      localStorage.removeItem(SIM_LAST_PUSH_AT_KEY);
      setUser(null);
      setWorkspace(null);
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setLoggingOut(false);
    }, LOGOUT_DELAY_MS);
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
      deleteWorkspace,
      isAuthenticated: !!user,
      loading,
      loggingOut,
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