import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

import { loginWithCredentials } from "../api/auth-api";
import type {
  AuthSession,
  AuthStatus,
  AuthUser,
  LoginCredentials,
} from "../types";
import { writeStoredSession } from "./auth-storage";

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  hydrated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: "idle",
  error: null,
  hydrated: false,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Authentication failed";
}

export const login = createAsyncThunk<
  AuthSession,
  LoginCredentials,
  { rejectValue: string }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    const session = await loginWithCredentials(credentials);
    writeStoredSession(session);
    return session;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const logout = createAsyncThunk("auth/logout", async () => {
  writeStoredSession(null);
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth(
      state,
      action: PayloadAction<AuthSession | null>,
    ) {
      state.user = action.payload?.user ?? null;
      state.token = action.payload?.token ?? null;
      state.status = action.payload ? "authenticated" : "idle";
      state.error = null;
      state.hydrated = true;
    },
    clearAuthError(state) {
      state.error = null;
      state.status = state.token ? "authenticated" : "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.status = "authenticated";
        state.error = null;
        state.hydrated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.user = null;
        state.token = null;
        state.status = "error";
        state.error =
          action.payload ?? "Authentication failed";
        state.hydrated = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.status = "idle";
        state.error = null;
        state.hydrated = true;
      });
  },
});

export const { clearAuthError, hydrateAuth } = authSlice.actions;
export const authReducer = authSlice.reducer;

type StateWithAuth = { auth: AuthState };

export const selectAuth = (state: StateWithAuth) => state.auth;
export const selectIsAuthenticated = (state: StateWithAuth) =>
  Boolean(state.auth.token);
