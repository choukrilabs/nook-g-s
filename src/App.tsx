import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./stores/authStore";
import { useSessionStore } from "./stores/sessionStore";
import { useUIStore } from "./stores/uiStore";
import { processSyncQueue } from "./lib/offlineSync";
import { Loader2 } from "lucide-react";
import { ToastContainer } from "./components/ui/Toast";
import { OfflineBanner } from "./components/ui/OfflineBanner";

// Pages (to be created)
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import WizardPage from "./pages/WizardPage";
import DashboardPage from "./pages/DashboardPage";
import SeatsPage from "./pages/SeatsPage";
import NewSessionPage from "./pages/NewSessionPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import SessionHistoryPage from "./pages/SessionHistoryPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import StaffManagementPage from "./pages/StaffManagementPage";
import ProductManagementPage from "./pages/ProductManagementPage";
import AuditLogPage from "./pages/AuditLogPage";
import { PermissionGate } from "./components/ui/PermissionGate";

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
    className="min-h-screen"
  >
    {children}
  </motion.div>
);

const AuthGuard = ({
  children,
  requireOwner = false,
}: {
  children: React.ReactNode;
  requireOwner?: boolean;
}) => {
  const { type, isLoading, cafe } = useAuthStore();
  const { logo } = useUIStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center"
        >
          <img
            src={logo || "/favicon.svg"}
            className="w-16 h-16 mb-4 drop-shadow-lg object-contain bg-white/10 rounded-lg p-1.5"
            alt="Nook OS"
          />
          <h1 className="text-2xl font-bold text-text mb-6">Nook OS</h1>
          <Loader2 size={24} className="text-text3 animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (!type) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOwner && type !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    type === "owner" &&
    !cafe?.setup_complete &&
    location.pathname !== "/wizard"
  ) {
    return <Navigate to="/wizard" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const location = useLocation();
  const { setOwner, setCafe, setLoading, setStaff, logout } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);

      let session = null;
      let sessionError = null;
      try {
        // 1. Check Supabase Auth (Owner)
        const { data, error } = await supabase.auth.getSession();
        session = data.session;
        sessionError = error;
      } catch (e) {
        console.warn("Failed to get session online, checking cached state", e);
        sessionError = e;
      }

      // Add minimum loading time for the splash screen effect
      const minLoadTime = new Promise((resolve) => setTimeout(resolve, 2000));

      let authPromise = (async () => {
        try {
          if (session?.user) {
            setOwner(session.user);
            const { data: cafe, error } = await supabase
              .from("cafes")
              .select("*")
              .eq("owner_id", session.user.id)
              .single();

            if (cafe) {
              setCafe(cafe);
            } else if (
              error &&
              (error.message.includes("Failed to fetch") || !navigator.onLine)
            ) {
              // Offline fallback, user is cached in store
            } else if (error && error.code !== "PGRST116") {
              // Other error
            } else if (!cafe && navigator.onLine) {
              // No cafe found online, user might have deleted it but it's okay, maybe wizard
            }
          } else {
            // If getSession failed due to network, don't wipe the store
            if (
              sessionError &&
              (sessionError.message?.includes("Failed to fetch") ||
                sessionError.message?.includes("Network") ||
                !navigator.onLine)
            ) {
              return; // Keep existing Zustand state
            }
            // 2. Check Local Storage (Staff)
            const staffSession = localStorage.getItem("nook_staff_session");
            if (staffSession) {
              const parsed = JSON.parse(staffSession);
              if (new Date(parsed.expires_at) > new Date()) {
                const { data: staff, error: staffError } = await supabase
                  .from("staff")
                  .select("*")
                  .eq("id", parsed.staff_id)
                  .single();

                const { data: cafe, error: cafeError } = await supabase
                  .from("cafes")
                  .select("*")
                  .eq("id", parsed.cafe_id)
                  .single();

                if (staff && cafe) {
                  setStaff(staff);
                  setCafe(cafe);
                } else if (
                  (staffError || cafeError) &&
                  (!navigator.onLine ||
                    staffError?.message?.includes("fetch") ||
                    cafeError?.message?.includes("fetch"))
                ) {
                  // Keep whatever is cached in the auth store offline
                } else {
                  // Online but staff or cafe deleted/not found
                  localStorage.removeItem("nook_staff_session");
                  if (navigator.onLine) logout();
                }
              } else {
                localStorage.removeItem("nook_staff_session");
                if (navigator.onLine) logout();
              }
            } else {
              // No sessions active, so make sure store is clear
              if (navigator.onLine) logout();
            }
          }
        } catch (e) {
          // If it throws anywhere due to network, ignore and use cached state
          console.warn("Auth check failed, using cached state if available", e);
        }
      })();

      await Promise.all([authPromise, minLoadTime]);

      setLoading(false);

      if (navigator.onLine) {
        processSyncQueue();
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setOwner(session.user);
      } else {
        setOwner(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route
          path="/login"
          element={
            <PageTransition>
              <LoginPage />
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <RegisterPage />
            </PageTransition>
          }
        />

        <Route
          path="/wizard"
          element={
            <AuthGuard requireOwner>
              <PageTransition>
                <WizardPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <PageTransition>
                <DashboardPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/seats"
          element={
            <AuthGuard>
              <PageTransition>
                <SeatsPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/sessions/new"
          element={
            <AuthGuard>
              <PageTransition>
                <NewSessionPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/sessions/:id"
          element={
            <AuthGuard>
              <PageTransition>
                <SessionDetailPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/sessions"
          element={
            <AuthGuard>
              <PageTransition>
                <SessionHistoryPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/clients"
          element={
            <AuthGuard>
              <PermissionGate permission="clients">
                <PageTransition>
                  <ClientsPage />
                </PageTransition>
              </PermissionGate>
            </AuthGuard>
          }
        />

        <Route
          path="/clients/:id"
          element={
            <AuthGuard>
              <PermissionGate permission="clients">
                <PageTransition>
                  <ClientDetailPage />
                </PageTransition>
              </PermissionGate>
            </AuthGuard>
          }
        />

        <Route
          path="/reports"
          element={
            <AuthGuard>
              <PermissionGate permission="reports">
                <PageTransition>
                  <ReportsPage />
                </PageTransition>
              </PermissionGate>
            </AuthGuard>
          }
        />

        <Route
          path="/settings"
          element={
            <AuthGuard>
              <PermissionGate permission="settings">
                <PageTransition>
                  <SettingsPage />
                </PageTransition>
              </PermissionGate>
            </AuthGuard>
          }
        />

        <Route
          path="/settings/staff"
          element={
            <AuthGuard requireOwner>
              <PageTransition>
                <StaffManagementPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/settings/audit"
          element={
            <AuthGuard requireOwner>
              <PageTransition>
                <AuditLogPage />
              </PageTransition>
            </AuthGuard>
          }
        />

        <Route
          path="/settings/products"
          element={
            <AuthGuard>
              <PermissionGate permission="settings">
                <PageTransition>
                  <ProductManagementPage />
                </PageTransition>
              </PermissionGate>
            </AuthGuard>
          }
        />

        <Route
          path="/"
          element={
            <PageTransition>
              <WelcomePage />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-text selection:bg-accent/30">
        <OfflineBanner />
        <AppRoutes />
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}
