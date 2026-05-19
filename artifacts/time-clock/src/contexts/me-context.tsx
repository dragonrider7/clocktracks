import { createContext, useContext, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type MeContextType = {
  me: Employee | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  isViewingAsEmployee: boolean;
  setIsViewingAsEmployee: (v: boolean) => void;
  isNotAuthorized: boolean;
};

export const MeContext = createContext<MeContextType>({
  me: undefined,
  isLoading: true,
  isAdmin: false,
  isViewingAsEmployee: false,
  setIsViewingAsEmployee: () => {},
  isNotAuthorized: false,
});

export const useMe = () => useContext(MeContext);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [isViewingAsEmployee, setIsViewingAsEmployee] = useState(false);
  const { data: me, isLoading, error } = useGetMe({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const isNotAuthorized = !isLoading && (error as { status?: number } | null)?.status === 403;

  if (isNotAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6 px-4 text-center">
        <img src={`${basePath}/logo.svg`} alt="TimeClock" className="h-12 w-12 opacity-60" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Access not set up yet</h1>
          <p className="text-muted-foreground max-w-sm">
            Your account hasn't been added to this system. Please ask your administrator to add your email address as an employee, then sign in again.
          </p>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <MeContext.Provider value={{
      me,
      isLoading,
      isAdmin: me?.role === "admin" && !isViewingAsEmployee,
      isViewingAsEmployee: me?.role === "admin" && isViewingAsEmployee,
      setIsViewingAsEmployee,
      isNotAuthorized: false,
    }}>
      {children}
    </MeContext.Provider>
  );
}
