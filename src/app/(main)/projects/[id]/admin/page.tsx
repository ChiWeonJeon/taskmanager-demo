import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AdminTabIcon, MembersTabIcon } from "@/components/task/task-icons";
import { getServerMessages } from "@/lib/i18n/server";

export default async function ProjectAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrKey } = await params;
  const session = await auth();
  const access = await getProjectAccess(idOrKey, session?.user);
  const project = access.project;
  if (!project) notFound();

  const messages = await getServerMessages();
  const m = messages.projectAdminPage;

  const canAccessAdmin =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "project:manage") ||
    hasProjectPermission(access, "members:manage");

  if (!canAccessAdmin) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-text-tertiary)]">
        {m.noAccess}
      </div>
    );
  }

  const basePath = `/projects/${project.key}/admin`;
  const canManageProject =
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "project:manage");
  const projectAdminMenus = [
    ...(canManageProject
      ? [{
          title: m.menus.settingsTitle,
          description: m.menus.settingsDescription,
          hrefSuffix: "/settings",
          icon: <AdminTabIcon className="h-5 w-5" />,
        }]
      : []),
    {
      title: m.menus.membersTitle,
      description: m.menus.membersDescription,
      hrefSuffix: "/members",
      icon: <MembersTabIcon className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumbs
        ariaLabel={messages.commonUi.breadcrumbsLabel}
        items={[
          { label: m.projectsCrumb, href: "/projects" },
          { label: project.name, href: `/projects/${project.key}` },
          { label: m.adminCrumb },
        ]}
      />

      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{m.title}</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {m.description}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {projectAdminMenus.map((menu) => (
          <Link
            key={menu.hrefSuffix}
            href={`${basePath}${menu.hrefSuffix}`}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-text-secondary)]" aria-hidden>{menu.icon}</span>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{menu.title}</h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{menu.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
