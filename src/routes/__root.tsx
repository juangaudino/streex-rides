import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { initializeAnalytics, isAnalyticsAllowed, trackPageView } from "@/lib/analytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    const routeIds = matches.map((match) => (match as { routeId: string }).routeId);
    const isPassengerConsole = matches.some(
      (match) => (match as { routeId: string }).routeId === "/passenger",
    );
    const isAdmin = routeIds.some(
      (routeId) => routeId === "/admin" || routeId.startsWith("/admin/"),
    );
    const appleTouchIcon = isAdmin
      ? "/icons/streex-admin-x-white-180.png"
      : "/icons/streex-wordmark-black-180.png";
    const manifestHref = isAdmin
      ? "/admin.webmanifest"
      : isPassengerConsole
        ? "/passenger.webmanifest"
        : "/manifest.webmanifest";

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: isAdmin ? "Streex Admin" : "Streex Rides" },
        { name: "theme-color", content: "#0B0B0B" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: isAdmin ? "Streex Admin" : "Streex" },
        {
          name: "description",
          content:
            "Private rides. Elevated. Premium transportation designed around comfort, reliability and personal service.",
        },
        { name: "author", content: "STREEX Rides" },
        {
          name: "google-site-verification",
          content: "Li1UygnAqd-GVqjtntcBG4J8ApZzJGwIfFJsjZ6WLh4",
        },
        { property: "og:title", content: "Streex Rides — Private rides. Elevated." },
        {
          property: "og:description",
          content:
            "Private rides. Elevated. Premium transportation designed around comfort, reliability and personal service.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://rides.getstreex.com" },
        { property: "og:site_name", content: "Streex Rides" },
        {
          property: "og:image",
          content: "https://rides.getstreex.com/images/streex/streex-og-preview-v2.jpg",
        },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Streex Rides — Private rides. Elevated." },
        {
          name: "twitter:description",
          content:
            "Private rides. Elevated. Premium transportation designed around comfort, reliability and personal service.",
        },
        {
          name: "twitter:image",
          content: "https://rides.getstreex.com/images/streex/streex-og-preview-v2.jpg",
        },
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap",
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
        {
          rel: "icon",
          href: "/favicon.ico",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/icons/streex-wordmark-black-16.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/icons/streex-wordmark-black-32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "48x48",
          href: "/icons/streex-wordmark-black-48.png",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: appleTouchIcon,
        },
        {
          rel: "apple-touch-icon",
          sizes: "167x167",
          href: isAdmin
            ? "/icons/streex-admin-x-white-167.png"
            : "/icons/streex-wordmark-black-167.png",
        },
        {
          rel: "apple-touch-icon",
          sizes: "152x152",
          href: isAdmin
            ? "/icons/streex-admin-x-white-152.png"
            : "/icons/streex-wordmark-black-152.png",
        },
        {
          rel: "manifest",
          href: manifestHref,
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(sessionStorage.getItem("streex_splash_seen_v1")==="1")document.documentElement.dataset.streexSplash="seen"}catch(e){}',
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useRouterState({ select: (state) => state.location });
  const { pathname, searchStr } = location;

  useEffect(() => {
    if (!isAnalyticsAllowed(pathname, searchStr)) return;

    const startAnalytics = () => {
      initializeAnalytics();
      trackPageView(pathname);
    };

    if (document.readyState === "complete") {
      startAnalytics();
      return;
    }

    window.addEventListener("load", startAnalytics, { once: true });
    return () => window.removeEventListener("load", startAnalytics);
  }, [pathname, searchStr]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
