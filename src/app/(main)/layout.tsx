import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { GlobalTaskPanelHost } from "@/components/task/global-task-panel-host";
import { DemoReadOnlyBanner } from "@/components/shared/demo-read-only-banner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[var(--color-bg-primary)]">
      <Sidebar />
      <div className="min-w-0 overflow-x-hidden transition-all duration-200 md:ml-[var(--sidebar-current-width)]">
        <DemoReadOnlyBanner />
        <main data-service-content="true" className="min-w-0 overflow-x-hidden px-2 pt-2 pb-20 md:px-3 md:pt-3 md:pb-0">
          <div data-service-page-width="true" className="min-w-0 w-full">{children}</div>
        </main>
      </div>
      <MobileNav />
      <GlobalTaskPanelHost />
    </div>
  );
}
