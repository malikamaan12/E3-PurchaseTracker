import { gsap } from "gsap";

/**
 * Premium Apple-style Magnetic Effect
 * Creates a physical attraction between the cursor and the element.
 */
export const initMagnetic = (el: HTMLElement) => {
  if (!el) return;
  const strength = 20;

  const onMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const deltaX = (x - centerX) / centerX;
    const deltaY = (y - centerY) / centerY;

    gsap.to(el, {
      x: deltaX * strength,
      y: deltaY * strength,
      rotationX: deltaY * -6,
      rotationY: deltaX * 6,
      transformPerspective: 1000,
      transformOrigin: "center",
      ease: "power3.out",
      duration: 0.4,
    });
  };

  const onLeave = () => {
    gsap.to(el, {
      x: 0,
      y: 0,
      rotationX: 0,
      rotationY: 0,
      ease: "elastic.out(1, 0.4)",
      duration: 0.8,
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
 * Premium Cursor-following Glow Effect
 */
export const initGlow = (el: HTMLElement, glowEl: HTMLElement) => {
  if (!el || !glowEl) return;

  const onMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    gsap.to(glowEl, {
      x: x,
      y: y,
      opacity: 1,
      duration: 0.3,
    });
  };

  const onLeave = () => {
    gsap.to(glowEl, {
      opacity: 0,
      duration: 0.4,
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
 * Premium Page Load Entry
 */
export const pageLoad = (selector: string) => {
  gsap.from(selector, {
    opacity: 0,
    y: 30,
    duration: 0.8,
    stagger: 0.1,
    ease: "power3.out",
    delay: 0.2
  });
};
