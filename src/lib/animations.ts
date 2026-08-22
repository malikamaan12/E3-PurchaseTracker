/**
 * Optimized Performance-First Animation Engine
 * Replaced GSAP with hardware-accelerated CSS transforms and Framer Motion logic.
 */

/**
 * Lightweight Magnetic Effect
 * Uses CSS variables and transform for GPU acceleration.
 */
export const initMagnetic = (el: HTMLElement) => {
  if (!el) return;
  const strength = 20;

  // Ensure transition is set for smooth non-mouse movement
  el.style.transition = "transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)";
  el.style.willChange = "transform";

  let ticking = false;

  const onMove = (e: MouseEvent) => {
    if (ticking) return;
    ticking = true;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const deltaX = (x - centerX) / centerX;
    const deltaY = (y - centerY) / centerY;

    // Use requestAnimationFrame for smooth hardware-accelerated updates
    window.requestAnimationFrame(() => {
      el.style.transform = `
        translate3d(${deltaX * strength}px, ${deltaY * strength}px, 0)
        rotateX(${deltaY * -6}deg)
        rotateY(${deltaX * 6}deg)
      `;
      ticking = false;
    });
  };

  const onLeave = () => {
    window.requestAnimationFrame(() => {
      el.style.transform = `translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)`;
      el.style.transition = "transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    });
  };

  el.addEventListener("mousemove", onMove);
  el.addEventListener("mouseleave", onLeave);

  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
};

/**
 * Optimized Cursor-following Glow
 */
export const initGlow = (el: HTMLElement, glowEl: HTMLElement) => {
  if (!el || !glowEl) return;

  glowEl.style.transition = "opacity 0.4s ease";
  glowEl.style.willChange = "transform, opacity";
  glowEl.style.pointerEvents = "none";

  let ticking = false;

  const onMove = (e: MouseEvent) => {
    if (ticking) return;
    ticking = true;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    window.requestAnimationFrame(() => {
      glowEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate3d(-50%, -50%, 0)`;
      glowEl.style.opacity = "1";
      ticking = false;
    });
  };

  const onLeave = () => {
    window.requestAnimationFrame(() => {
      glowEl.style.opacity = "0";
    });
  };

  el.addEventListener("mousemove", onMove);
  el.addEventListener("mouseleave", onLeave);

  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
};

/**
 * Sequential Entry Animation
 * Lightweight CSS-driven variant with strict single-execution guard.
 */
export const pageLoad = (selector: string) => {
  if (typeof document === "undefined") return;
  const elements = document.querySelectorAll(selector);
  elements.forEach((el: any, index: number) => {
    // Skip if already animated
    if (el.getAttribute('data-animated') === 'true') return;
    el.setAttribute('data-animated', 'true');

    // Only apply animation if element is initially hidden or newly mounted
    const currentOpacity = window.getComputedStyle(el).opacity;
    if (currentOpacity === "1") return;

    el.style.opacity = "0";
    el.style.transform = "translate3d(0, 16px, 0)";
    el.style.transition = "opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)";
    el.style.transitionDelay = `${0.03 + (Math.min(index, 6) * 0.04)}s`;

    window.requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translate3d(0, 0, 0)";
    });
  });
};
