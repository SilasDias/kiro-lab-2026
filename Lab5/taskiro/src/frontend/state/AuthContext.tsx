/**
 * AuthContext — current User + Session_Token and the login/logout lifecycle.
 *
 * Responsibilities (design "State Management", Requirements 18.7, 7.14):
 *  - Hold the authenticated `User` and the in-memory `Session_Token`.
 *  - `login(email, password)` calls `api.login`, sets the token on the shared
 *    API client (`api.setToken`) so subsequent requests carry the Bearer token,
 *    and stores the normalized user.
 *  - `logout()` calls `api.logout` (revoking the session server-side) and then
 *    clears the token + user locally, so later protected requests fail 401.
 *  - `handleUnauthorized()` clears local auth state without an API round-trip;
 *    `DataContext` invokes it whenever a protected call throws an
 *    `UnauthorizedError` (401), realizing "clear state on 401" (R18.7).
 *  - The token is optionally persisted to `sessionStorage` so a page reload
 *    restores the session (re-validated via `GET /api/me`).
 *
 * Backend shape note: the auth routes return the user as
 * `{ id, display_name, email }` (snake_case) while the frontend `User` DTO uses
 * `displayName`. `normalizeUser` maps `display_name` → `displayName`
 * defensively, accepting either spelling, so the rest of the frontend uses
 * `displayName` consistently.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, UnauthorizedError, type User } from '../lib/api';

/** sessionStorage key used to persist the Bearer token across reloads. */
const TOKEN_STORAGE_KEY = 'taskiro.token';

/** Authentication lifecycle status. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  /** The authenticated user, or null when signed out. */
  user: User | null;
  /** The in-memory session token, or null when signed out. */
  token: string | null;
  /** Coarse-grained status; `loading` while restoring a persisted session. */
  status: AuthStatus;
  /** Convenience flag: true when a user is signed in. */
  isAuthenticated: boolean;
  /**
   * Authenticate with credentials. On success sets the token on the API client
   * and stores the user. Throws the typed API error (e.g. `UnauthorizedError`
   * for bad credentials, `ApiError` 429 for rate limiting) on failure.
   */
  login: (email: string, password: string) => Promise<User>;
  /** Revoke the session server-side and clear local auth state. */
  logout: () => Promise<void>;
  /**
   * Clear local auth state immediately (no API call). Called by data actions
   * when a protected request returns 401 (R18.7).
   */
  handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Map a raw user object from the wire into the frontend `User` DTO. Accepts
 * either `displayName` (camelCase) or `display_name` (snake_case), since the
 * backend auth routes emit snake_case.
 */
function normalizeUser(raw: unknown): User {
  const r = (raw ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof r.displayName === 'string' && r.displayName) ||
    (typeof r.display_name === 'string' && r.display_name) ||
    '';
  return {
    id: String(r.id ?? ''),
    displayName,
    email: typeof r.email === 'string' ? r.email : '',
  };
}

// --- sessionStorage helpers (guarded for non-browser environments) ---

function readStoredToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode / disabled storage); the token
    // still lives in memory for the current session.
  }
}

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Guard against setting state after unmount during the async restore.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Clear all local auth state and the API client token. */
  const clearLocal = useCallback(() => {
    api.clearToken();
    writeStoredToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearLocal();
    setStatus('unauthenticated');
  }, [clearLocal]);

  // On mount, restore a persisted session (if any) by re-validating via /api/me.
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) {
      setStatus('unauthenticated');
      return;
    }
    api.setToken(stored);
    setTokenState(stored);
    (async () => {
      try {
        const restored = await api.me();
        if (!mountedRef.current) return;
        setUser(normalizeUser(restored));
        setStatus('authenticated');
      } catch {
        // Stale/invalid token — clear and treat as signed out.
        if (!mountedRef.current) return;
        clearLocal();
        setStatus('unauthenticated');
      }
    })();
  }, [clearLocal]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { token: newToken, user: rawUser } = await api.login({
      email,
      password,
    });
    api.setToken(newToken);
    writeStoredToken(newToken);
    const normalized = normalizeUser(rawUser);
    setTokenState(newToken);
    setUser(normalized);
    setStatus('authenticated');
    return normalized;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout();
    } catch {
      // Even if the revoke call fails (e.g. already-expired token), proceed to
      // clear local state so the UI returns to the signed-out gate.
    }
    clearLocal();
    setStatus('unauthenticated');
  }, [clearLocal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      status,
      isAuthenticated: user !== null,
      login,
      logout,
      handleUnauthorized,
    }),
    [user, token, status, login, logout, handleUnauthorized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/** Exposed for tests that need to map raw wire users to the `User` DTO. */
export { normalizeUser };
