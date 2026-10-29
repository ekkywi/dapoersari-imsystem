export type ToastKind = "success" | "error";

export type ToastMessage = {
  id: string;
  kind: ToastKind;
  text: string;
};

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();

function emit(kind: ToastKind, text: string) {
  const toast: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text,
  };
  listeners.forEach((fn) => fn(toast));
}

export function toastSuccess(text: string) {
  emit("success", text);
}

export function toastError(text: string) {
  emit("error", text);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
