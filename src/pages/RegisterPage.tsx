import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useUIStore } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
import { useTranslation, useLanguageStore } from "../i18n";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast, logo } = useUIStore();
  const { type, isLoading: authLoading } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && type) {
      navigate("/dashboard", { replace: true });
    }
  }, [type, authLoading, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        addToast(t("common.success"), "success");
        navigate("/wizard");
      }
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = () => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, var(--border) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-20">
        <button
          onClick={() => navigate("/login")}
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text2 hover:text-text transition-colors"
        >
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </button>
        <button
          onClick={() => {
            const { language, setLanguage } = useLanguageStore.getState();
            setLanguage(language === "fr" ? "en" : "fr");
          }}
          className="flex items-center px-3 py-1.5 rounded-full bg-surface/50 border border-border text-xs font-bold tracking-wide transition-colors"
        >
          <span
            className={
              useLanguageStore().language === "fr"
                ? "text-accent"
                : "text-text3"
            }
          >
            FR
          </span>
          <span className="text-text3 mx-1.5 font-medium">/</span>
          <span
            className={
              useLanguageStore().language === "en"
                ? "text-accent"
                : "text-text3"
            }
          >
            EN
          </span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[420px] bg-surface border border-border rounded-2xl p-8 shadow-2xl z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <img
            src={logo || "/favicon.svg"}
            className="w-11 h-11 mb-3 drop-shadow-lg object-contain bg-white/10 rounded-lg p-1"
            alt="Nook OS"
          />
          <h1 className="text-xl font-bold text-text">Nook OS</h1>
          <p className="text-sm text-text2 mt-1">{t("auth.subtitle")}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            placeholder={t("auth.your_name")}
            icon={<User size={16} />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder={t("auth.email")}
            icon={<Mail size={16} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-2">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.password")}
              icon={<Lock size={16} />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-text3 hover:text-text"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex gap-1 h-1 px-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    i < strength
                      ? strength === 1
                        ? "bg-error"
                        : strength === 2
                          ? "bg-warning"
                          : strength === 3
                            ? "bg-yellow-500"
                            : "bg-success"
                      : "bg-border"
                  }`}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {t("auth.register")}
          </Button>

          <p className="text-center text-sm text-text3 pt-2">
            {t("auth.already_account")}
            <Link
              to="/login"
              className="text-accent hover:underline font-medium"
            >
              {t("auth.login_link")}
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
