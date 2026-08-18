import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Store,
  DollarSign,
  Bell,
  ShoppingBag,
  Users,
  Key,
  Globe,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  Check,
  BarChart2,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useUIStore, BillTemplate } from "../stores/uiStore";
import { useTranslation, useLanguageStore } from "../i18n";
import { useAudit } from "../hooks/useAudit";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { TopBar } from "../components/layout/TopBar";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { StaffPermissions } from "../types";

export default function SettingsPage() {
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguageStore();
  const navigate = useNavigate();
  const { cafe, owner, type, staff, logout, setCafe } = useAuthStore();
  const { billTemplate, setBillTemplate, addToast, logo, setLogo } =
    useUIStore();
  const { logAction } = useAudit();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Cafe Info Form
  const [cafeName, setCafeName] = useState(cafe?.name || "");
  const [phone, setPhone] = useState(cafe?.phone || "");

  const [defaultRate, setDefaultRate] = useState<string>(
    cafe?.default_rate?.toString() || "",
  );
  const [premiumRate, setPremiumRate] = useState<string>(
    cafe?.premium_rate?.toString() || "",
  );
  const [isSavingRates, setIsSavingRates] = useState(false);

  const staffPerms = staff?.permissions as unknown as StaffPermissions | null;
  const isOwner = type === "owner";
  const canEditRates = isOwner || !!staffPerms?.rates;

  const handleSaveCafe = async () => {
    if (!cafe) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("cafes")
        .update({ name: cafeName, phone })
        .eq("id", cafe.id)
        .select()
        .single();

      if (error) throw error;

      await logAction("cafe_updated", {
        name: cafeName,
        phone,
      });

      if (data) setCafe(data);
      addToast(t("settings.info_updated"), "success");
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRates = async () => {
    if (!cafe) return;
    setIsSavingRates(true);
    try {
      const defRate = parseFloat(defaultRate);
      const premRate = parseFloat(premiumRate);
      if (isNaN(defRate) || isNaN(premRate)) {
        throw new Error("Tarifs invalides");
      }

      const { data, error } = await supabase
        .from("cafes")
        .update({ default_rate: defRate, premium_rate: premRate })
        .eq("id", cafe.id)
        .select()
        .single();

      if (error) throw error;

      await logAction("cafe_updated", {
        default_rate: defRate,
        premium_rate: premRate,
      });

      if (data) setCafe(data);
      addToast(t("settings.rates_updated"), "success");
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate("/login");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 180;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/png', 0.85);
              setLogo(compressedDataUrl);
              addToast(t("settings.logo_saved"), "success");
            }
          };
          img.src = ev.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    addToast(t("settings.logo_deleted"), "info");
  };

  const hasReportsPermission = isOwner || !!staffPerms?.reports;

  const sections = [
    {
      id: "cafe",
      icon: Store,
      title: t("settings.my_cafe"),
      content: (
        <div className="space-y-4 pt-2">
          <label className="block space-y-2">
            <span className="text-xs font-bold text-text3 uppercase">
              Logo (.png/.jpg)
            </span>
            <div className="flex flex-wrap items-center gap-4">
              {logo ? (
                <>
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-16 h-16 object-contain bg-white rounded-lg p-1.5 border border-border"
                  />
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleLogoUpload}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="pointer-events-none"
                      >
                        Changer le logo
                      </Button>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 size={14} className="me-2" /> Supprimer
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-surface2 border border-border border-dashed rounded-lg flex items-center justify-center text-text3 text-xs">
                    Aucun
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleLogoUpload}
                    />
                    <Button size="sm" className="pointer-events-none">
                      Télécharger un logo
                    </Button>
                  </div>
                </>
              )}
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold text-text3 uppercase">
              Modèle de facture
            </span>
            <div className="flex flex-col gap-2 h-auto my-1">
              <select
                className="w-full bg-black/25 border border-border rounded-xl px-4 py-3 text-sm text-text focus:border-accent outline-none appearance-none cursor-pointer"
                value={billTemplate}
                onChange={(e) => setBillTemplate(e.target.value as BillTemplate)}
              >
                <option value="standard" className="bg-surface text-text">
                  Standard (Détaillé & pro)
                </option>
                <option value="minimal" className="bg-surface text-text">
                  Minimaliste (Compact & épuré)
                </option>
                <option value="elegant" className="bg-surface text-text">
                  Élégant (Moderne & centré)
                </option>
              </select>
            </div>
          </label>

          <Input
            label="Nom du café"
            value={cafeName}
            onChange={(e) => setCafeName(e.target.value)}
          />
          <Input
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            onClick={handleSaveCafe}
            isLoading={isSaving}
            className="w-full"
          >
            Enregistrer
          </Button>
        </div>
      ),
    },
    hasReportsPermission && {
      id: "reports",
      icon: BarChart2,
      title: t("dashboard.reports"),
      onClick: () => navigate("/reports"),
    },
    canEditRates && {
      id: "rates",
      icon: DollarSign,
      title: t("settings.rates"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Standard (DH/h)"
              type="number"
              step="0.5"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
            />
            <Input
              label="Minimum (DH)"
              type="number"
              step="0.5"
              value={premiumRate}
              onChange={(e) => setPremiumRate(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSaveRates}
            isLoading={isSavingRates}
            className="w-full"
          >
            Enregistrer les tarifs
          </Button>
        </div>
      ),
    },
    {
      id: "products",
      icon: ShoppingBag,
      title: t("settings.product_catalog"),
      onClick: () => navigate("/settings/products"),
    },
    isOwner && {
      id: "staff",
      icon: Users,
      title: t("settings.team"),
      onClick: () => navigate("/settings/staff"),
    },
    isOwner && {
      id: "invite",
      icon: Key,
      title: t("settings.invite_code"),
      content: (
        <div className="space-y-4 pt-4">
          <div className="bg-black/25 border border-border rounded-xl p-4 flex items-center justify-center gap-4">
            <span className="text-2xl font-mono font-bold text-text tracking-[0.2em]">
              {cafe?.invite_code}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cafe?.invite_code || "");
                addToast(t("settings.code_copied"), "success");
              }}
              className="p-2 text-text3 hover:text-accent"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>
      ),
    },
    {
      id: "lang",
      icon: Globe,
      title: t("settings.language"),
      content: (
        <div className="space-y-2 pt-2">
          <button
            onClick={() => setLanguage("fr")}
            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
              language === "fr"
                ? "bg-accent-glow border-accent text-accent2"
                : "bg-surface2 border-border text-text"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text3">
                FR
              </div>
              <span className="text-sm font-semibold">Français</span>
            </div>
            {language === "fr" && <Check size={16} className="text-accent" />}
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
              language === "en"
                ? "bg-accent-glow border-accent text-accent2"
                : "bg-surface2 border-border text-text"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text3">
                EN
              </div>
              <span className="text-sm font-semibold">English</span>
            </div>
            {language === "en" && <Check size={16} className="text-accent" />}
          </button>
          <button
            onClick={() => setLanguage("ar")}
            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
              language === "ar"
                ? "bg-accent-glow border-accent text-accent2"
                : "bg-surface2 border-border text-text"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text3">
                AR
              </div>
              <span className="text-sm font-semibold">العربية</span>
            </div>
            {language === "ar" && <Check size={16} className="text-accent" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-bg pb-8">
      <TopBar />

      <main className="pt-20 px-4 space-y-4">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border-white/5 rounded-3xl p-6 flex flex-col gap-5 mb-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

          {/* Cafe Info */}
          <div className="flex items-center gap-5 pb-5 border-b border-white/5 relative z-10">
            <div className="w-16 h-16 bg-surface/80 border border-white/5 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-accent/5" />
              <img
                src={logo || "/favicon.svg"}
                alt="Logo"
                className="w-10 h-10 object-contain drop-shadow-md relative z-10"
              />
            </div>
            <div>
              <div className="text-lg font-bold text-text tracking-tight">
                {cafe?.name || "Mon Café"}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] font-black text-text3 uppercase tracking-[0.2em]">
                  Système Actif
                </span>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent text-sm font-black shrink-0 shadow-lg shadow-accent/5">
              {type === "owner"
                ? owner?.user_metadata?.full_name?.[0] || "O"
                : staff?.name?.[0] || "S"}
            </div>
            <div>
              <div className="text-[11px] font-black text-text3 uppercase tracking-[0.2em] mb-0.5">
                {type === "owner" ? "Propriétaire" : "Staff"}
              </div>
              <div className="text-sm font-bold text-text">
                {type === "owner"
                  ? owner?.user_metadata?.full_name || t("auth.owner")
                  : staff?.name}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Sections */}
        <div className="space-y-3">
          {sections.filter(Boolean).map((section: any) => (
            <motion.div
              key={section.id}
              layout
              className={`glass border-white/5 rounded-3xl overflow-hidden transition-all duration-300 ${expanded === section.id ? "bg-white/[0.02]" : ""}`}
            >
              <button
                onClick={() =>
                  section.onClick
                    ? section.onClick()
                    : setExpanded(expanded === section.id ? null : section.id)
                }
                className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${expanded === section.id ? "bg-accent/10 text-accent" : "bg-white/5 text-text3 group-hover:text-text group-hover:bg-white/10"}`}
                  >
                    <section.icon size={20} />
                  </div>
                  <span
                    className={`text-[13px] font-bold tracking-wide transition-colors ${expanded === section.id ? "text-text" : "text-text2 group-hover:text-text"}`}
                  >
                    {section.title}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text3 group-hover:text-text">
                  {section.onClick ? (
                    <ChevronRight size={18} className="rtl:rotate-180" />
                  ) : (
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-300 ${expanded === section.id ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              </button>
              <AnimatePresence>
                {expanded === section.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 overflow-hidden"
                  >
                    <div className="pt-2 border-t border-white/5">
                      {section.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <Button
          variant="ghost"
          className="w-full h-14 mt-8 border-error/20 text-error hover:bg-error/5"
          onClick={() => setShowLogout(true)}
        >
          <LogOut size={18} />
          {t("settings.logout")}
        </Button>
      </main>

      <ConfirmDialog
        isOpen={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={handleLogout}
        title={t("settings.logout")}
        message={t("auth.logout_confirm")}
        confirmLabel={t("settings.logout")}
        variant="danger"
      />
    </div>
  );
}
