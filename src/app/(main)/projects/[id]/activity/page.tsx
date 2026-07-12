import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";
import { ActivityFeed } from "@/components/activity/activity-feed";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const access = await getProjectAccess(id, session?.user);
  if (!access.project) notFound();
  if (!hasProjectAccess(access)) notFound();

  return (
    <ActivityFeed
      endpoint={`/api/projects/${access.project.id}/activity`}
      scopeKey={["project", access.project.id]}
    />
  );
}
