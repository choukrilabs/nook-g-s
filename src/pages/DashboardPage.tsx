import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  PlusCircle,
  Plus,
  List,
  Users,
  BarChart2,
  Zap,
  Clock as ClockIcon,
  RefreshCw,
  Activity,
  CheckCircle,
  AlertTriangle,
  Banknote,
  CreditCard,
  Gift,
  Wallet,
  ChevronRight,
  Loader2,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { SessionCard } from "../components/sessions/SessionCard";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useRealtime } from "../hooks/useRealtime";
import { useTranslation } from "../i18n";
import { supabase } from "../lib/supabase";
import { Session, StaffPermissions } from "../types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "../lib/offlineDB";

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cafe, type, staff, owner } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const { activeSessions } = useSessionStore();
  const [lastSessions, setLastSessions] = useState<Session[]>([]);
  const [todayStats, setTodayStats] = useState({
    revenue: 0,
    total: 0,
    completed: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const notifiedSessions = useRef<Set<string>>(new Set());

  useRealtime();

  // Push notifications for long sessions
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default" && type === "owner") {
      Notification.requestPermission();
    }

    const checkLongSessions = () => {
      if (!cafe?.long_session_alert_hours) return;
      const thresholdHours = cafe.long_session_alert_hours;
      const now = new Date().getTime();

      activeSessions.forEach((session) => {
        const start = new Date(session.started_at).getTime();
        const hours = (now - start) / 3600000;

        if (
          hours >= thresholdHours &&
          !notifiedSessions.current.has(session.id)
        ) {
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            type === "owner"
          ) {
            new Notification("Alerte de session longue", {
              body: `La place ${session.seat_number} (${session.customer_name}) a dépassé ${thresholdHours} heures.`,
              icon: "/favicon.svg",
            });
          }
          notifiedSessions.current.add(session.id);
        }
      });
    };

    checkLongSessions();
    const interval = setInterval(checkLongSessions, 60000);

    return () => clearInterval(interval);
  }, [activeSessions, cafe]);

  const loadStats = async () => {
    if (!cafe) return;
    setIsRefreshing(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Load local data first for instant display
    const localSessions = await db.sessions
      .where("status")
      .equals("completed")
      .filter((s) => new Date(s.ended_at!) >= today)
      .reverse()
      .sortBy("ended_at");

    if (localSessions.length > 0) {
      const revenue = localSessions.reduce((acc, s) => acc + s.total_amount, 0);
      setTodayStats({
        revenue,
        total: localSessions.length + activeSessions.length,
        completed: localSessions.length,
      });
      setLastSessions(localSessions.slice(0, 5));
    }

    if (!navigator.onLine) {
      setIsRefreshing(false);
      return;
    }

    const { data: sessions } = await supabase
      .from("sessions")
      .select("*")
      .eq("cafe_id", cafe.id)
      .eq("status", "completed")
      .gte("ended_at", today.toISOString())
      .order("ended_at", { ascending: false });

    if (sessions) {
      const revenue = sessions.reduce((acc: number, s: Session) => acc + s.total_amount, 0);
      setTodayStats({
        revenue,
        total: sessions.length + activeSessions.length,
        completed: sessions.length,
      });
      setLastSessions(sessions.slice(0, 5));
      // also save these specific completed sessions locally
      db.sessions.bulkPut(sessions);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadStats();
  }, [cafe, activeSessions.length]);

  const hasPermission = (perm: keyof StaffPermissions) => {
    if (type === "owner") return true;
    if (!staff?.permissions) return false;
    const perms = staff.permissions as unknown as StaffPermissions;
    return !!perms[perm];
  };

  return (
    <div className="min-h-screen bg-bg pb-8">
      <TopBar />

      <main className="pt-20 px-4 space-y-10">
        {/* Long Session Global Alert */}
        {activeSessions.some((s) => {
          const start = new Date(s.started_at).getTime();
          const now = new Date().getTime();
          const hours = (now - start) / 3600000;
          return hours >= (cafe?.long_session_alert_hours || 3);
        }) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 glass rounded-2xl flex items-center gap-4 text-error border-error/30 shadow-2xl shadow-error/10 relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-error/50" />
            <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center shrink-0 border border-error/20 group-hover:bg-error/20 transition-colors">
              <AlertTriangle size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] mb-1 opacity-80">
                Action requise
              </div>
              <div className="text-[13px] font-bold text-text leading-tight">
                Attention: Certaines sessions ont dépassé la limite de temps.
              </div>
            </div>
          </motion.div>
        )}

        {/* Revenue Card (Technical/Instrument Style) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-8 rounded-[32px] border border-white/5 bg-bg2 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          {/* Advanced Mesh Background */}
          <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-accent/20 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[200px] h-[200px] bg-accent/10 rounded-full blur-[100px] mix-blend-overlay pointer-events-none" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                  <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">
                    {t("dashboard.revenue_today")}
                  </span>
                </div>
                <div className="text-xs text-text3 font-bold uppercase tracking-wider">
                  {format(new Date(), "EEEE, d MMMM")}
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (hasPermission("clients")) {
                        navigate("/clients");
                      } else {
                        addToast(t("dashboard.access_denied"), "error");
                      }
                    }}
                    className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-text2 hover:text-accent hover:border-accent/40 active:scale-90 transition-all"
                  >
                    <Users size={18} />
                  </button>
                  <button
                    onClick={loadStats}
                    className={`w-11 h-11 rounded-2xl glass flex items-center justify-center text-text2 hover:text-accent hover:border-accent/40 active:scale-90 transition-all ${isRefreshing ? "animate-spin" : ""}`}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-mono font-extrabold text-transparent bg-clip-text bg-linear-to-b from-text via-text to-text/20 tracking-tighter leading-none">
                  {todayStats.revenue.toFixed(2)}
                </span>
                <span className="text-base font-mono font-black text-accent tracking-widest opacity-60">
                  DH
                </span>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              <div className="bg-surface/50 border border-white/5 px-4 py-2.5 rounded-2xl flex items-center gap-3 backdrop-blur-xl shrink-0">
                <Activity size={14} className="text-text3" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-text leading-none">
                    {todayStats.total}
                  </span>
                  <span className="text-[8px] font-black text-text3 uppercase tracking-tighter mt-0.5">
                    TOTAL
                  </span>
                </div>
              </div>
              <div className="bg-accent/10 border border-accent/20 px-4 py-2.5 rounded-2xl flex items-center gap-3 backdrop-blur-xl text-accent2 shrink-0">
                <Zap size={14} className="fill-accent/30" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-accent leading-none">
                    {activeSessions.length}
                  </span>
                  <span className="text-[8px] font-black text-accent/50 uppercase tracking-tighter mt-0.5">
                    ACTIVES
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Active Sessions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-text flex items-center gap-2">
              {t("dashboard.active_sessions")}
              <span className="px-2 py-0.5 bg-accent-glow text-accent2 rounded-full text-[10px]">
                {activeSessions.length}
              </span>
              <Link
                to="/seats"
                className="text-[11px] font-bold text-text ms-auto bg-surface2 hover:bg-surface border border-border/50 rounded-full px-3 py-1.5 transition-all active:scale-95 flex items-center gap-1 shadow-sm"
              >
                {cafe ? cafe.total_seats - activeSessions.length : 0} /{" "}
                {cafe?.total_seats || 0} places
              </Link>
            </h2>
            <Link
              to="/sessions"
              className="text-xs font-bold text-text2 hover:text-text bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-1.5 rounded-full transition-all active:scale-95"
            >
              {t("dashboard.history") || "Historique"}
            </Link>
          </div>

          {activeSessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 glass border-white/5 rounded-3xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-accent/2 blur-[80px] rounded-full pointer-events-none" />
              <div className="w-20 h-20 bg-surface/80 rounded-[24px] flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative z-10">
                <ClockIcon size={32} className="text-text3 opacity-50" />
              </div>
              <p className="text-base text-text font-bold mb-2 relative z-10">
                Aucune session active
              </p>
              <p className="text-xs text-text3 font-medium mb-6 relative z-10">
                Toutes les places sont disponibles ({cafe?.total_seats || 0}{" "}
                places).
              </p>
              <Button
                variant="primary"
                className="relative z-10 px-8 rounded-2xl h-12"
                onClick={() => navigate("/sessions/new")}
              >
                <PlusCircle size={18} className="me-2" />
                {t("dashboard.start_session")}
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {activeSessions.map((session) => (
                  <div key={session.id}>
                    <SessionCard
                      session={session}
                      onEnd={(s) => navigate(`/sessions/${s.id}`)}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Last Sessions */}
        {lastSessions.length > 0 && (
          <section className="space-y-4 pb-10">
            <h2 className="text-[11px] font-black text-text3 uppercase tracking-[0.2em]">
              {t("dashboard.last_sessions")}
            </h2>
            <div className="glass border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
              {lastSessions.map((session) => (
                <motion.div
                  key={session.id}
                  whileTap={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                  className="p-5 flex items-center justify-between transition-colors hover:bg-white/[0.01]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface2/50 flex items-center justify-center text-[10px] font-mono font-bold text-text3 border border-white/5">
                      {format(new Date(session.ended_at!), "HH:mm")}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text mb-0.5">
                        Place {session.seat_number} — {session.customer_name}
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface2 rounded-full text-[9px] font-bold text-text3 uppercase tracking-wider">
                        <ClockIcon size={10} />
                        {session.duration_minutes} min
                      </div>
                    </div>
                  </div>
                  <div className="text-end flex flex-col items-end gap-1.5">
                    <div className="text-sm font-mono font-extrabold text-accent">
                      {session.total_amount.toFixed(2)}{" "}
                      <span className="text-[10px] opacity-60">DH</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating Action Button Instead of BottomNav */}
      <button
        onClick={() => navigate("/sessions/new")}
        className="fixed bottom-[24px] end-6 w-14 h-14 bg-gradient-to-br from-accent to-accent2 hover:opacity-90 text-white rounded-full flex items-center justify-center shadow-[0_4px_24px_rgba(249,115,22,0.4)] z-50 transition-transform active:scale-90"
      >
        <Plus size={28} />
      </button>

      {/* <BottomNav /> hidden per sketch */}
    </div>
  );
}
