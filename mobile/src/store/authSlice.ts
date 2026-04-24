import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  /** Employee table primary key (UUID) — needed for /attendance/employee/:id */
  employeeDbId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  employeeDbId: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action: PayloadAction<{ user: User; token: string; employeeDbId?: string | null }>) {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.employeeDbId = action.payload.employeeDbId ?? null;
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.employeeDbId = null;
    },
    setEmployeeDbId(state, action: PayloadAction<string | null>) {
      state.employeeDbId = action.payload;
    },
    switchRole(_state, _action: PayloadAction<'employee' | 'manager' | 'hr'>) {
      // Role switching disabled — uses real auth now
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, switchRole, setEmployeeDbId } = authSlice.actions;
export default authSlice.reducer;
