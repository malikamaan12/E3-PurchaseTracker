import { useToastContext } from "@/contexts/ToastContext";

type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastOptions {
  title: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
}

const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 7000;

class ToastService {
  private static showToast: ((options: ToastOptions) => void) | null = null;

  static initialize(showToastFn: (options: ToastOptions) => void) {
    this.showToast = showToastFn;
  }

  static success(title: string, description: string, duration = DEFAULT_DURATION) {
    this.show({ title, description, variant: 'success', duration });
  }

  static error(title: string, description: string, duration = ERROR_DURATION) {
    this.show({ title, description, variant: 'error', duration });
  }

  static warning(title: string, description: string, duration = DEFAULT_DURATION) {
    this.show({ title, description, variant: 'warning', duration });
  }

  static info(title: string, description: string, duration = DEFAULT_DURATION) {
    this.show({ title, description, variant: 'info', duration });
  }

  static loading(title: string, description: string) {
    this.show({ title, description, variant: 'loading', duration: 0 });
  }

  private static show(options: ToastOptions) {
    if (!this.showToast) {
      console.warn('Toast service not initialized');
      return;
    }
    this.showToast(options);
  }
}

export const useToastService = () => {
  const { showToast } = useToastContext();
  
  // Initialize the toast service with the context's showToast function
  ToastService.initialize(showToast);
  
  return ToastService;
};

export default ToastService;
