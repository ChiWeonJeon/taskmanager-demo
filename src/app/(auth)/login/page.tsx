"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";
import {
  hasOptedOutAnalytics,
  isAnalyticsConfigured,
  optOutAnalytics,
  trackAnalytics,
} from "@/lib/analytics";

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [analyticsOptedOut, setAnalyticsOptedOut] = useState(false);
  const { messages } = useI18n();

  useEffect(() => {
    // Browser-local Mixpanel consent is external state and is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnalyticsOptedOut(hasOptedOutAnalytics());
  }, []);

  const startDemo = async () => {
    setIsSubmitting(true);
    setError("");
    const result = await signIn("demo", { redirect: false });
    if (result?.error) {
      setError(messages.auth.login.invalidCredentials);
      setIsSubmitting(false);
      return;
    }
    trackAnalytics("Demo Entered", { entry_method: "one_click" });
    router.push("/today");
    router.refresh();
  };

  const stopAnalytics = () => {
    optOutAnalytics();
    setAnalyticsOptedOut(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          {messages.demo.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
          {messages.demo.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          {messages.demo.description}
        </p>
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
        {messages.demo.readOnlyNotice}
      </div>
      {isAnalyticsConfigured() && !analyticsOptedOut && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-xs leading-5 text-[var(--color-text-secondary)]">
          <p>{messages.demo.analyticsNotice}</p>
          <button
            type="button"
            onClick={stopAnalytics}
            className="mt-2 font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            {messages.demo.analyticsOptOut}
          </button>
        </div>
      )}
      {error && <p className="text-center text-sm text-[var(--color-danger)]">{error}</p>}
      <Button type="button" className="w-full" onClick={startDemo} disabled={isSubmitting}>
        {isSubmitting ? messages.demo.entering : messages.demo.enter}
      </Button>
    </div>
  );
}
