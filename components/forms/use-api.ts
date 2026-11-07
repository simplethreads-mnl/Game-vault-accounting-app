"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function useApi() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function call<T = unknown>(url: string, body: unknown, method = "POST", success?: string): Promise<T | null> {
    setPending(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issue = data.issues?.[0];
        toast.error(data.error ?? "Request failed", { description: issue ? `${issue.path?.join(".")}: ${issue.message}` : undefined });
        return null;
      }
      if (success) toast.success(success);
      router.refresh();
      return data as T;
    } finally {
      setPending(false);
    }
  }
  return { call, pending };
}

export type Lookups = {
  units: { id: string; sku: string; model: string; status: string; productLine: string; costBasis: number; listPrice: number }[];
  parts: { id: string; sku: string; name: string; quantity: number; avgCost: number }[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  repairs: { id: string; jobNumber: string; customer: string; price: number; problem: string; status: string }[];
};
