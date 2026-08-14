import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  User,
  Phone,
  Armchair,
  Clock as ClockIcon,
  Zap,
  Sliders,
  Play,
  Loader2,
  MessageSquare,
  ChevronDown,
  UserPlus,
  ChevronLeft,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useTranslation } from "../i18n";
import { useAudit } from "../hooks/useAudit";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Session, Product } from "../types";
import { format } from "date-fns";
import { queueMutation } from "../lib/offlineSync";
import { db } from "../lib/offlineDB";

export default function NewSessionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    clientName?: string;
    clientPhone?: string;
    clientId?: string;
    preselectedSeat?: number;
  } | null;

  const { cafe, staff, type, owner } = useAuthStore();
  const { activeSessions } = useSessionStore();
  const addToast = useUIStore((state) => state.addToast);
  const { logAction } = useAudit();

  const [isLoading, setIsLoading] = useState(false);
  const [customerName, setCustomerName] = useState(state?.clientName || "");
  const [customerPhone, setCustomerPhone] = useState(state?.clientPhone || "");
  const [clientId, setClientId] = useState(state?.clientId || null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(
    state?.preselectedSeat || null,
  );
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [saveAsClient, setSaveAsClient] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState<string[]>([]);
  const [sessionMode, setSessionMode] = useState<"time" | "consumption" | null>(
    null,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    const loadRecent = async () => {
      if (!cafe) return;

      if (!navigator.onLine) {
        const sessions = await db.sessions.toArray();
        const unique = Array.from(
          new Set(sessions.map((s) => s.customer_name)),
        ).slice(0, 6);
        setRecentCustomers(unique);
        return;
      }

      const { data } = await supabase
        .from("sessions")
        .select("customer_name")
        .eq("cafe_id", cafe.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        const unique = Array.from(
          new Set(data.map((s) => s.customer_name)),
        ).slice(0, 6);
        setRecentCustomers(unique);
      }
    };
    loadRecent();

    const loadProducts = async () => {
      if (!cafe) return;

      if (!navigator.onLine) {
        const localProducts = await db.products
          .where("active")
          .equals(1)
          .toArray();
        // Wait, Dexie boolean might be true/false or 1/0.
        // Let's just fetch all and filter in memory to be safe:
        const allProds = await db.products.toArray();
        setProducts(
          allProds
            .filter((p) => p.active)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        );
        return;
      }

      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("cafe_id", cafe.id)
        .eq("active", true)
        .order("sort_order");
      if (data) {
        setProducts(data);
        db.products.bulkPut(data);
      }
    };
    loadProducts();
  }, [cafe]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 10) val = val.slice(0, 10);

    const parts = [];
    for (let i = 0; i < val.length; i += 2) {
      parts.push(val.slice(i, i + 2));
    }
    setCustomerPhone(parts.join(" "));
  };

  const handleStartSession = async () => {
    if (!cafe || !customerName || !selectedSeat) return;

    // Check if seat is already occupied
    if (activeSessions.some((s) => s.seat_number === selectedSeat)) {
      addToast("Cette place est déjà occupée", "error");
      return;
    }

    setIsLoading(true);
    try {
      let finalClientId = clientId;

      if (saveAsClient && !clientId) {
        const { data: clientData, error: clientError } = await supabase
          .from("client_accounts")
          .insert({
            cafe_id: cafe.id,
            name: customerName,
            phone: customerPhone || null,
            balance: 0,
            total_visits: 0,
            total_spent: 0,
          })
          .select()
          .single();

        if (clientError) throw clientError;
        if (clientData) {
          finalClientId = clientData.id;
          await logAction("client_created", {
            client_id: finalClientId,
            name: customerName,
          });
        }
      }

      const rate = sessionMode === "consumption" ? 0 : cafe.default_rate;

      let newExtras: any[] = [];
      let newExtrasTotal = 0;

      if (sessionMode === "consumption") {
        Object.entries(selectedExtras).forEach(([prodId, qty]) => {
          const qtyNum = qty as number;
          if (qtyNum <= 0) return;
          const product = products.find((p) => p.id === prodId);
          if (product) {
            newExtras.push({
              id: prodId,
              name: product.name,
              price: product.price,
              qty: qtyNum,
            });
            newExtrasTotal += product.price * qtyNum;
          }
        });
      }

      const sessionPayload = {
        id: crypto.randomUUID(),
        cafe_id: cafe.id,
        staff_id: type === "staff" ? staff?.id : null,
        client_account_id: finalClientId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        seat_number: selectedSeat,
        rate_per_hour: rate,
        status: "active",
        notes: notes || null,
        extras: newExtras,
        extras_total: newExtrasTotal,
        total_amount: newExtrasTotal,
        started_at: new Date().toISOString(),
      };

      await queueMutation("sessions", "insert", sessionPayload, sessionPayload);

      try {
        await logAction("session_started", {
          customer_name: customerName,
          seat_number: selectedSeat,
          rate_per_hour: rate,
        });
      } catch (e) {
        // Log might fail offline, ignore
      }

      addToast(`Session démarrée — Place ${selectedSeat}`, "success");
      navigate("/dashboard");
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const occupiedSeats = activeSessions.map((s) => s.seat_number);

  if (sessionMode === null) {
    const activeUserName =
      type === "owner"
        ? owner?.user_metadata?.full_name || "Propriétaire"
        : staff?.name;

    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-3 bg-surface border border-border rounded-full text-text3 hover:text-text transition-all active:scale-95 shadow-sm"
        >
          <X size={24} />
        </button>

        <div className="mb-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center mb-5 shadow-[0_8px_32px_rgba(249,115,22,0.3)] border-2 border-white/10">
            <span className="text-white font-black text-4xl">N</span>
          </div>
          <h1 className="text-2xl font-black text-text tracking-tight mb-1">
            {cafe?.name}
          </h1>
          <div className="flex items-center gap-2 text-sm text-text3 bg-surface/50 px-4 py-1.5 rounded-full border border-border/50 backdrop-blur-sm mt-3">
            <User size={14} className="text-accent2" />
            <span className="font-medium text-text2">{activeUserName}</span>
            <div className="w-1 h-1 rounded-full bg-border mx-1" />
            <Phone size={14} className="text-accent2" />
            <span className="font-medium text-text2 font-mono">
              {cafe?.phone || "Pas de téléphone"}
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 fill-mode-both">
          <button
            onClick={() => setSessionMode("time")}
            className="w-full p-6 bg-surface border border-border hover:border-accent hover:bg-accent-glow hover:shadow-[0_4px_24px_rgba(249,115,22,0.15)] rounded-2xl flex flex-col items-center text-center transition-all duration-300 active:scale-95 group"
          >
            <div className="w-16 h-16 rounded-full bg-surface2 border border-border flex items-center justify-center text-text3 group-hover:text-accent group-hover:bg-accent/10 group-hover:border-accent/20 transition-all duration-300 mb-4 group-hover:scale-110">
              <ClockIcon size={32} />
            </div>
            <h3 className="text-lg font-bold text-text mb-2 tracking-tight">
              Tarification au Temps
            </h3>
            <p className="text-sm text-text3 group-hover:text-text2 transition-colors">
              Idéal pour les clients qui s'installent pour travailler. (Tarif
              horaire)
            </p>
          </button>

          <button
            onClick={() => setSessionMode("consumption")}
            className="w-full p-6 bg-surface border border-border hover:border-accent hover:bg-accent-glow hover:shadow-[0_4px_24px_rgba(249,115,22,0.15)] rounded-2xl flex flex-col items-center text-center transition-all duration-300 active:scale-95 group"
          >
            <div className="w-16 h-16 rounded-full bg-surface2 border border-border flex items-center justify-center text-text3 group-hover:text-accent group-hover:bg-accent/10 group-hover:border-accent/20 transition-all duration-300 mb-4 group-hover:scale-110">
              <ShoppingBag size={32} />
            </div>
            <h3 className="text-lg font-bold text-text mb-2 tracking-tight">
              Consommation Seule
            </h3>
            <p className="text-sm text-text3 group-hover:text-text2 transition-colors">
              Pour les clients de passage. Pas de tarif horaire appliqué.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      <header className="fixed top-0 left-0 right-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center justify-between px-4">
        <button
          onClick={() => setSessionMode(null)}
          className="p-2 -ml-2 text-text3 hover:text-text"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-bold text-text">
          {sessionMode === "time" ? "Au Temps" : "À la Consommation"}
        </h1>
        <div className="w-8" />
      </header>

      <main className="pt-20 px-4 space-y-8">
        {/* Client Section */}
        <section className="space-y-4">
          <label className="text-[10px] font-bold text-text3 uppercase tracking-widest">
            {t("sessions.client")}
          </label>
          <div className="space-y-3">
            <Input
              placeholder="Nom du client"
              icon={<User size={18} />}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-14 text-lg"
              autoFocus
              rightElement={
                customerName && (
                  <button
                    onClick={() => setCustomerName("")}
                    className="text-text3"
                  >
                    <X size={16} />
                  </button>
                )
              }
            />

            <div className="flex flex-col gap-3">
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="06 00 00 00 00"
                icon={<Phone size={18} />}
                value={customerPhone}
                onChange={handlePhoneChange}
                className="h-14 text-[19px] tracking-widest font-mono font-bold"
                rightElement={
                  customerPhone && (
                    <button
                      onClick={() => setCustomerPhone("")}
                      className="text-text3 p-1"
                    >
                      <X size={16} />
                    </button>
                  )
                }
              />

              {!clientId && customerName && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <button
                      onClick={() => setSaveAsClient(!saveAsClient)}
                      className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all active:scale-[0.98] ${
                        saveAsClient
                          ? "bg-accent-glow border-accent"
                          : "bg-surface border-border hover:border-text3"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${saveAsClient ? "bg-accent text-white" : "bg-surface2 text-text3"}`}
                        >
                          <UserPlus size={18} />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-text">
                            Nouveau compte client
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${saveAsClient ? "text-accent2" : "text-text3"}`}
                          >
                            Enregistrer pour de futures visites
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-11 h-6 rounded-full relative transition-colors ${saveAsClient ? "bg-accent" : "bg-border"}`}
                      >
                        <motion.div
                          animate={{ x: saveAsClient ? 22 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </button>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </section>

        {/* Seat Grid */}
        <section className="space-y-4">
          <label className="text-[10px] font-bold text-text3 uppercase tracking-widest">
            Sélectionner une place
          </label>
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: cafe?.total_seats || 20 }).map((_, i) => {
              const seatNum = i + 1;
              const isOccupied = occupiedSeats.includes(seatNum);
              const isSelected = selectedSeat === seatNum;

              return (
                <motion.button
                  key={seatNum}
                  whileTap={!isOccupied ? { scale: 0.92 } : {}}
                  onClick={() => !isOccupied && setSelectedSeat(seatNum)}
                  className={`h-14 flex flex-col items-center justify-center rounded-xl border transition-all relative ${
                    isOccupied
                      ? "bg-error/5 border-error/20 text-error/40 cursor-not-allowed"
                      : isSelected
                        ? "bg-accent-glow border-accent text-accent2 shadow-[0_0_12px_rgba(249,115,22,0.2)] scale-105 z-10"
                        : "bg-surface border-border text-text2 hover:border-text3"
                  }`}
                >
                  <span className="text-lg font-mono font-bold">{seatNum}</span>
                  {isOccupied && (
                    <span className="text-[8px] font-bold uppercase absolute bottom-1">
                      Occ.
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

        {sessionMode === "consumption" && (
          <section className="space-y-4">
            <label className="text-[10px] font-bold text-text3 uppercase tracking-widest">
              Produits consommés
            </label>
            <div className="space-y-6">
              {["boisson", "nourriture", "autre"].map((cat) => {
                const catProducts = products.filter((p) => p.category === cat);
                if (catProducts.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="text-[11px] font-bold text-text3 uppercase tracking-widest mb-3">
                      {cat === "boisson"
                        ? "Boissons"
                        : cat === "nourriture"
                          ? "Nourriture"
                          : "Autre"}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {catProducts.map((p) => (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border transition-all ${
                            selectedExtras[p.id]
                              ? "bg-accent-glow border-accent"
                              : "bg-surface2 border-border"
                          }`}
                        >
                          <div className="text-sm font-bold text-text mb-1 truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-accent2 font-mono mb-3">
                            {p.price.toFixed(2)} DH
                          </div>
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() =>
                                setSelectedExtras((prev) => ({
                                  ...prev,
                                  [p.id]: Math.max(0, (prev[p.id] || 0) - 1),
                                }))
                              }
                              className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text2 border border-border hover:bg-bg"
                            >
                              -
                            </button>
                            <span className="text-sm font-bold font-mono">
                              {selectedExtras[p.id] || 0}
                            </span>
                            <button
                              onClick={() =>
                                setSelectedExtras((prev) => ({
                                  ...prev,
                                  [p.id]: (prev[p.id] || 0) + 1,
                                }))
                              }
                              className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text2 border border-border hover:bg-bg"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {products.length === 0 && (
                <div className="p-4 text-center text-text3 text-sm bg-surface2 border border-border rounded-xl">
                  Aucun produit dans le catalogue.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Notes Section */}
        <section className="space-y-2">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-2 text-text3 hover:text-text2 transition-colors"
          >
            <MessageSquare size={16} />
            <span className="text-xs font-medium">Ajouter une note</span>
            <ChevronDown
              size={14}
              className={`transition-transform ${showNotes ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence>
            {showNotes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <textarea
                  className="input h-24 py-3 resize-none"
                  placeholder="Note interne..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-linear-to-t from-bg via-bg to-transparent pt-12 z-50">
        <AnimatePresence>
          {customerName && selectedSeat && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mb-4 p-4 bg-surface2 border border-accent-border rounded-xl flex items-center justify-between"
            >
              <div>
                <div className="text-[10px] text-text3 font-bold uppercase tracking-widest mb-1">
                  Aperçu
                </div>
                <div className="text-sm font-bold text-text">
                  {customerName} — Place {selectedSeat}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-accent2">
                  {cafe?.default_rate} DH/h
                </div>
                <div className="text-[10px] text-text3">
                  Début: {format(new Date(), "HH:mm")}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          onClick={handleStartSession}
          className="w-full h-14 text-lg"
          disabled={!customerName || !selectedSeat}
          isLoading={isLoading}
        >
          <Play size={20} className="fill-current" />
          {t("sessions.start")}
        </Button>
      </div>
    </div>
  );
}
