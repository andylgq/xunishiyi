"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GarmentTypeUnion } from "@/types/tryon";

export interface UploadView {
  uploadId: string;
  /** 预检通过后由前端用签名 URL 预览（GET /api/files/[id]?token=... 由后端 check 接口附带） */
  previewUrl: string | null;
  thumbUrl: string | null;
  width?: number;
  height?: number;
  passed: boolean;
}

interface TryonState {
  personUpload: UploadView | null;
  garmentUpload: UploadView | null;
  garmentType: GarmentTypeUnion;
  /** 默认试衣照（P0 仅本地缓存，P1 落库） */
  defaultPerson: UploadView | null;
  setPerson: (u: UploadView | null) => void;
  setGarment: (u: UploadView | null) => void;
  setGarmentType: (t: GarmentTypeUnion) => void;
  setDefaultPerson: (u: UploadView | null) => void;
  clearGarment: () => void;
  clearAll: () => void;
}

export const useTryonStore = create<TryonState>()(
  persist(
    (set) => ({
      personUpload: null,
      garmentUpload: null,
      garmentType: "upper",
      defaultPerson: null,
      setPerson: (u) => set({ personUpload: u }),
      setGarment: (u) => set({ garmentUpload: u }),
      setGarmentType: (t) => set({ garmentType: t }),
      setDefaultPerson: (u) => set({ defaultPerson: u }),
      clearGarment: () => set({ garmentUpload: null }),
      clearAll: () =>
        set({ personUpload: null, garmentUpload: null, garmentType: "upper" }),
    }),
    { name: "tryon-session-v1" }
  )
);
