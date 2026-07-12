import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { canReadChecklist } from "@/lib/checklist/permissions";
import { canReadCycle } from "@/lib/cycle/permissions";
import { ProjectTabNav } from "./project-tab-nav";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { id } = await params;
  const session = await auth();
  const access = await getProjectAccess(id, session?.user);
  const project = access.project;
  if (!project) notFound();

  const canAccessAdmin =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "project:manage") ||
    hasProjectPermission(access, "members:manage");

  const canAccessChecklist = canReadChecklist(access);
  const canAccessCycle = canReadCycle(access);

  return (
    <div data-scope-page-content="project" className="min-w-0 w-full space-y-3">
      <ProjectTabNav
        project={project}
        canAccessAdmin={canAccessAdmin}
        canAccessChecklist={canAccessChecklist}
        canAccessCycle={canAccessCycle}
      />
      <div data-scope-page-body="project" className="min-w-0 w-full">{children}</div>
    </div>
  );
}
