"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { messages } = useI18n();

  const startDemo = async () => {
    setIsSubmitting(true);
    setError("");
    const result = await signIn("demo", { redirect: false });
    if (result?.error) {
      setError(messages.auth.login.invalidCredentials);
      setIsSubmitting(false);
      return;
    }
    router.push("/today");
    router.refresh();
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
      {error && <p className="text-center text-sm text-[var(--color-danger)]">{error}</p>}
      <Button type="button" className="w-full" onClick={startDemo} disabled={isSubmitting}>
        {isSubmitting ? messages.demo.entering : messages.demo.enter}
      </Button>
    </div>
  );
}
