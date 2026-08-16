import React, { useEffect } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { useTranslation, useLanguageStore } from "../i18n";
import {
  Globe,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Users,
  Zap,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";

export default function WelcomePage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { logo } = useUIStore();
  const navigate = useNavigate();
  const { type, isLoading, cafe } = useAuthStore();

  useEffect(() => {
    if (!isLoading && type) {
      if (type === "owner" && !cafe?.setup_complete) {
        navigate("/wizard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [type, isLoading, cafe, navigate]);

  const toggleLanguage = () => {
    const nextLang = language === "fr" ? "en" : "fr";
    setLanguage(nextLang as any);
  };

  return (
    <div className="min-h-screen bg-bg text-text overflow-x-hidden font-sans relative selection:bg-accent/30 selection:text-white">
      {/* Futuristic Ambient Glow & Grid Matrix */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Cyber Neon Orb Top Center */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[340px] bg-gradient-to-b from-accent/25 via-accent/5 to-transparent rounded-full blur-3xl opacity-70" />
        {/* Subtle Deep Cyber Blue Accent */}
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-10 -right-40 w-96 h-96 bg-accent/15 rounded-full blur-3xl opacity-40" />

        {/* High-Tech Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Futuristic Radial Fade on Matrix */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/40 to-bg" />
      </div>

      {/* Top HUD Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-5 py-3.5 flex items-center justify-between bg-bg/75 backdrop-blur-xl border-b border-border/60 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-1 bg-accent/30 rounded-xl blur-sm animate-pulse" />
            <img
              src={logo || "/favicon.svg"}
              alt="Nook OS"
              className={`w-7 h-7 relative z-10 drop-shadow-md ${
                logo ? "object-contain bg-white/10 rounded-lg p-0.5" : ""
              }`}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                NOOK
              </span>
              <span className="text-xs font-mono font-bold text-accent tracking-widest uppercase px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20">
                OS
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface2/60 border border-border/60 text-[11px] font-mono text-text2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span>CORE ONLINE</span>
          </div>

          {/* Futuristic Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center px-3 py-1.5 rounded-lg bg-surface/70 border border-border/70 text-xs font-mono font-semibold tracking-wider hover:border-accent/40 transition-all active:scale-95 shadow-sm"
          >
            <span className={language === "fr" ? "text-accent font-bold drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "text-text3"}>
              FR
            </span>
            <span className="text-text3 mx-1.5 opacity-60">/</span>
            <span className={language === "en" ? "text-accent font-bold drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "text-text3"}>
              EN
            </span>
          </button>
        </div>
      </header>

      <main className="pt-28 pb-20 px-5 max-w-md mx-auto relative z-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center mt-2"
        >
          {/* Futuristic Hologram HUD Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-accent/15 via-accent/10 to-accent/5 border border-accent/30 text-accent2 text-xs font-mono font-semibold mb-6 shadow-[0_0_15px_rgba(249,115,22,0.15)] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent shadow-[0_0_6px_rgba(249,115,22,1)]" />
            </span>
            <span className="tracking-wide uppercase">{t("welcome.tag")}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-sm">
            {t("welcome.hero_title")}
          </h1>

          <p className="text-sm sm:text-base text-text2 mb-8 max-w-[320px] mx-auto leading-relaxed font-normal">
            {t("welcome.hero_subtitle")}
          </p>

          {/* Futuristic Glowing Cyber CTA Button */}
          <div className="w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent via-amber-500 to-accent rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse" />
            <button
              onClick={() => navigate("/register")}
              className="relative w-full h-14 rounded-xl bg-gradient-to-r from-accent via-[#ea580c] to-[#c2410c] text-white font-extrabold text-base tracking-wide shadow-[0_4px_25px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all duration-200 border border-white/20 overflow-hidden"
            >
              {/* Laser sheen effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
              <span className="drop-shadow-sm">{t("welcome.start_free")}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform rtl:rotate-180" />
            </button>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm">
            <span className="text-text3 font-medium">{t("auth.already_account")}</span>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={() =>
                  navigate("/login", { state: { defaultRole: "owner" } })
                }
                className="text-accent hover:text-accent2 transition-colors font-bold tracking-wide hover:underline decoration-accent/50"
              >
                {t("auth.owner")}
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() =>
                  navigate("/login", { state: { defaultRole: "staff" } })
                }
                className="text-accent hover:text-accent2 transition-colors font-bold tracking-wide hover:underline decoration-accent/50"
              >
                {t("auth.staff")}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Quick Futuristic Proof Metrics */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-10 grid grid-cols-3 gap-2"
        >
          {[
            { label: t("welcome.proof_1"), tag: "01" },
            { label: t("welcome.proof_2"), tag: "02" },
            { label: t("welcome.proof_3"), tag: "03" },
          ].map((proof, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center p-2.5 rounded-xl bg-surface/50 border border-border/60 backdrop-blur-md hover:border-accent/30 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-accent/80 mb-1.5 shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
              <span className="text-[11px] font-medium text-text2 leading-tight">
                {proof.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Futuristic Features (Stacked HUD Modules) */}
        <div className="mt-14 space-y-3.5">
          <FeatureCard
            icon={<CheckCircle2 className="text-accent" size={22} />}
            code="MOD-01"
            title={t("welcome.feat1_title")}
            desc={t("welcome.feat1_desc")}
            delay={0.1}
          />
          <FeatureCard
            icon={<BarChart3 className="text-accent" size={22} />}
            code="MOD-02"
            title={t("welcome.feat2_title")}
            desc={t("welcome.feat2_desc")}
            delay={0.2}
          />
          <FeatureCard
            icon={<Users className="text-accent" size={22} />}
            code="MOD-03"
            title={t("welcome.feat3_title")}
            desc={t("welcome.feat3_desc")}
            delay={0.3}
          />
        </div>

        {/* Final Futuristic CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-14 mb-8 text-center"
        >
          <div className="w-full max-w-sm relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent via-amber-500 to-accent rounded-2xl blur-md opacity-60 group-hover:opacity-90 transition duration-300" />
            <button
              onClick={() => navigate("/register")}
              className="relative w-full h-14 rounded-xl bg-gradient-to-r from-accent via-[#ea580c] to-[#c2410c] text-white font-extrabold text-base tracking-wide shadow-[0_4px_25px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all duration-200 border border-white/20 overflow-hidden"
            >
              <span className="drop-shadow-sm">{t("welcome.start_free")}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform rtl:rotate-180" />
            </button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm">
            <span className="text-text3 font-medium">{t("auth.already_account")}</span>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={() =>
                  navigate("/login", { state: { defaultRole: "owner" } })
                }
                className="text-accent hover:text-accent2 transition-colors font-bold"
              >
                {t("auth.owner")}
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() =>
                  navigate("/login", { state: { defaultRole: "staff" } })
                }
                className="text-accent hover:text-accent2 transition-colors font-bold"
              >
                {t("auth.staff")}
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  code,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  code?: string;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay, duration: 0.4 }}
      className="group relative bg-surface/75 backdrop-blur-xl border border-border/80 hover:border-accent/40 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all duration-300"
    >
      {/* Subtle corner tech accent */}
      <div className="absolute top-2.5 right-3 font-mono text-[10px] text-text3/70 tracking-widest">
        {code}
      </div>

      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(249,115,22,0.15)] group-hover:shadow-[0_0_18px_rgba(249,115,22,0.3)] transition-all">
        {icon}
      </div>
      <div className="pe-4">
        <h2 className="text-base font-bold text-text mb-1 tracking-tight group-hover:text-white transition-colors">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-text2 leading-relaxed font-normal">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}
