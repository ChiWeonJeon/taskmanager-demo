import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { canReadChecklist } from "@/lib/checklist/permissions";
import { ChecklistDetail } from "@/components/checklist/checklist-detail";

interface Props {
  params: Promise<{ id: string; cid: string }>;
}

export default async function Page({ params }: Props) {
  const { id, cid } = await params;
  const session = await auth();
  const access = await getProjectAccess(id, session?.user);
  if (!access.project) notFound();
  if (!canReadChecklist(access)) notFound();

  const canEdit =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "checklist:edit") ||
    hasProjectPermission(access, "checklist:create") ||
    hasProjectPermission(access, "checklist:manage");
  const canDelete =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "checklist:delete") ||
    hasProjectPermission(access, "checklist:manage");
  const canStart = canReadChecklist(access);

  return (
    <ChecklistDetail
      projectKey={access.project.key}
      checklistId={cid}
      canEdit={canEdit}
      canDelete={canDelete}
      canStart={canStart}
    />
  );
}
