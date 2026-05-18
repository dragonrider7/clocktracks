import { useEffect, useRef, createContext, useContext } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Clock from "@/pages/clock";
import Employees from "@/pages/employees";
import TimeEntries from "@/pages/time-entries";
import TimeOff from "@/pages/time-off";
import Reports from "@/pages/reports";
import Profile from "@/pages/profile";
import Holidays from "@/pages/holidays";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// REQUIRED — copy verbatim
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(221, 83%, 53%)",
    colorForeground: "hsl(222, 47%, 11%)",
    colorMutedForeground: "hsl(215, 16%, 47%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(210, 40%, 98%)",
    colorInput: "hsl(0, 0%, 100%)",
    colorInputForeground: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(214, 32%, 91%)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-md",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/80",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center py-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-border bg-white hover:bg-muted transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground transition-colors",
    formFieldInput: "border-border bg-white text-foreground placeholder:text-muted-foreground",
    footerAction: "bg-muted/40",
    dividerLine: "bg-border",
    alert: "border-border",
    otpCodeFieldInput: "border-border",
    formFieldRow: "",
    main: "",
  },
};

// Current user context
type MeContextType = {
  me: Employee | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  isNotAuthorized: boolean;
};

const MeContext = createContext<MeContextType>({ me: undefined, isLoading: true, isAdmin: false, isNotAuthorized: false });
export const useMe = () => useContext(MeContext);

function MeProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { data: me, isLoading, error } = useGetMe({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  // 403 = signed-in user has no matching employee record
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
    <MeContext.Provider value={{ me, isLoading, isAdmin: me?.role === "admin", isNotAuthorized: false }}>
      {children}
    </MeContext.Provider>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function LandingPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-8 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} alt="TimeClock" className="h-12 w-12" />
          <span className="text-3xl font-bold text-primary">TimeClock</span>
        </div>
        <p className="text-muted-foreground max-w-md text-lg">
          Simple, reliable time tracking for your team. Clock in and out, track hours, and manage time off — all in one place.
        </p>
      </div>
      <div className="flex gap-4">
        <button
          data-testid="button-sign-in"
          onClick={() => setLocation("/sign-in")}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Sign In
        </button>
        <button
          data-testid="button-sign-up"
          onClick={() => setLocation("/sign-up")}
          className="px-6 py-2.5 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <MeProvider>
          <Layout>
            <Component />
          </Layout>
        </MeProvider>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your TimeClock account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join your team on TimeClock",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
            <Route path="/clock" component={() => <ProtectedRoute component={Clock} />} />
            <Route path="/employees" component={() => <ProtectedRoute component={Employees} />} />
            <Route path="/time-entries" component={() => <ProtectedRoute component={TimeEntries} />} />
            <Route path="/time-off" component={() => <ProtectedRoute component={TimeOff} />} />
            <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
            <Route path="/holidays" component={() => <ProtectedRoute component={Holidays} />} />
            <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
