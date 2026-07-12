"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/shared/locale-provider";
import { routeMetadata, safeReferrerHost } from "@/lib/analytics-core";
import { setAnalyticsContext, trackAnalytics } from "@/lib/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    setAnalyticsContext(locale);
  }, [locale]);

  useEffect(() => {
    if (!pathname || lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;
    const metadata = routeMetadata(pathname);
    trackAnalytics("Page Viewed", {
      page_name: metadata.pageName,
      route_template: metadata.routeTemplate,
      referrer_host: safeReferrerHost(document.referrer, window.location.host),
      workspace_scope: metadata.workspaceScope,
    });
  }, [pathname]);

  return children;
}
