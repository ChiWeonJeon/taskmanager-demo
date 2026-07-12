import { GroupTasksPageView } from "../tasks/group-tasks-page-view";

export default function GroupTodayPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  return <GroupTasksPageView params={params} variant="today" />;
}
