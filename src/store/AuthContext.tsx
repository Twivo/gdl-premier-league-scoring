/** App-wide authentication state, backed by the AuthProvider (Supabase). */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getAuth, getRepository, isSupabaseConfigured } from '@/data';
import type { AuthUser } from '@/data/repository';
import type { AccountRole } from '@/data/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Whether a secure admin backend is available at all. */
  adminAvailable: boolean;
  /** Resolved role of the signed-in account (null when signed out). */
  role: AccountRole | null;
  /** The team a captain is bound to (null for admins / signed out). */
  teamId: string | null;
  /** Signed in and NOT a captain — full access. */
  isAdmin: boolean;
  /** Signed in as a team captain — scoped to `teamId`. */
  isCaptain: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(() => getAuth(), []);
  const repo = useMemo(() => getRepository(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // The captain/admin binding is loaded from the repository once we have a user.
  const [role, setRole] = useState<AccountRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    auth
      .getUser()
      .then((u) => alive && setUser(u))
      .finally(() => alive && setAuthLoading(false));
    const unsub = auth.onChange((u) => setUser(u));
    return () => {
      alive = false;
      unsub();
    };
  }, [auth]);

  // Resolve the account binding whenever the signed-in user changes. A user
  // with no team_accounts row is treated as admin (matches the RLS rules and
  // the documented "create an admin in Supabase Auth" setup).
  useEffect(() => {
    let alive = true;
    if (!user) {
      setRole(null);
      setTeamId(null);
      setAccountLoading(false);
      return;
    }
    setAccountLoading(true);
    repo
      .getMyTeamAccount()
      .then((acc) => {
        if (!alive) return;
        if (acc?.role === 'captain') {
          setRole('captain');
          setTeamId(acc.teamId);
        } else {
          setRole('admin');
          setTeamId(null);
        }
      })
      .catch(() => {
        // On failure, fail closed to the least-privileged sensible default:
        // still signed in, but with no team scope.
        if (!alive) return;
        setRole('admin');
        setTeamId(null);
      })
      .finally(() => alive && setAccountLoading(false));
    return () => {
      alive = false;
    };
  }, [repo, user]);

  const signIn = useCallback(
    (email: string, password: string) => auth.signIn(email, password),
    [auth],
  );
  const signOut = useCallback(() => auth.signOut(), [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: authLoading || (!!user && accountLoading),
      adminAvailable: isSupabaseConfigured,
      role,
      teamId,
      isAdmin: !!user && role === 'admin',
      isCaptain: !!user && role === 'captain',
      signIn,
      signOut,
    }),
    [user, authLoading, accountLoading, role, teamId, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
