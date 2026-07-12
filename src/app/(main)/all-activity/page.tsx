import { ActivityFeed } from "@/components/activity/activity-feed";
import { HomeGlobeTabs } from "@/components/layout/home-globe-tabs";

export default function AllActivityPage() {
  return (
    <>
      <HomeGlobeTabs section="globe" />
      <ActivityFeed
        endpoint="/api/activity/accessible?scope=all"
        scopeKey={["activity", "all"]}
        hideHeader
      />
    </>
  );
}
