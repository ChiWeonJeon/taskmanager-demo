import { redirect } from "next/navigation";

export default function NewObjectTypeRedirectPage() {
  redirect("/admin/reference-objects/new");
}
