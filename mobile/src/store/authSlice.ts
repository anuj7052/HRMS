import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types';
import { mockUsers } from '@/mock/data';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  employeeDbId: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  employeeDbId: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action: PayloadAction<{ user: User; token: string }>) {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    logout(state) {
      state.user = null;
      state.token = null;
    },
    switchRole(state, action: PayloadAction<'employee' | 'manager' | 'hr'>) {
      const u = mockUsers.find((x) => x.role === action.payload);
      if (u) state.user = u;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, switchRole } = authSlice.actions;
export default authSlice.reducer;
