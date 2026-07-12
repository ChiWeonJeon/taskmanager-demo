import { redirect } from "next/navigation";

export default async function ObjectTypeDetailRedirectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  redirect(`/admin/reference-objects/${encodeURIComponent(key)}`);
}
