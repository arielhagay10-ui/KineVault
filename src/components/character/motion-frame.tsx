"use client";

import { createContext, useContext, type RefObject } from "react";
import type { RigPose, WorkshopScene } from "@/lib/motion/workshop";

export type MotionFrame = { timeMs: number; pose: RigPose; scene?: WorkshopScene };
export const MotionFrameContext = createContext<RefObject<MotionFrame> | null>(null);
export const useMotionFrame = () => useContext(MotionFrameContext);
