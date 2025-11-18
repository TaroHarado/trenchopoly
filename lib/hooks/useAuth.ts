"use client";

import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      // Check if we have a session cookie
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  return {
    user: data?.user || null,
    isLoading,
  };
}

