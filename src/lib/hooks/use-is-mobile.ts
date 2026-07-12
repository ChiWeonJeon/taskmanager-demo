"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsMobile(mql.matches);
    apply();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
    mql.addListener(apply);
    return () => mql.removeListener(apply);
  }, []);

  return isMobile;
}
