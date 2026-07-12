"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildTaskPanelHref } from "@/lib/task-panel-route";

export function useOpenTaskPanelInPlace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (taskId: string) => {
    router.replace(buildTaskPanelHref(pathname, searchParams, taskId), { scroll: false });
  };
}
