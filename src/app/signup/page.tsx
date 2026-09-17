"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Signup is disabled - admin-only access. Redirect to login.
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
