import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { getServerMessages } from "@/lib/i18n/server";

export default async function AdminPage() {
  const messages = await getServerMessages();
  const m = messages.admin.menus;

  const adminMenuGroups = [
    {
      title: m.fieldStatusGroupTitle,
      description: m.fieldStatusGroupDescription,
      items: [
        { title: m.fieldsTitle, description: m.fieldsDescription, href: "/admin/fields", icon: "FD" },
        { title: m.statusesTitle, description: m.statusesDescription, href: "/admin/statuses", icon: "ST" },
      ],
    },
    {
      title: m.schemaGroupTitle,
      description: m.schemaGroupDescription,
      items: [
        { title: m.fieldSchemasTitle, description: m.fieldSchemasDescription, href: "/admin/field-schemas", icon: "FS" },
        { title: m.statusSchemasTitle, description: m.statusSchemasDescription, href: "/admin/status-schemas", icon: "SS" },
      ],
    },
    {
      title: m.entityTypesGroupTitle,
      description: m.entityTypesGroupDescription,
      items: [
        { title: m.entityTypesTitle, description: m.entityTypesDescription, href: "/admin/entity-types", icon: "ET" },
      ],
    },
    {
      title: m.referenceDataGroupTitle,
      description: m.referenceDataGroupDescription,
      items: [
        { title: m.objectTypesTitle, description: m.objectTypesDescription, href: "/admin/reference-objects", icon: "RO" },
      ],
    },
    {
      title: m.workspaceStructureGroupTitle,
      description: m.workspaceStructureGroupDescription,
      items: [
        { title: m.projectsTitle, description: m.projectsDescription, href: "/admin/projects", icon: "PJ" },
        { title: m.projectGroupsTitle, description: m.projectGroupsDescription, href: "/admin/project-groups", icon: "PG" },
      ],
    },
    {
      title: m.accessOperationsGroupTitle,
      description: m.accessOperationsGroupDescription,
      items: [
        { title: m.usersTitle, description: m.usersDescription, href: "/admin/users", icon: "US" },
        { title: m.rolesTitle, description: m.rolesDescription, href: "/admin/roles", icon: "RL" },
        { title: m.logsTitle, description: m.logsDescription, href: "/admin/logs", icon: "LG" },
      ],
    },
  ];

  return (
    <AdminShell
      title={messages.admin.title}
      description={messages.admin.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin }]}
    >
      <div className="space-y-7">
        {adminMenuGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{group.title}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((menu) => (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 transition-colors hover:bg-[var(--color-bg-hover)]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]"
                    >
                      {menu.icon}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                        {menu.title}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {menu.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
