"use client";

import mixpanel from "mixpanel-browser";
import {
  ANALYTICS_EVENTS,
  isAnalyticsEnabled,
  routeMetadata,
  sanitizeEventProperties,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@/lib/analytics-core";

const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim() ?? "";
const enabled = isAnalyticsEnabled(process.env.NEXT_PUBLIC_MIXPANEL_ENABLED, token);
const allowedEvents = new Set<string>(ANALYTICS_EVENTS);
const sensitiveDefaultProperties = [
  "$current_url",
  "$referrer",
  "$referring_domain",
  "$initial_referrer",
  "$initial_referring_domain",
  "current_url",
  "current_url_search",
];

let initialized = false;

export function isAnalyticsConfigured(): boolean {
  return enabled;
}

export function initializeAnalytics(): boolean {
  if (!enabled || typeof window === "undefined") return false;
  if (initialized) return true;

  mixpanel.init(token, {
    api_host: `${window.location.origin}/mp`,
    persistence: "localStorage",
    autocapture: false,
    track_pageview: false,
    record_sessions_percent: 0,
    record_heatmap_data: false,
    flags: false,
    remote_settings_mode: "disabled",
    ip: false,
    ignore_dnt: false,
    save_referrer: false,
    store_google: false,
    stop_utm_persistence: true,
    property_blacklist: sensitiveDefaultProperties,
    hooks: {
      before_send_events(payload) {
        if (!allowedEvents.has(payload.event)) return null;
        for (const key of sensitiveDefaultProperties) delete payload.properties[key];
        return payload;
      },
    },
  });
  initialized = true;
  return true;
}

export function setAnalyticsContext(locale: string): void {
  if (!initializeAnalytics()) return;
  mixpanel.register({
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    locale: locale.slice(0, 16),
    environment: "production",
    demo_mode: true,
    read_only: true,
  });
}

export function trackAnalytics<Event extends AnalyticsEventName>(
  event: Event,
  properties: AnalyticsEventProperties[Event],
): void {
  if (!initializeAnalytics()) return;
  const route = routeMetadata(window.location.pathname);
  mixpanel.track(event, sanitizeEventProperties(event, {
    route_template: route.routeTemplate,
    workspace_scope: route.workspaceScope,
    ...properties,
  }));
}

export function optOutAnalytics(): void {
  if (!initializeAnalytics()) return;
  mixpanel.opt_out_tracking({ delete_user: false });
}

export function hasOptedOutAnalytics(): boolean {
  if (!initializeAnalytics()) return false;
  return mixpanel.has_opted_out_tracking({ persistence_type: "localStorage" });
}
