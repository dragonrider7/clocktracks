import { createContext, useContext } from "react";
import { useGetLicenseStatus, getGetLicenseStatusQueryKey } from "@workspace/api-client-react";

export type LicenseTier =
  | "valid"
  | "expiring"
  | "grace"
  | "limited"
  | "minimal"
  | "locked"
  | "trial"
  | "trial_expired";

export interface LicenseStatus {
  tier: LicenseTier;
  customer: string | null;
  email: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  valid: boolean;
  /** Maximum employees allowed by the license. Null = unlimited. */
  maxEmployees: number | null;
}

const LicenseContext = createContext<LicenseStatus>({
  tier: "valid",
  customer: null,
  email: null,
  expiresAt: null,
  daysRemaining: null,
  valid: true,
  maxEmployees: null,
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
        maxEmployees: data.maxEmployees ?? null,
      }
    : { tier: "valid", customer: null, email: null, expiresAt: null, daysRemaining: null, valid: true, maxEmployees: null };

  return <LicenseContext.Provider value={status}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  return useContext(LicenseContext);
}
