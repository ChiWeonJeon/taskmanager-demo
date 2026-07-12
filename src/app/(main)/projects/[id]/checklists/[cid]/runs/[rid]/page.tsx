import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { canReadChecklist } from "@/lib/checklist/permissions";
import { ChecklistRun } from "@/components/checklist/checklist-run";

interface Props {
  params: Promise<{ id: string; cid: string; rid: string }>;
}

export default async function Page({ params }: Props) {
  const { id, cid, rid } = await params;
  const session = await auth();
  const access = await getProjectAccess(id, session?.user);
  if (!access.project) notFound();
  if (!canReadChecklist(access)) notFound();

  const canManage =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "checklist:manage");

  const userId = access.userId;
  if (!userId) notFound();

  return (
    <ChecklistRun
      projectKey={access.project.key}
      checklistId={cid}
      runId={rid}
      currentUserId={userId}
      canManage={canManage}
    />
  );
}
