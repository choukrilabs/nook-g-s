import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from './translations'

type Language = 'fr' | 'en' | 'ar';

interface LanguageState {
  language: Language
  isRTL: boolean
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: (localStorage.getItem('nook_lang') as Language) || 'fr',
      isRTL: ((localStorage.getItem('nook_lang') as Language) || 'fr') === 'ar',
      setLanguage: (lang) => {
        localStorage.setItem('nook_lang', lang);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        set({ language: lang, isRTL: lang === 'ar' });
      },
    }),
    {
      name: 'nook-language-storage',
    }
  )
)

// Initialize DOM on load
const initialLang = (localStorage.getItem('nook_lang') as Language) || 'fr';
document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = initialLang;


export const useTranslation = () => {
  const { language } = useLanguageStore()
  
  const t = (key: string) => {
    const keys = key.split('.')
    let current: any = translations[language]
    
    for (const k of keys) {
      if (!current || current[k] === undefined) {
        // Fallback to French if key missing in current language
        let fallback: any = translations['fr']
        for (const fk of keys) {
          if (!fallback || fallback[fk] === undefined) return key
          fallback = fallback[fk]
        }
        return fallback
      }
      current = current[k]
    }
    
    return current
  }

  return { t, language }
}
