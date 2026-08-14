import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Store,
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import { useTranslation, useLanguageStore } from "../i18n";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { NumPad } from "../components/ui/NumPad";
import { PINDots } from "../components/ui/PINDots";
import { hashPIN } from "../lib/crypto";
import { Staff } from "../types";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    type,
    isLoading: authLoading,
    setOwner,
    setStaff,
    setCafe,
  } = useAuthStore();
  const { addToast, logo } = useUIStore();

  const [role, setRole] = useState<"owner" | "staff">(
    (location.state as any)?.defaultRole || "owner",
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && type) {
      navigate("/dashboard", { replace: true });
    }
  }, [type, authLoading, navigate]);

  // Owner form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Staff flow
  const [staffStep, setStaffStep] = useState<1 | 2>(1);
  const [inviteCode, setInviteCode] = useState("");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [cafeForStaff, setCafeForStaff] = useState<any>(null);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data.user) {
        setOwner(data.user);
        const { data: cafe } = await supabase
          .from("cafes")
          .select("*")
          .eq("owner_id", data.user.id)
          .single();

        if (cafe) {
          setCafe(cafe);
          if (cafe.setup_complete) {
            navigate("/dashboard");
          } else {
            navigate("/wizard");
          }
        } else {
          navigate("/wizard");
        }
      }
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteCodeSubmit = async () => {
    if (inviteCode.length < 6) return;
    setIsLoading(true);
    try {
      if (!navigator.onLine) {
        const cachedCafeStr = localStorage.getItem("nook_offline_cafe");
        const cachedStaffStr = localStorage.getItem("nook_offline_staff");
        if (cachedCafeStr && cachedStaffStr) {
          const cachedCafe = JSON.parse(cachedCafeStr);
          const cachedStaff = JSON.parse(cachedStaffStr);
          if (String(cachedCafe.invite_code) === inviteCode) {
            setCafeForStaff(cachedCafe);
            setStaffList(cachedStaff);
            setSelectedStaff(cachedStaff[0]);
            setStaffStep(2);
            setIsLoading(false);
            return;
          }
        }
        addToast("Vous êtes hors-ligne et ce code n'est pas reconnu localement.", "error");
        setIsLoading(false);
        return;
      }

      let { data: cafe, error } = await supabase
        .from("cafes")
        .select("*")
        .eq("invite_code", inviteCode)
        .maybeSingle();

      if (error && error.message.includes("Failed to fetch")) {
        const cachedCafeStr = localStorage.getItem("nook_offline_cafe");
        const cachedStaffStr = localStorage.getItem("nook_offline_staff");
        if (cachedCafeStr && cachedStaffStr) {
          const cachedCafe = JSON.parse(cachedCafeStr);
          const cachedStaff = JSON.parse(cachedStaffStr);
          if (String(cachedCafe.invite_code) === inviteCode) {
            setCafeForStaff(cachedCafe);
            setStaffList(cachedStaff);
            setSelectedStaff(cachedStaff[0]);
            setStaffStep(2);
            setIsLoading(false);
            return;
          }
        }
      }

      if (error && !error.message.includes("Failed to fetch")) {
        console.error("Invite code error:", error);
        addToast(`Erreur: ${error.message} (${error.code || "?"})`, "error");
        return;
      }

      // Try casting to integer if not found (in case DB schema uses integer)
      if (!cafe) {
        const { data: cafeInt, error: intError } = await supabase
          .from("cafes")
          .select("*")
          .eq("invite_code", Number(inviteCode))
          .maybeSingle();

        if (cafeInt && !intError) {
          cafe = cafeInt;
        }
      }

      if (!cafe) {
        addToast(t("auth.code_incorrect"), "error");
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .eq("cafe_id", cafe.id)
        .eq("active", true);

      if (staffError) {
        console.error("Staff error:", staffError);
        addToast(`Erreur personnel: ${staffError.message}`, "error");
        return;
      }

      if (!staff || staff.length === 0) {
        addToast("Aucun employé actif trouvé pour ce café.", "error");
        return;
      }

      setCafeForStaff(cafe);
      setStaffList(staff);
      setSelectedStaff(staff[0]); // Select first staff by default to prevent silent failure
      
      // Save to offline cache
      localStorage.setItem("nook_offline_cafe", JSON.stringify(cafe));
      localStorage.setItem("nook_offline_staff", JSON.stringify(staff));
      
      setStaffStep(2);
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinPress = (val: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + val;
    setPin(newPin);
    if (newPin.length === 4) {
      handleStaffLogin(newPin);
    }
  };

  const handleStaffLogin = async (finalPin: string) => {
    if (!cafeForStaff) return;
    if (!selectedStaff) {
      addToast(
        "Veuillez sélectionner votre nom avant de saisir le code PIN.",
        "error",
      );
      setPinError(true);
      setTimeout(() => {
        setPin("");
        setPinError(false);
      }, 600);
      return;
    }

    setIsLoading(true);
    try {
      const hashed = await hashPIN(finalPin);
      if (hashed === selectedStaff.pin_hash) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 12);

        const session = {
          type: "staff",
          staff_id: selectedStaff.id,
          cafe_id: cafeForStaff.id,
          name: selectedStaff.name,
          permissions: selectedStaff.permissions,
          expires_at: expiresAt.toISOString(),
        };

        localStorage.setItem("nook_staff_session", JSON.stringify(session));
        setStaff(selectedStaff);
        setCafe(cafeForStaff);
        navigate("/dashboard");
      } else {
        setPinError(true);
        setTimeout(() => {
          setPin("");
          setPinError(false);
        }, 600);
      }
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg relative overflow-hidden">
      {/* Background Grid */}
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
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text2 hover:text-text transition-colors"
        >
          <ArrowLeft size={18} />
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

        <div className="bg-surface2 p-1 rounded-xl flex mb-8 border border-border">
          <button
            onClick={() => setRole("owner")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              role === "owner"
                ? "bg-accent-glow text-accent2 border border-accent-border"
                : "text-text3"
            }`}
          >
            <Store size={16} />
            {t("auth.owner")}
          </button>
          <button
            onClick={() => setRole("staff")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              role === "staff"
                ? "bg-accent-glow text-accent2 border border-accent-border"
                : "text-text3"
            }`}
          >
            <Users size={16} />
            {t("auth.staff")}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {role === "owner" ? (
            <motion.form
              key="owner-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleOwnerLogin}
              className="space-y-4"
            >
              <Input
                type="email"
                placeholder={t("auth.email")}
                icon={<Mail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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
              <Button type="submit" className="w-full" isLoading={isLoading}>
                {t("auth.login")}
              </Button>
              <p className="text-center text-sm text-text3 pt-2">
                {t("auth.no_account")}
                <Link
                  to="/register"
                  className="text-accent hover:underline font-medium"
                >
                  {t("auth.register_link")}
                </Link>
              </p>
            </motion.form>
          ) : (
            <motion.div
              key="staff-flow"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              {staffStep === 1 ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-text2 mb-3">
                      {t("auth.cafe_code")}
                    </label>
                    <div className="flex justify-between gap-1 sm:gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <input
                          key={i}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          maxLength={6}
                          className="w-10 sm:w-12 h-14 bg-black/25 border border-border rounded-lg text-center font-mono text-xl sm:text-2xl font-bold text-text focus:border-accent outline-none transition-colors"
                          value={inviteCode[i] || ""}
                          onFocus={(e) => e.target.select()}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData
                              .getData("text")
                              .replace(/[^0-9]/g, "")
                              .slice(0, 6);
                            if (pasted) {
                              setInviteCode(pasted);
                              const inputs =
                                e.currentTarget.parentElement?.querySelectorAll(
                                  "input",
                                );
                              const nextIndex = Math.min(pasted.length, 5);
                              if (inputs && inputs[nextIndex]) {
                                (inputs[nextIndex] as HTMLInputElement).focus();
                              }
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "");

                            if (val.length > 1) {
                              if (
                                val.length === 2 &&
                                val.startsWith(inviteCode[i] || "")
                              ) {
                                const newChar = val.slice(1);
                                const newCode = inviteCode.split("");
                                newCode[i] = newChar;
                                setInviteCode(newCode.join(""));
                                if (i < 5)
                                  (
                                    e.target.nextSibling as HTMLInputElement
                                  )?.focus();
                                return;
                              }

                              setInviteCode(val.slice(0, 6));
                              const inputs =
                                e.target.parentElement?.querySelectorAll(
                                  "input",
                                );
                              const nextIndex = Math.min(val.length, 5);
                              if (inputs && inputs[nextIndex]) {
                                (inputs[nextIndex] as HTMLInputElement).focus();
                              }
                              return;
                            }

                            const newCode = inviteCode.split("");
                            newCode[i] = val;
                            setInviteCode(newCode.join(""));

                            if (val && i < 5) {
                              (
                                e.target.nextSibling as HTMLInputElement
                              )?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Backspace" &&
                              !inviteCode[i] &&
                              i > 0
                            ) {
                              const newCode = inviteCode.split("");
                              newCode[i - 1] = "";
                              setInviteCode(newCode.join(""));
                              (
                                e.target.previousSibling as HTMLInputElement
                              )?.focus();
                            }
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-text3 mt-3">
                      {t("auth.cafe_code_hint")}
                    </p>
                  </div>
                  <Button
                    onClick={handleInviteCodeSubmit}
                    className="w-full"
                    isLoading={isLoading}
                    disabled={inviteCode.length < 6}
                  >
                    {t("common.continue")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStaffStep(1)}
                      className="p-2 -ml-2 text-text3 hover:text-text"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <h2 className="text-md font-semibold text-text">
                      {cafeForStaff?.name}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text2">
                        {t("auth.your_name")}
                      </label>
                      <div className="relative">
                        <select
                          className="input pl-11 appearance-none"
                          value={selectedStaff?.id || ""}
                          onChange={(e) =>
                            setSelectedStaff(
                              staffList.find((s) => s.id === e.target.value) ||
                                null,
                            )
                          }
                        >
                          <option value="" disabled>
                            {t("common.search")}...
                          </option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <Users
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text3"
                          size={16}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-medium text-text2">
                        {t("auth.password")}
                      </label>
                      <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text3">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setPin(val);
                            if (val.length === 4) handleStaffLogin(val);
                          }}
                          placeholder={t("auth.password")}
                          className={`input pl-11 ${
                            pinError
                              ? "border-error text-error focus:border-error focus:shadow-[0_0_0_3px_rgba(239,68,68,0.08)]"
                              : ""
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
