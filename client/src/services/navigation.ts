import { useLocation } from "wouter";

class NavigationService {
  private static instance: NavigationService;
  private navigationStack: string[] = [];
  private lastAttemptedNavigation: string | null = null;

  private constructor() {}

  public static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  public async navigateTo(path: string, fallback?: () => void): Promise<boolean> {
    try {
      console.log(`Attempting navigation to: ${path}`);
      this.lastAttemptedNavigation = path;
      
      // Push to navigation stack
      this.navigationStack.push(path);
      
      // Try wouter navigation first
      const [, navigate] = useLocation();
      await navigate(path);
      
      // Verify navigation was successful
      const currentPath = window.location.pathname;
      if (currentPath === path) {
        console.log(`Successfully navigated to: ${path}`);
        return true;
      }

      // If wouter navigation failed, try history API
      console.log('Wouter navigation failed, trying history API...');
      window.history.pushState({}, '', path);
      
      // Final verification
      if (window.location.pathname === path) {
        console.log(`Successfully navigated to: ${path} using history API`);
        return true;
      }

      // If all else fails, try fallback or location.href
      console.log('Standard navigation failed, using fallback...');
      if (fallback) {
        fallback();
      } else {
        window.location.href = path;
      }

      return true;
    } catch (error) {
      console.error('Navigation error:', error);
      
      // Last resort: direct location change
      try {
        window.location.href = path;
        return true;
      } catch (e) {
        console.error('Final navigation attempt failed:', e);
        return false;
      }
    }
  }

  public getLastAttemptedNavigation(): string | null {
    return this.lastAttemptedNavigation;
  }

  public getNavigationStack(): string[] {
    return [...this.navigationStack];
  }
}

export const navigationService = NavigationService.getInstance();
