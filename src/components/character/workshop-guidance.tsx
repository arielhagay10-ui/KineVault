"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

const GuidanceContext = createContext(false);
export function WorkshopGuidanceProvider({ enabled, children }: { enabled: boolean; children?: ReactNode }) {
  return <GuidanceContext.Provider value={enabled}>{children}</GuidanceContext.Provider>;
}
export function WorkshopGuidance({ essential = false, ...props }: ComponentProps<"p"> & { essential?: boolean }) {
  const enabled = useContext(GuidanceContext);
  return enabled || essential ? <p data-workshop-guidance data-workshop-essential={essential || undefined} {...props} /> : null;
}
export const useWorkshopGuidance = () => useContext(GuidanceContext);
