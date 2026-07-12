import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { ProjectSettingsCard } from "../project-settings-card";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrKey } = await params;
  const session = await auth();
  const access = await getProjectAccess(idOrKey, session?.user);
  const project = access.project;
  if (!project) notFound();

  const messages = await getServerMessages();
  const m = messages.projectAdminPage;

  const canManageProject =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "project:manage");

  const canAccessSettings = canManageProject;

  if (!canAccessSettings) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-text-tertiary)]">
        {m.settings.noAccess}
      </div>
    );
  }

  const projectIssueCount = await prisma.workItem.count({ where: { projectId: project.id } });

  return (
    <div className="min-w-0 w-full space-y-4">
      <Breadcrumbs
        ariaLabel={messages.commonUi.breadcrumbsLabel}
        items={[
          { label: m.projectsCrumb, href: "/projects" },
          { label: project.name, href: `/projects/${project.key}` },
          { label: m.adminCrumb, href: `/projects/${project.key}/admin` },
          { label: m.settings.settingsCrumb },
        ]}
      />

      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{m.settings.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {m.settings.description}
        </p>
      </div>

      <ProjectSettingsCard
        project={{ id: project.id, name: project.name, key: project.key, isPersonal: project.isPersonal }}
        issueCount={projectIssueCount}
        canManageProject={canManageProject}
      />
    </div>
  );
}
