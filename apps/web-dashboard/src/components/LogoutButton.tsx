"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-of px-3 py-1.5 text-sm text-of-neutral-600 hover:bg-of-neutral-100 hover:text-of-neutral-900"
    >
      Sign out
    </button>
  );
}
