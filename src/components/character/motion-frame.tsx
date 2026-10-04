"use client";

import { createContext, useContext, type RefObject } from "react";
import type { RigPose } from "@/lib/motion/workshop";

export type MotionFrame = { timeMs: number; pose: RigPose };
export const MotionFrameContext = createContext<RefObject<MotionFrame> | null>(null);
export const useMotionFrame = () => useContext(MotionFrameContext);
