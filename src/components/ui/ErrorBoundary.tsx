import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home, ShieldCheck, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  key?: React.Key;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

// Resilient localized strings for fallback display even if i18n context is broken
const fallbackTranslations: Record<string, {
  title: string;
  subtitle: string;
  queueSafe: string;
  reload: string;
  home: string;
  details: string;
  hideDetails: string;
  copyError: string;
  copied: string;
}> = {
  fr: {
    title: "Interruption inattendue",
    subtitle: "L'application a rencontré un problème d'affichage. Vos données de session et la file d'attente hors ligne sont préservées en toute sécurité.",
    queueSafe: "Données de caisse & file d'attente hors ligne intactes",
    reload: "Recharger l'application",
    home: "Retour au tableau de bord",
    details: "Afficher les détails techniques",
    hideDetails: "Masquer les détails",
    copyError: "Copier le rapport d'erreur",
    copied: "Copié !",
  },
  en: {
    title: "Unexpected Interruption",
    subtitle: "The application encountered a display error. Your session data and offline queue remain safely preserved.",
    queueSafe: "Till data & offline queue safe and intact",
    reload: "Reload Application",
    home: "Return to Dashboard",
    details: "Show technical details",
    hideDetails: "Hide details",
    copyError: "Copy error report",
    copied: "Copied!",
  },
  ar: {
    title: "انقطاع غير متوقع",
    subtitle: "واجه التطبيق مشكلة في العرض. بيانات الجلسات وقائمة العمليات غير المتصلة محفوظة بأمان تام في الذاكرة المحلية.",
    queueSafe: "بيانات الصندوق وقائمة الانتظار غير المتصلة محفوظة",
    reload: "إعادة تحميل التطبيق",
    home: "العودة إلى لوحة التحكم",
    details: "عرض التفاصيل التقنية",
    hideDetails: "إخفاء التفاصيل",
    copyError: "نسخ تقرير الخطأ",
    copied: "تم النسخ!",
  },
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by top-level POS ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    // Preserve local IndexedDB and localStorage queue, simply reload the view
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
    // Navigate home if possible
    if (window.location.pathname !== "/dashboard" && window.location.pathname !== "/") {
      window.location.href = "/dashboard";
    }
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorReport = `[Nook POS Error Report]
Time: ${new Date().toISOString()}
URL: ${window.location.href}
Online: ${navigator.onLine}
Error: ${error?.name}: ${error?.message}
Stack:
${error?.stack || "N/A"}
Component Stack:
${errorInfo?.componentStack || "N/A"}`;

    navigator.clipboard?.writeText(errorReport).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      let lang = "fr";
      try {
        lang = localStorage.getItem("nook_language") || "fr";
        if (!fallbackTranslations[lang]) lang = "fr";
      } catch {
        lang = "fr";
      }

      const t = fallbackTranslations[lang] || fallbackTranslations.fr;
      const isRTL = lang === "ar";
      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div
          dir={isRTL ? "rtl" : "ltr"}
          className="min-h-screen bg-bg text-text flex items-center justify-center p-4 sm:p-6 select-none"
        >
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Subtle top indicator bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-warning via-danger to-warning opacity-80" />

            {/* Error Icon & Header */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text tracking-tight">
                  {t.title}
                </h1>
                <p className="text-xs text-text3 mt-0.5">
                  POS Recovery Shield • Code: {error?.name || "RuntimeError"}
                </p>
              </div>
            </div>

            {/* Reassurance Banner for Till / Offline Safety */}
            <div className="mb-6 bg-success/10 border border-success/20 rounded-xl p-3.5 flex items-start gap-3 text-start">
              <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div className="text-xs text-text leading-relaxed">
                <span className="font-semibold text-success block mb-0.5">
                  {t.queueSafe}
                </span>
                {t.subtitle}
              </div>
            </div>

            {/* Primary & Secondary Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full h-12 rounded-xl bg-accent text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-accent/20 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 rtl:rotate-180" />
                <span>{t.reload}</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full h-11 rounded-xl bg-surface2 border border-border text-text2 font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:bg-border/60 hover:text-text active:scale-[0.98] cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>{t.home}</span>
              </button>
            </div>

            {/* Collapsible Technical Details (Clean Mono Box) */}
            <div className="mt-6 pt-5 border-t border-border">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="w-full flex items-center justify-between text-xs text-text3 hover:text-text transition-colors py-1 cursor-pointer"
              >
                <span className="font-medium">
                  {showDetails ? t.hideDetails : t.details}
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showDetails && (
                <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                  <div className="p-3 bg-bg/80 border border-border/80 rounded-xl text-[11px] font-mono text-danger/90 overflow-x-auto max-h-48 scrollbar-thin">
                    <p className="font-bold mb-1">
                      {error?.name}: {error?.message}
                    </p>
                    {error?.stack && (
                      <pre className="text-text3/80 whitespace-pre-wrap text-[10px]">
                        {error.stack}
                      </pre>
                    )}
                    {errorInfo?.componentStack && (
                      <pre className="text-text3/60 whitespace-pre-wrap text-[9px] mt-2 pt-2 border-t border-border/50">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-text3 hover:text-text px-2 py-1 rounded-lg hover:bg-surface2 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? t.copied : t.copyError}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
