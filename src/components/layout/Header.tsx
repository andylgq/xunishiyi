import { getCurrentUser } from "@/lib/auth";
import { ClientHeader } from "./ClientHeader";

export async function Header() {
  const user = await getCurrentUser();
  return <ClientHeader user={user} />;
}
