import { ProjectTasksPageView } from "../project-tasks-page-view";

export default function ProjectTodayPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectTasksPageView params={params} variant="today" />;
}
