import { ProjectTasksPageView } from "../project-tasks-page-view";

export default function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectTasksPageView params={params} />;
}
