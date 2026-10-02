"use client";

import { cloneElement, createContext, createElement, isValidElement, useContext, useMemo, type ReactNode } from "react";
import { createWorkshopLanguage, type WorkshopLanguage } from "@/lib/motion/workshop-language";

const WorkshopLanguageContext = createContext(createWorkshopLanguage("en"));

export function WorkshopLanguageProvider({ language, children }: { language: WorkshopLanguage; children?: ReactNode }) {
  const value = useMemo(() => createWorkshopLanguage(language), [language]);
  return createElement(WorkshopLanguageContext.Provider, { value }, children);
}

export function useWorkshopLanguage() {
  return useContext(WorkshopLanguageContext);
}

/** Translates existing static JSX. Components translate their own rendered labels via the hook. */
export function translateWorkshopTree(node: ReactNode, language: WorkshopLanguage): ReactNode {
  if (language === "en") return node;
  const { t } = createWorkshopLanguage(language);
  const visit = (child: ReactNode): ReactNode => {
    if (typeof child === "string") return t(child);
    if (Array.isArray(child)) return child.map(visit);
    if (!isValidElement<Record<string, unknown>>(child) || child.props["data-workshop-translate"] === "false") return child;
    const props: Record<string, unknown> = {};
    if (typeof child.type === "string") {
      for (const key of ["aria-label", "title", "placeholder", "alt", ...(child.type === "optgroup" ? ["label"] : [])]) {
        if (typeof child.props[key] === "string") props[key] = t(child.props[key]);
      }
    }
    if (child.props.children !== undefined) props.children = visit(child.props.children as ReactNode);
    return cloneElement(child, props);
  };
  return visit(node);
}
