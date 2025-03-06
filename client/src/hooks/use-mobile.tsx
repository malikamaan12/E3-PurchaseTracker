import { useState, useEffect } from "react"

const BREAKPOINTS = {
  xs: 480,  // Extra small devices (phones)
  sm: 640,  // Small devices (tablets)
  md: 768,  // Medium devices (small laptops)
  lg: 1024, // Large devices (desktops)
  xl: 1280  // Extra large devices (large desktops)
}

/**
 * Hook to detect if the current viewport is below the provided breakpoint
 * @param breakpoint The breakpoint to check against
 * @returns Boolean indicating if viewport is below the specified breakpoint
 */
export function useIsBelow(breakpoint: keyof typeof BREAKPOINTS = 'md') {
  const [isBelow, setIsBelow] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const checkWidth = () => setIsBelow(window.innerWidth < BREAKPOINTS[breakpoint])
    
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`)
    mql.addEventListener("change", checkWidth)
    
    // Set initial value
    checkWidth()
    
    return () => mql.removeEventListener("change", checkWidth)
  }, [breakpoint])

  return !!isBelow
}

/**
 * Hook to detect mobile devices (below md breakpoint)
 * @returns Boolean indicating if viewport is a mobile device
 */
export function useIsMobile() {
  return useIsBelow('md')
}

/**
 * Hook to detect small devices (below sm breakpoint)
 * @returns Boolean indicating if viewport is a small device
 */
export function useIsSmallScreen() {
  return useIsBelow('sm')
}

/**
 * Hook to detect extra small devices (below xs breakpoint)
 * @returns Boolean indicating if viewport is an extra small device
 */
export function useIsExtraSmallScreen() {
  return useIsBelow('xs')
}
