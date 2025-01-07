import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type State = {
  toasts: ToasterToast[];
};

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const useToastStore = () => {
  const [state, setState] = React.useState<State>({ toasts: [] });

  const addToast = React.useCallback(
    (toast: Omit<ToasterToast, "id">) => {
      setState((state) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = { ...toast, id };

        const timeout = setTimeout(() => {
          setState((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
          toastTimeouts.delete(id);
        }, toast.duration || TOAST_REMOVE_DELAY);

        toastTimeouts.set(id, timeout);

        return {
          toasts: [newToast, ...state.toasts].slice(0, TOAST_LIMIT),
        };
      });
    },
    []
  );

  const dismissToast = React.useCallback((id: string) => {
    setState((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, open: false } : t
      ),
    }));

    if (toastTimeouts.has(id)) {
      clearTimeout(toastTimeouts.get(id));
      toastTimeouts.delete(id);
    }
  }, []);

  return {
    toasts: state.toasts,
    addToast,
    dismissToast,
  };
};

export function useToast() {
  const store = useToastStore();

  const toast = React.useCallback(
    (props: Omit<ToasterToast, "id">) => {
      store.addToast(props);
    },
    [store]
  );

  return {
    toast,
    dismiss: store.dismissToast,
    toasts: store.toasts,
  };
}

export type { ToasterToast };