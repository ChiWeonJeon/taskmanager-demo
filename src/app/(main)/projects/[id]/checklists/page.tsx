import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { canReadChecklist } from "@/lib/checklist/permissions";
import { ChecklistHub } from "@/components/checklist/checklist-hub";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const access = await getProjectAccess(id, session?.user);
  if (!access.project) notFound();
  if (!canReadChecklist(access)) notFound();

  const canCreate =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "checklist:create") ||
    hasProjectPermission(access, "checklist:edit") ||
    hasProjectPermission(access, "checklist:manage");

  const canEdit =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "checklist:edit") ||
    hasProjectPermission(access, "checklist:manage");

  return (
    <ChecklistHub projectKey={access.project.key} canCreate={canCreate} canEdit={canEdit} />
  );
}
