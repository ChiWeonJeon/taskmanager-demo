export function buildTaskPanelHref(
  pathname: string | null | undefined,
  currentSearch: string | URLSearchParams | { toString(): string } | null | undefined,
  taskId: string
) {
  const basePath = pathname || "/";
  const params = new URLSearchParams(currentSearch?.toString() ?? "");
  params.set("task", taskId);
  const next = params.toString();
  return next ? `${basePath}?${next}` : basePath;
}
