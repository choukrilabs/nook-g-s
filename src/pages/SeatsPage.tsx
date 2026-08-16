import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import { motion } from "motion/react";
import { ChevronLeft, Armchair } from "lucide-react";

export default function SeatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cafe } = useAuthStore();
  const { activeSessions } = useSessionStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!cafe) return null;

  const totalSeats = cafe.total_seats;
  const seats = Array.from({ length: totalSeats }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="fixed top-0 inset-x-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center justify-between px-4">
        <button onClick={() => navigate(-1)} className="p-2 -ms-2 text-text3 hover:text-text">
          <ChevronLeft size={20} className="rtl:rotate-180" />
        </button>
        <h1 className="text-sm font-bold text-text">État des places</h1>
        <div className="w-8"></div> {/* Spacer to center title */}
      </header>

      <div className="p-4 pt-20">
        <div className="flex gap-4 mb-6 text-sm text-text2 font-medium">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            Disponible
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error"></div>
            Occupée
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {seats.map((seat) => {
            const session = activeSessions.find((s) => s.seat_number === seat);
            const isOccupied = !!session;

            let timeStr = "";
            let moneyStr = "";

            if (session) {
              const start = new Date(session.started_at).getTime();
              const elapsedMinutes = Math.max(
                0,
                Math.floor((now - start) / 1000 / 60),
              );
              const hours = Math.floor(elapsedMinutes / 60);
              const mins = elapsedMinutes % 60;
              timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

              const timeCost = (elapsedMinutes / 60) * session.rate_per_hour;
              const total = timeCost + session.extras_total;
              moneyStr = `${total.toFixed(2)} DH`;
            }

            return (
              <motion.div
                key={seat}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (session) {
                    navigate(`/sessions/${session.id}`);
                  } else {
                    navigate(`/sessions/new`, {
                      state: { preselectedSeat: seat },
                    });
                  }
                }}
                className={`relative overflow-hidden rounded-xl p-4 border ${
                  isOccupied
                    ? "bg-error-dim border-error/30 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    : "bg-success-dim border-success/30 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`p-2 rounded-lg ${isOccupied ? "bg-error/20 text-error" : "bg-success/20 text-success"}`}
                  >
                    <Armchair size={20} />
                  </div>
                  <span
                    className={`text-xl font-mono font-bold ${isOccupied ? "text-error" : "text-success"}`}
                  >
                    N°{seat}
                  </span>
                </div>

                {isOccupied ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-text truncate">
                      {session.customer_name}
                    </p>
                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-error/20">
                      <span className="text-[11px] font-mono text-error/80">
                        {timeStr}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-error">
                        {moneyStr}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 mt-2 border-t border-success/20">
                    <p className="text-[11px] font-medium text-success/80">
                      Libre
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
