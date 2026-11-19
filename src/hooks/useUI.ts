import { create } from 'zustand';

export type OpenPanel = 'control' | 'scenes' | 'mixer' | 'timer' | null;

type UIStore = {
  /** Whether the entry gesture has happened this session (ephemeral). */
  entered: boolean;
  /** Which slide-out panel is open (ephemeral). */
  open: OpenPanel;

  setEntered: (v: boolean) => void;
  setOpen: (panel: OpenPanel) => void;
  toggle: (panel: Exclude<OpenPanel, null>) => void;
  close: () => void;
};

export const useUI = create<UIStore>((set, get) => ({
  entered: false,
  open: null,
  setEntered: (v) => set({ entered: v }),
  setOpen: (open) => set({ open }),
  toggle: (panel) => set({ open: get().open === panel ? null : panel }),
  close: () => set({ open: null }),
}));
