"use client";

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { createWorkshopLanguage, type WorkshopLanguage } from "@/lib/motion/workshop-language";

const WorkshopLanguageContext = createContext(createWorkshopLanguage("en"));

export function WorkshopLanguageProvider({ language, children }: { language: WorkshopLanguage; children?: ReactNode }) {
  const value = useMemo(() => createWorkshopLanguage(language), [language]);
  return createElement(WorkshopLanguageContext.Provider, { value }, children);
}

export function useWorkshopLanguage() {
  return useContext(WorkshopLanguageContext);
}
