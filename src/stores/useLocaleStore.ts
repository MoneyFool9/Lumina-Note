import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Locale, getTranslations, detectSystemLocale, Translations } from '@/i18n';

interface LocaleState {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

// 获取保存的语言或检测系统语言
function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem('lumina-locale');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.state?.locale) {
        return parsed.state.locale as Locale;
      }
    }
  } catch {}
  return detectSystemLocale();
}

const initialLocale = getInitialLocale();

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: initialLocale,
      t: getTranslations(initialLocale),
      setLocale: (locale: Locale) => {
        set({
          locale,
          t: getTranslations(locale),
        });
      },
    }),
    {
      name: 'lumina-locale',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
);
