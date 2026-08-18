import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Store, Users, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import { useTranslation, useLanguageStore } from "../i18n";
import { OwnerLoginForm } from "../components/auth/OwnerLoginForm";
import { StaffPinLogin } from "../components/auth/StaffPinLogin";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { type, isLoading: authLoading } = useAuthStore();
  const { logo } = useUIStore();

  const locationState = location.state as { defaultRole?: "owner" | "staff" } | null;
  const [role, setRole] = useState<"owner" | "staff">(
    locationState?.defaultRole || "owner",
  );

  useEffect(() => {
    if (!authLoading && type) {
      navigate("/dashboard", { replace: true });
    }
  }, [type, authLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg relative overflow-hidden selection:bg-accent/30 selection:text-white">
      {/* Futuristic Background Matrix & Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[480px] h-[300px] bg-gradient-to-b from-accent/20 via-accent/5 to-transparent rounded-full blur-3xl opacity-70" />
        <div className="absolute -bottom-32 -start-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl opacity-40" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/50 to-bg" />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 start-0 end-0 p-5 flex items-center justify-between z-20">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl bg-surface/70 border border-border/80 backdrop-blur-md flex items-center justify-center text-text2 hover:text-text hover:border-accent/40 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </button>
        <button
          onClick={() => {
            const { language, setLanguage } = useLanguageStore.getState();
            setLanguage(language === "fr" ? "en" : "fr");
          }}
          className="flex items-center px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 backdrop-blur-md text-xs font-mono font-semibold tracking-wider hover:border-accent/40 transition-all active:scale-95 shadow-sm"
        >
          <span
            className={
              useLanguageStore().language === "fr"
                ? "text-accent font-bold drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                : "text-text3"
            }
          >
            FR
          </span>
          <span className="text-text3 mx-1.5 opacity-60">/</span>
          <span
            className={
              useLanguageStore().language === "en"
                ? "text-accent font-bold drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                : "text-text3"
            }
          >
            EN
          </span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[420px] bg-surface/80 backdrop-blur-2xl border border-border/80 hover:border-border rounded-2xl p-7 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-10 relative"
      >
        {/* Futuristic Top Glowing Border Accent */}
        <div className="absolute top-0 start-1/4 end-1/4 h-[1px] bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

        <div className="flex flex-col items-center mb-7">
          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute -inset-1 bg-accent/25 rounded-2xl blur-md" />
            <img
              src={logo || "/favicon.svg"}
              className="w-12 h-12 relative z-10 drop-shadow-lg object-contain bg-white/10 rounded-xl p-1 border border-white/10"
              alt="Nook OS"
            />
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <h1 className="text-xl font-extrabold tracking-tight text-text">Nook OS</h1>
            <span className="text-[10px] font-mono font-bold text-accent px-1.5 py-0.2 bg-accent/10 border border-accent/20 rounded">
              AUTH
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text2 text-center">{t("auth.subtitle")}</p>
        </div>

        <div className="bg-surface2/70 backdrop-blur-md p-1 rounded-xl flex mb-7 border border-border/80">
          <button
            onClick={() => setRole("owner")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              role === "owner"
                ? "bg-accent/15 text-accent2 border border-accent/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
                : "text-text3 hover:text-text2"
            }`}
          >
            <Store size={15} />
            {t("auth.owner")}
          </button>
          <button
            onClick={() => setRole("staff")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              role === "staff"
                ? "bg-accent/15 text-accent2 border border-accent/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
                : "text-text3 hover:text-text2"
            }`}
          >
            <Users size={16} />
            {t("auth.staff")}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {role === "owner" ? (
            <OwnerLoginForm />
          ) : (
            <StaffPinLogin />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
