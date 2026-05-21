import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ThemeProvider } from "@/contexts/theme-context";
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
import Admin from "@/pages/admin";
import Celebrations from "@/pages/celebrations";
import GhostLogin from "@/pages/ghost-login";
import { MeProvider, MeContext } from "@/contexts/me-context";
import { LicenseProvider, useLicense } from "@/contexts/license-context";
import LicenseExpired from "@/pages/license-expired";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

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

/** Read the readable ghost-mode flag cookie set by the server on login. */
function isGhostMode(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith("_ctsa="));
}

/** MeProvider variant for ghost mode — calls /api/me directly (no Clerk check). */
function GhostMeProvider({ children }: { children: React.ReactNode }) {
  const [isViewingAsEmployee, setIsViewingAsEmployee] = useState(false);
  const { data: me, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });

  return (
    <MeContext.Provider
      value={{
        me,
        isLoading,
        isAdmin: me?.role === "admin" && !isViewingAsEmployee,
        isViewingAsEmployee: me?.role === "admin" && isViewingAsEmployee,
        setIsViewingAsEmployee,
        isNotAuthorized: false,
      }}
    >
      {children}
    </MeContext.Provider>
  );
}

/** Full app shell for the ghost super-admin (no Clerk required). */
function GhostApp() {
  const [location] = useLocation();

  // If navigating to /ghost while already logged in, redirect to dashboard
  if (location === "/ghost") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <GhostMeProvider>
      <Layout>
        <Switch>
          <Route path="/" component={() => <Redirect to="/dashboard" />} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/clock" component={Clock} />
          <Route path="/employees" component={Employees} />
          <Route path="/time-entries" component={TimeEntries} />
          <Route path="/time-off" component={TimeOff} />
          <Route path="/reports" component={Reports} />
          <Route path="/holidays" component={Holidays} />
          <Route path="/admin" component={Admin} />
          {/* Profile page uses Clerk's UserProfile — not available in ghost mode */}
          <Route path="/profile" component={() => <Redirect to="/dashboard" />} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </GhostMeProvider>
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

const LIMITED_BLOCKED = ["/reports", "/employees", "/holidays", "/admin"];
const MINIMAL_ALLOWED = ["/dashboard", "/clock", "/profile"];

function LicenseGate({ children }: { children: React.ReactNode }) {
  const { tier } = useLicense();
  const [location] = useLocation();

  if (tier === "locked") return <LicenseExpired />;

  if (tier === "minimal" && !MINIMAL_ALLOWED.includes(location)) {
    return <Redirect to="/clock" />;
  }

  if (tier === "limited" && LIMITED_BLOCKED.includes(location)) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <MeProvider>
          <LicenseGate>
            <Layout>
              <Component />
            </Layout>
          </LicenseGate>
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
  const [ghostMode] = useState(isGhostMode);

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
        <LicenseProvider>
          <TooltipProvider>
            {ghostMode ? (
              <GhostApp />
            ) : (
              <Switch>
                <Route path="/ghost" component={GhostLogin} />
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
                <Route path="/celebrations" component={() => <ProtectedRoute component={Celebrations} />} />
                <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
                <Route path="/admin" component={() => <ProtectedRoute component={Admin} />} />
                <Route component={NotFound} />
              </Switch>
            )}
            <Toaster />
          </TooltipProvider>
        </LicenseProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
