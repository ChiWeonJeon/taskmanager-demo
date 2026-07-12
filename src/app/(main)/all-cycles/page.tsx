import { CyclePageShell } from "@/components/cycle/cycle-page-shell";
import { HomeGlobeTabs } from "@/components/layout/home-globe-tabs";

export default function AllCyclesPage() {
  return (
    <div className="min-w-0 space-y-3">
      <HomeGlobeTabs section="globe" />
      <CyclePageShell
        endpoint="/api/cycles/accessible"
        queryKey={["cycles", "accessible"]}
        mode="global"
      />
    </div>
  );
}
