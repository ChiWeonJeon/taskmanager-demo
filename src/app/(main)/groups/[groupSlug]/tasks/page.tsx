import { GroupTasksPageView } from "./group-tasks-page-view";

export default function GroupTasksPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  return <GroupTasksPageView params={params} />;
}
