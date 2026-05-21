import { createContext, useContext } from "react";
import { useGetLicenseStatus, getGetLicenseStatusQueryKey } from "@workspace/api-client-react";

export type LicenseTier =
  | "valid"
  | "expiring"
  | "grace"
  | "limited"
  | "minimal"
  | "locked"
  | "trial";

export interface LicenseStatus {
  tier: LicenseTier;
  customer: string | null;
  email: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  valid: boolean;
}

const LicenseContext = createContext<LicenseStatus>({
  tier: "valid",
  customer: null,
  email: null,
  expiresAt: null,
  daysRemaining: null,
  valid: true,
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { data } = useGetLicenseStatus({
    query: {
      queryKey: getGetLicenseStatusQueryKey(),
      refetchInterval: 60 * 60 * 1000,
      staleTime: 30 * 60 * 1000,
    },
  });

  const status: LicenseStatus = data
    ? {
        tier: data.tier as LicenseTier,
        customer: data.customer ?? null,
        email: data.email ?? null,
        expiresAt: data.expiresAt ?? null,
        daysRemaining: data.daysRemaining ?? null,
        valid: data.valid,
      }
    : { tier: "valid", customer: null, email: null, expiresAt: null, daysRemaining: null, valid: true };

  return <LicenseContext.Provider value={status}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  return useContext(LicenseContext);
}
