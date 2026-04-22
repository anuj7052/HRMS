import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface EsslPunch {
  id: string;
  empCode: string;
  empName: string;
  timestamp: string; // "YYYY-MM-DD HH:mm:ss"
  direction: 'in' | 'out';
  deviceSerial?: string;
}

export interface EsslConfig {
  mode: 'session' | 'soap' | 'adms' | 'receiver' | 'ebioserver';
  proxyUrl: string;
  serverUrl: string;
  userName: string;
  password: string;
  pollMs: number;
}

interface EsslState {
  config: EsslConfig;
  enabled: boolean;
  connected: boolean;
  lastError: string | null;
  lastPolledAt: string | null;
  recent: EsslPunch[]; // most recent first, capped
  totalToday: number;
  testing: boolean;
}

const initialState: EsslState = {
  config: {
    mode: 'session',
    proxyUrl: 'http://localhost:4000',
    serverUrl: 'http://98.70.41.54:85',
    userName: '',
    password: '',
    pollMs: 5000,
  },
  enabled: false,
  connected: false,
  lastError: null,
  lastPolledAt: null,
  recent: [],
  totalToday: 0,
  testing: false,
};

const slice = createSlice({
  name: 'essl',
  initialState,
  reducers: {
    setConfig(state, action: PayloadAction<Partial<EsslConfig>>) {
      state.config = { ...state.config, ...action.payload };
    },
    setEnabled(state, action: PayloadAction<boolean>) {
      state.enabled = action.payload;
      if (!action.payload) state.connected = false;
    },
    setTesting(state, action: PayloadAction<boolean>) {
      state.testing = action.payload;
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
      if (action.payload) state.lastError = null;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.lastError = action.payload;
      if (action.payload) state.connected = false;
    },
    ingestPunches(state, action: PayloadAction<EsslPunch[]>) {
      state.lastPolledAt = new Date().toISOString();
      const seen = new Set(state.recent.map((p) => p.id));
      const fresh = action.payload.filter((p) => !seen.has(p.id));
      if (fresh.length === 0) return;
      state.recent = [...fresh, ...state.recent].slice(0, 100);
      const today = new Date().toISOString().split('T')[0];
      state.totalToday = state.recent.filter((p) => p.timestamp.startsWith(today)).length;
    },
    clearRecent(state) {
      state.recent = [];
      state.totalToday = 0;
    },
  },
});

export const {
  setConfig,
  setEnabled,
  setTesting,
  setConnected,
  setError,
  ingestPunches,
  clearRecent,
} = slice.actions;
export default slice.reducer;
