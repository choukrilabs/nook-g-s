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
import { Staff, Cafe } from "../types";

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

  const locationState = location.state as { defaultRole?: "owner" | "staff" } | null;
  const [role, setRole] = useState<"owner" | "staff">(
    locationState?.defaultRole || "owner",
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
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [cafeForStaff, setCafeForStaff] = useState<Cafe | { id: string; name: string; setup_complete: boolean } | null>(null);

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
        addToast(t("auth.offline_unrecognized_code"), "error");
        setIsLoading(false);
        return;
      }

      // Step 1: lookup café by invite code via RPC
      const { data: cafeData, error } = await supabase.rpc("lookup_cafe_by_invite", {
        p_code: inviteCode,
      });

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
        addToast(`${t("auth.login_error_prefix")}${error.message} (${error.code || "?"})`, "error");
        return;
      }

      const cafe = cafeData && cafeData.length > 0 ? cafeData[0] : null;

      if (!cafe) {
        addToast(t("auth.code_incorrect"), "error");
        return;
      }

      // Step 2: list staff for login (public RPC, excludes pin_hash)
      const { data: staffData, error: staffError } = await supabase.rpc("list_staff_for_login", {
        p_cafe_id: cafe.id,
      });

      if (staffError) {
        console.error("Staff error:", staffError);
        addToast(`${t("auth.staff_error")}${staffError.message}`, "error");
        return;
      }

      const staff = staffData || [];

      if (!staff || staff.length === 0) {
        addToast(t("auth.no_active_staff"), "error");
        return;
      }

      setCafeForStaff(cafe);
      setStaffList(staff);
      setSelectedStaff(staff[0]);

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

  const handleOfflineStaffLogin = (staffId: string, cafeId: string): boolean => {
    try {
      const cachedSessionStr =
        localStorage.getItem(`nook_offline_staff_session_${staffId}`) ||
        localStorage.getItem("nook_staff_session");

      if (cachedSessionStr) {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && cached.staff_id === staffId && cached.cafe_id === cafeId) {
          const expiresAt = new Date(cached.expires_at || 0);
          const cachedAt = new Date(cached.cached_at || cached.expires_at || 0);
          const now = new Date();

          // Session is valid if expires_at is future OR cached verification is under 48 hours
          const isStillValid =
            expiresAt > now ||
            now.getTime() - cachedAt.getTime() < 48 * 3600 * 1000;

          if (isStillValid) {
            const freshExpiresAt = new Date();
            freshExpiresAt.setHours(freshExpiresAt.getHours() + 12);

            const session = {
              type: "staff",
              staff_id: cached.staff_id,
              cafe_id: cached.cafe_id,
              name: cached.name,
              permissions: cached.permissions || {
                sessions: true,
                reports: false,
                clients: false,
                settings: false,
              },
              cached_at: cached.cached_at || new Date().toISOString(),
              expires_at: freshExpiresAt.toISOString(),
            };

            localStorage.setItem("nook_staff_session", JSON.stringify(session));
            localStorage.setItem(`nook_offline_staff_session_${staffId}`, JSON.stringify(session));
            
            const staffObj: Staff = {
              id: session.staff_id,
              cafe_id: session.cafe_id,
              name: session.name,
              permissions: session.permissions,
              phone: null,
              pin_hash: '',
              active: true,
              last_login_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };
            setStaff(staffObj);
            if (cafeForStaff) setCafe(cafeForStaff as Cafe);
            addToast(t("common.offline"), "info");
            navigate("/dashboard");
            return true;
          } else {
            addToast(t("auth.offline_session_expired"), "error");
            return false;
          }
        }
      }
      addToast(t("auth.offline_first_login_required"), "error");
      return false;
    } catch (e) {
      console.error("Offline staff login error:", e);
      addToast(t("auth.offline_first_login_required"), "error");
      return false;
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

    // If device is offline, check cached valid session token for this staff member
    if (!navigator.onLine) {
      const success = handleOfflineStaffLogin(selectedStaff.id, cafeForStaff.id);
      setIsLoading(false);
      if (!success) {
        setPinError(true);
        setTimeout(() => {
          setPin("");
          setPinError(false);
        }, 600);
      }
      return;
    }

    try {
      // Step 3: on PIN entry — sign in anonymously FIRST, then verify via staff_pin_login RPC
      const { error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) {
        console.warn("Anonymous sign in warning:", anonError);
      }

      const { data, error } = await supabase.rpc("staff_pin_login", {
        p_cafe_id: cafeForStaff.id,
        p_staff_id: selectedStaff.id,
        p_pin: finalPin,
      });

      // If network failure during RPC call, attempt offline cached session login
      if (
        error &&
        (error.message?.includes("Failed to fetch") ||
          error.message?.includes("network") ||
          error.message?.includes("NetworkError"))
      ) {
        const success = handleOfflineStaffLogin(selectedStaff.id, cafeForStaff.id);
        if (success) return;
      }

      if (error) {
        console.error("Staff PIN login error:", error);
        setPinError(true);
        setTimeout(() => {
          setPin("");
          setPinError(false);
        }, 600);
        return;
      }

      const staffResult = data && data.length > 0 ? data[0] : null;

      if (!staffResult) {
        setPinError(true);
        setTimeout(() => {
          setPin("");
          setPinError(false);
        }, 600);
        return;
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12);

      const session = {
        type: "staff",
        staff_id: staffResult.id,
        cafe_id: cafeForStaff.id,
        name: staffResult.name,
        permissions: staffResult.permissions,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      // Store both active session and per-staff persistent offline verification token
      localStorage.setItem("nook_staff_session", JSON.stringify(session));
      localStorage.setItem(`nook_offline_staff_session_${staffResult.id}`, JSON.stringify(session));

      const staffObj: Staff = {
        id: staffResult.id,
        cafe_id: cafeForStaff.id,
        name: staffResult.name,
        permissions: staffResult.permissions,
        phone: null,
        pin_hash: '',
        active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      setStaff(staffObj);
      setCafe(cafeForStaff as Cafe);
      navigate("/dashboard");
    } catch (error: any) {
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("network") ||
        !navigator.onLine
      ) {
        if (selectedStaff && cafeForStaff) {
          const success = handleOfflineStaffLogin(selectedStaff.id, cafeForStaff.id);
          if (success) return;
        }
      }

      addToast(error.message || "Erreur de connexion", "error");
      setPinError(true);
      setTimeout(() => {
        setPin("");
        setPinError(false);
      }, 600);
    } finally {
      setIsLoading(false);
    }
  };

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
                                e.currentTarget.previousElementSibling as HTMLInputElement
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
                      className="p-2 -ms-2 text-text3 hover:text-text"
                    >
                      <ArrowLeft size={18} className="rtl:rotate-180" />
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
                          className="input ps-11 appearance-none"
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
                          className="absolute start-3.5 top-1/2 -translate-y-1/2 text-text3"
                          size={16}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-medium text-text2">
                        {t("auth.password")}
                      </label>
                      <div className="relative w-full">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-text3">
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
                          className={`input ps-11 ${
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
