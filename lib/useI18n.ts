'use client';

import { useCallback } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { translate, translateLabel, translateOption, type MessageKey } from './i18n';

export function useI18n() {
  const locale = useUIStore((state) => state.locale);
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  const label = useCallback((value: string) => translateLabel(locale, value), [locale]);
  const option = useCallback((value: string) => translateOption(locale, value), [locale]);
  return { locale, t, label, option };
}
