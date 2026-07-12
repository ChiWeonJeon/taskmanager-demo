import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  /** sticky=true: 사용자가 직접 닫아야 함. sticky=false: 일정 시간 후 자동 소멸. */
  sticky: boolean;
  action?: ToastAction;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, "id">) => string;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    return id;
  },
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export interface ToastOptions {
  title?: string;
  type?: ToastType;
  /** 기본값 false (임시형). true 로 설정 시 고정형(수동 닫기). */
  sticky?: boolean;
  /** 임시형 자동 소멸 대기 시간(ms). 기본값: error=6000, 나머지=4000 */
  duration?: number;
  action?: ToastAction;
}

export function useToast() {
  const { add, remove } = useToastStore();

  function toast(message: string, opts?: ToastOptions): string {
    const sticky = opts?.sticky ?? false;
    const type = opts?.type ?? "info";
    const id = add({ message, title: opts?.title, type, sticky, action: opts?.action });
    if (!sticky) {
      const duration = opts?.duration ?? (type === "error" ? 6000 : 4000);
      setTimeout(() => remove(id), duration);
    }
    return id;
  }

  return { toast };
}
