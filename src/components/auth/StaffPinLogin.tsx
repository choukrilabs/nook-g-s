import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Users, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { useTranslation } from "../../i18n";
import { Button } from "../ui/Button";
import { Staff, Cafe } from "../../types";
import { useOfflineLoginCache } from "../../hooks/useOfflineLoginCache";

import { createOfflinePINHash } from "../../lib/crypto";

export function StaffPinLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setStaff, setCafe } = useAuthStore();
  const { addToast } = useUIStore();
  const { handleOfflineStaffLogin } = useOfflineLoginCache();

  const [isLoading, setIsLoading] = useState(false);
  const [staffStep, setStaffStep] = useState<1 | 2>(1);
  const [inviteCode, setInviteCode] = useState("");
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [cafeForStaff, setCafeForStaff] = useState<Cafe | { id: string; name: string; setup_complete: boolean } | null>(null);

  const handleInviteCodeSubmit = async () => {
    if (inviteCode.length < 8) return;
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
      const success = await handleOfflineStaffLogin(selectedStaff.id, cafeForStaff.id, cafeForStaff, finalPin);
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
        const success = await handleOfflineStaffLogin(selectedStaff.id, cafeForStaff.id, cafeForStaff, finalPin);
        if (success) return;
      }

      if (error) {
        console.error("Staff PIN login error:", error);
        if (error.message?.includes("account_locked")) {
          addToast(t("auth.account_locked") || "Compte verrouillé. Réessayez dans 15 minutes.", "error");
        } else {
          setPinError(true);
        }
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
      
      const { hash: offline_pin_hash, salt: offline_pin_salt } = await createOfflinePINHash(finalPin);

      const session = {
        type: "staff",
        staff_id: staffResult.id,
        cafe_id: cafeForStaff.id,
        name: staffResult.name,
        permissions: staffResult.permissions,
        offline_pin_hash,
        offline_pin_salt,
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
        failed_attempts: 0,
        locked_until: null
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
          const success = await handleOfflineStaffLogin(selectedStaff.id, cafeForStaff.id, cafeForStaff, finalPin);
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
            <div className="flex justify-center">
              <input
                type="text"
                autoComplete="off"
                maxLength={8}
                placeholder="Ex: A1B2C3D4"
                className="w-full h-14 bg-black/25 border border-border rounded-lg text-center font-mono text-xl sm:text-2xl font-bold text-text focus:border-accent outline-none transition-colors uppercase"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              />
            </div>
            <p className="text-xs text-text3 mt-3">
              {t("auth.cafe_code_hint")}
            </p>
          </div>
          <Button
            onClick={handleInviteCodeSubmit}
            className="w-full"
            isLoading={isLoading}
            disabled={inviteCode.length < 8}
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
  );
}
