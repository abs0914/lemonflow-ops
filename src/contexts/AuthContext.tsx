import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  id: string;
  full_name: string;
  role: "Admin" | "Production" | "Warehouse" | "Store" | "CEO" | "Finance" | "Fulfillment" | "Accounting";
  signature_url: string | null;
  signature_type: string | null;
  signature_updated_at: string | null;
}

type RoleName = UserProfile["role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  extraRoles: RoleName[];
  hasRole: (role: RoleName | RoleName[]) => boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [extraRoles, setExtraRoles] = useState<RoleName[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const lastFetchedUserId = useRef<string | null>(null);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log("Fetching profile for user:", userId);
      const [{ data, error }, { data: rolesData, error: rolesError }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (error) {
        console.error("Error fetching profile:", error);
        throw error;
      }
      if (rolesError) {
        console.error("Error fetching extra roles:", rolesError);
      }
      console.log("Profile fetched:", data, "extra roles:", rolesData);
      setProfile(data as UserProfile);
      setExtraRoles(((rolesData ?? []) as { role: RoleName }[]).map((r) => r.role));
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
      setExtraRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Skip if initial session hasn't been handled yet (getSession will handle it)
          if (!initialSessionHandled) return;
          // Skip duplicate fetches for same user (e.g. TOKEN_REFRESHED)
          if (event === "TOKEN_REFRESHED") return;
          
          lastFetchedUserId.current = currentSession.user.id;
          setLoading(true);
          fetchUserProfile(currentSession.user.id);
        } else if (event === "SIGNED_OUT") {
          lastFetchedUserId.current = null;
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      initialSessionHandled = true;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        lastFetchedUserId.current = currentSession.user.id;
        fetchUserProfile(currentSession.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      navigate("/dashboard");
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    lastFetchedUserId.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    navigate("/login");
  };

  const refreshProfile = async () => {
    if (user?.id) {
      setLoading(true);
      await fetchUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

