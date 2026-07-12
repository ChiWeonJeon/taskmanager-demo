import { ActivityFeed } from "@/components/activity/activity-feed";
import { HomeGlobeTabs } from "@/components/layout/home-globe-tabs";

export default function MyActivityPage() {
  return (
    <>
      <HomeGlobeTabs section="home" />
      <ActivityFeed
        endpoint="/api/activity/accessible?scope=me"
        scopeKey={["activity", "me"]}
        hideHeader
      />
    </>
  );
}
