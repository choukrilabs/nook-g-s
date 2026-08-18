import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import { useTranslation } from "../i18n";
import { Staff, Cafe } from "../types";
import { useNavigate } from "react-router-dom";
import { verifyOfflinePIN } from "../lib/crypto";

export function useOfflineLoginCache() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setStaff, setCafe } = useAuthStore();
  const { addToast } = useUIStore();

  const handleOfflineStaffLogin = async (staffId: string, cafeId: string, cafeForStaff: Cafe | { id: string; name: string; setup_complete: boolean } | null, pin: string): Promise<boolean> => {
    try {
      const cachedSessionStr =
        localStorage.getItem(`nook_offline_staff_session_${staffId}`) ||
        localStorage.getItem("nook_staff_session");

      if (cachedSessionStr) {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && cached.staff_id === staffId && cached.cafe_id === cafeId) {
          
          if (cached.offline_pin_hash && cached.offline_pin_salt) {
            const isPinValid = await verifyOfflinePIN(pin, cached.offline_pin_salt, cached.offline_pin_hash);
            if (!isPinValid) {
              addToast(t("auth.code_incorrect"), "error");
              return false;
            }
          } else {
            addToast(t("auth.offline_first_login_required"), "error");
            return false;
          }

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
              failed_attempts: 0,
              locked_until: null
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

  return { handleOfflineStaffLogin };
}
