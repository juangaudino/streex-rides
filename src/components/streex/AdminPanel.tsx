import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  Gamepad2,
  MessageSquareQuote,
  Palette,
  Settings2,
  Star,
  Users,
} from "lucide-react";
import {
  createAdminBlockedSlot,
  deleteAdminBlockedSlot,
  getAdminAvailability,
  updateAdminAvailability,
} from "@/lib/availability.functions";
import {
  deleteAdminReview,
  deleteAdminRunnerScore,
  getAdminPassengerAnalyticsSummary,
  listAdminBookings,
  listAdminReviews,
  listAdminRunnerScores,
  retryAdminBookingCalendarSync,
  sendAdminQuote,
  updateAdminBookingStatus,
  updateAdminReviewStatus,
  updateAdminRunnerScore,
  updateAdminRunnerScoreStatus,
  updateAdminTickerTheme,
  startAdminPassengerAnalyticsBeta,
} from "@/lib/admin.functions";
import { getAdminTickerTheme } from "@/lib/ticker-theme.functions";
import { getAdminSiteConfig, updateAdminSiteConfig } from "@/lib/site-config.functions";
import {
  passengerAnalyticsToday,
  type PassengerAnalyticsRangePreset,
} from "@/lib/passenger-analytics-report";
import { CONFIG, type AppConfig } from "@/config";
import logo from "@/assets/brand/streex-rides-transparent.webp";
import { useAdminTheme } from "./admin/useAdminTheme";
import { AdminThemeControl } from "./admin/AdminThemeControl";
import { PassengerVisualThemeControl } from "./admin/PassengerVisualThemeControl";
import { getPassengerVisualTheme, type PassengerVisualTheme } from "@/lib/passenger-visual-theme";
import { AdminCalendar, type CalendarGoogleBusyItem } from "./admin/AdminCalendar";
import { AdminCalendarEventSheet, type CalendarSheetItem } from "./admin/AdminCalendarEventSheet";
import { GoogleCalendarConnectionCard } from "./admin/GoogleCalendarConnectionCard";
import { PricingPanel } from "./admin/PricingPanel";
import { supabase } from "@/integrations/supabase/client";
import { uploadTenantAsset, type TenantAssetKind } from "@/lib/tenant-assets";
import {
  changeTenantOwner,
  createDriverTenant,
  getAdminSession,
  getTenantPreviewLink,
  sendTenantAccessLink,
  updateTenantStatus,
} from "@/lib/tenant.functions";

type AdminTab =
  | "analytics"
  | "bookings"
  | "pricing"
  | "reviews"
  | "runner"
  | "themes"
  | "config"
  | "availability"
  | "drivers";
type TickerStyle = "boarding" | "pill";

type AdminTenant = {
  id: string;
  slug: string;
  display_name: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  status: string;
  onboarding?: {
    configurationReady: boolean;
    calendarConnected: boolean;
    availabilityReady: boolean;
  };
  lastActivityAt?: string;
};

type AdminSessionState = {
  user: { id: string; email: string | null } | null;
  activeTenantId: string;
  isSuperAdmin: boolean;
  emergencyAccess: boolean;
  tenants: AdminTenant[];
};

type BookingRow = {
  id: string;
  service_type?: string | null;
  name: string;
  phone: string;
  email: string;
  google_sync_error?: string | null;
  google_sync_status?: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  passengers: number;
  estimated_duration_minutes?: number | null;
  notes: string | null;
  price: number | null;
  status: "pending" | "quoted" | "confirmed" | "declined" | "completed" | "cancelled";
  created_at: string;
};

type ReviewRow = {
  id: string;
  name: string | null;
  rating: number;
  message: string;
  location: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type RunnerScoreRow = {
  id: string;
  name: string;
  score: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

const STATUS_TABS: { key: BookingRow["status"]; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "quoted", label: "Quoted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "declined", label: "Declined" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export function AdminPanel({ initialTab = "bookings" }: { initialTab?: AdminTab }) {
  const [adminKey, setAdminKey] = useState("");
  const [adminSession, setAdminSession] = useState<AdminSessionState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const { preference, resolved, setPreference } = useAdminTheme();

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        const result = await getAdminSession({ data: { adminKey: "" } });
        if (cancelled) return;
        const selected = localStorage.getItem("streex_admin_tenant") || result.activeTenantId;
        localStorage.setItem("streex_admin_tenant", selected);
        setAdminKey("");
        setAdminSession({ ...result, activeTenantId: selected } as AdminSessionState);
      } catch {
        await supabase.auth.signOut();
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const result = await getAdminSession({ data: { adminKey: "" } });
      localStorage.setItem("streex_admin_tenant", result.activeTenantId);
      setAdminKey("");
      setAdminSession(result as AdminSessionState);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Access denied.");
    } finally {
      setChecking(false);
    }
  };

  if (!adminSession) {
    return (
      <div
        className="streex-admin-scope fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0B0B] px-6"
        data-admin-theme={resolved}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(230,206,32,0.10) 0%, transparent 70%)",
          }}
        />
        <div className="relative w-full max-w-xs flex flex-col items-center">
          <img src={logo} alt="Streex" className="w-40 h-auto streex-logo-glow" />
          <p className="mt-6 text-[10px] streex-tracking text-white/60 uppercase">
            Restricted Area
          </p>
          <form onSubmit={submitLogin} className="mt-8 w-full flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 backdrop-blur-xl focus:outline-none focus:border-[#E6CE20]/40 transition-colors"
            />
            <button
              type="submit"
              disabled={checking}
              className="w-full rounded-xl bg-[#E6CE20] text-black font-semibold text-sm py-3 hover:bg-[#E6CE20]/90 transition-colors disabled:opacity-60"
            >
              {checking ? "Signing in..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!email) return setError("Enter your email first.");
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/admin`,
                });
                setError(
                  resetError ? resetError.message : "Password setup link sent. Check your email.",
                );
              }}
              className="text-xs text-white/50 hover:text-white"
            >
              Set or reset password
            </button>
            {error && <p className="text-center text-xs text-red-400/90 mt-1">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: "bookings", label: "Bookings", icon: <CalendarCheck className="h-4 w-4" /> },
    { key: "pricing", label: "Pricing", icon: <CircleDollarSign className="h-4 w-4" /> },
    { key: "analytics", label: "Passenger", icon: <Activity className="h-4 w-4" /> },
    { key: "reviews", label: "Reviews", icon: <MessageSquareQuote className="h-4 w-4" /> },
    ...(adminSession.isSuperAdmin
      ? ([{ key: "runner", label: "Horizon", icon: <Gamepad2 className="h-4 w-4" /> }] as const)
      : []),
    { key: "themes", label: "Themes", icon: <Palette className="h-4 w-4" /> },
    { key: "config", label: "Config", icon: <Settings2 className="h-4 w-4" /> },
    { key: "availability", label: "Availability", icon: <CalendarClock className="h-4 w-4" /> },
    ...(adminSession.isSuperAdmin
      ? ([{ key: "drivers", label: "Drivers", icon: <Users className="h-4 w-4" /> }] as const)
      : []),
  ];

  return (
    <div
      className="streex-admin-scope min-h-screen bg-black text-white px-5 sm:px-6 py-10"
      data-admin-theme={resolved}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase streex-tracking text-[#E6CE20]/80 mb-2">
              Streex Admin
            </p>
            <h1 className="text-2xl font-bold">Control Center</h1>
            <p className="text-xs text-white/40 mt-1">
              Manage bookings, passenger reviews, and display themes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AdminThemeControl value={preference} onChange={setPreference} />
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("streex_admin_tenant");
                supabase.auth.signOut();
                setAdminKey("");
                setAdminSession(null);
              }}
              className="text-xs rounded-full px-3 py-1.5 border border-white/15 text-white/70 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-5 rounded-2xl border border-[#E6CE20]/20 bg-[#E6CE20]/[0.05] p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-[10px] uppercase streex-tracking text-[#E6CE20]/70">
              Active workspace
            </p>
            <p className="mt-1 text-sm font-semibold">
              {adminSession.tenants.find((tenant) => tenant.id === adminSession.activeTenantId)
                ?.display_name || "STREEX"}
            </p>
          </div>
          <select
            value={adminSession.activeTenantId}
            onChange={(event) => {
              const tenantId = event.target.value;
              localStorage.setItem("streex_admin_tenant", tenantId);
              setAdminSession((current) =>
                current ? { ...current, activeTenantId: tenantId } : current,
              );
            }}
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
          >
            {adminSession.tenants
              .filter((tenant) => tenant.status !== "archived")
              .map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.display_name} · {tenant.status}
                </option>
              ))}
          </select>
        </div>

        {adminSession.user && (
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.025] p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/70 truncate">
                Signed in as {adminSession.user.email}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[#E6CE20]/70">
                {adminSession.isSuperAdmin ? "Platform Super Admin" : "Driver workspace account"}
              </p>
              {accountMessage && (
                <p className="mt-1 text-[10px] text-[#E6CE20]">{accountMessage}</p>
              )}
            </div>
            <input
              type="password"
              value={newPassword}
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className="rounded-lg border border-white/10 bg-black px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={async () => {
                if (newPassword.length < 8) return setAccountMessage("Use at least 8 characters.");
                const { error: passwordError } = await supabase.auth.updateUser({
                  password: newPassword,
                });
                setAccountMessage(passwordError ? passwordError.message : "Password updated.");
                if (!passwordError) setNewPassword("");
              }}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs"
            >
              Update password
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-7">
          {tabs.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-11 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  selected
                    ? "bg-[#E6CE20] text-black border-[#E6CE20]"
                    : "bg-white/[0.03] border-white/10 text-white/70 hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div key={adminSession.activeTenantId}>
          {activeTab === "bookings" && <AdminBookings adminKey={adminKey} />}
          {activeTab === "pricing" && <PricingPanel adminKey={adminKey} />}
          {activeTab === "analytics" && <AdminPassengerAnalytics adminKey={adminKey} />}
          {activeTab === "reviews" && <AdminReviews adminKey={adminKey} />}
          {activeTab === "runner" && <AdminRunnerScores adminKey={adminKey} />}
          {activeTab === "themes" && <AdminThemes adminKey={adminKey} />}
          {activeTab === "config" && (
            <AdminConfig adminKey={adminKey} tenantId={adminSession.activeTenantId} />
          )}
          {activeTab === "availability" && <AdminAvailability adminKey={adminKey} />}
          {activeTab === "drivers" && (
            <AdminDrivers
              adminKey={adminKey}
              session={adminSession}
              onRefresh={async () => {
                const result = await getAdminSession({ data: { adminKey } });
                setAdminSession(result as AdminSessionState);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type PassengerAnalyticsSummary = {
  range: {
    preset: PassengerAnalyticsRangePreset;
    startDate: string | null;
    endDate: string;
    startAt: string | null;
    endAt: string;
  };
  reportingStartedAt: string | null;
  browserSessions: number;
  browserSessionsWithoutInteraction: number;
  averageActiveDurationMs: number;
  engagements: number;
  interactiveEngagements: number;
  averageEngagementDurationMs: number;
  averageFirstActionDelayMs: number;
  engagementSources: Record<string, number>;
  firstInteractions: number;
  music: { opened: number; actions: number };
  idle: { entered: number; logicalRest: number };
  byScreen: Record<string, number>;
  games: Record<string, { opened: number; started: number; completed: number }>;
  lifecycle: { tabletUnverified: number; driverConfirmed: number };
  usageMap: {
    nodes: Array<{ screen: string; count: number }>;
    flows: Array<{ from: string; to: string; count: number }>;
    actions: Array<{ screen: string; element: string; action: string; count: number }>;
    journeys: Array<{
      id: string;
      startedAt: string;
      entrySource: string;
      path: string[];
      interactionCount: number;
      activeDurationMs: number;
    }>;
  };
};

function formatPassengerDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function AdminPassengerAnalytics({ adminKey }: { adminKey: string }) {
  const [rangePreset, setRangePreset] = useState<PassengerAnalyticsRangePreset>("last_30_days");
  const [customStartDate, setCustomStartDate] = useState(() => passengerAnalyticsToday());
  const [customEndDate, setCustomEndDate] = useState(() => passengerAnalyticsToday());
  const [summary, setSummary] = useState<PassengerAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingBeta, setStartingBeta] = useState(false);
  const [betaMessage, setBetaMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminPassengerAnalyticsSummary({
        data: {
          adminKey,
          range: {
            preset: rangePreset,
            ...(rangePreset === "custom"
              ? { startDate: customStartDate, endDate: customEndDate }
              : {}),
          },
        },
      });
      setSummary(result as PassengerAnalyticsSummary);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load Passenger analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey, customEndDate, customStartDate, rangePreset]);

  useEffect(() => {
    void load();
  }, [load]);

  const startBeta = async () => {
    setStartingBeta(true);
    setError(null);
    setBetaMessage(null);
    try {
      const result = await startAdminPassengerAnalyticsBeta({ data: { adminKey } });
      setBetaMessage(
        `Beta measurement started ${new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(
          new Date(result.reportingStartedAt),
        )}. Earlier engineering data is excluded, not deleted.`,
      );
      await load();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start Passenger beta measurement.",
      );
    } finally {
      setStartingBeta(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase streex-tracking text-[#E6CE20]/75">Passenger only</p>
          <h2 className="mt-1 text-xl font-bold">Anonymous tablet activity</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/50">
            No names, bookings, addresses, GPS, device serials or passenger identity. These are
            tablet sessions, not confirmed rides.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Period
            <select
              value={rangePreset}
              onChange={(event) =>
                setRangePreset(event.target.value as PassengerAnalyticsRangePreset)
              }
              className="min-h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-xs font-medium normal-case tracking-normal text-white outline-none focus:border-[#E6CE20]/60"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="last_90_days">Last 90 days</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="all">All beta data</option>
              <option value="custom">Custom dates…</option>
            </select>
          </label>
          {rangePreset === "custom" && (
            <>
              <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                From
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="min-h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-[#E6CE20]/60"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                To
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="min-h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-[#E6CE20]/60"
                />
              </label>
            </>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 hover:text-white"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void startBeta()}
            disabled={startingBeta}
            className="rounded-lg border border-[#E6CE20]/45 px-3 py-2 text-xs font-semibold text-[#E6CE20] hover:bg-[#E6CE20]/10 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {startingBeta ? "Starting beta…" : "Start beta measurement"}
          </button>
        </div>
      </div>

      {betaMessage ? (
        <p className="rounded-xl border border-[#E6CE20]/20 bg-[#E6CE20]/[0.06] px-4 py-3 text-xs leading-relaxed text-[#f4e77c]">
          {betaMessage}
        </p>
      ) : summary?.reportingStartedAt ? (
        <p className="text-xs text-white/45">
          Beta measurement began{" "}
          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(summary.reportingStartedAt),
          )}
          . Earlier engineering data is excluded, not deleted.
        </p>
      ) : (
        <p className="text-xs text-white/45">
          Engineering data is currently included. Start beta measurement when you are ready to use
          this dashboard for passenger testing.
        </p>
      )}

      {summary?.range.startDate && (
        <p className="text-xs text-white/40">
          Showing {summary.range.startDate} through {summary.range.endDate} in Salt Lake City time.
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm text-white/55">
          Loading Passenger analytics…
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-red-400/25 bg-red-400/10 p-5 text-sm text-red-100">
          {error}
        </p>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Passenger engagements", summary.engagements],
              ["Idle wake-ups", summary.engagementSources.idle_resume ?? 0],
              ["Average engagement", formatPassengerDuration(summary.averageEngagementDurationMs)],
              ["First action", formatPassengerDuration(summary.averageFirstActionDelayMs)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black text-[#E6CE20]">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h3 className="font-semibold">Section use</h3>
              <div className="mt-4 space-y-2">
                {Object.entries(summary.byScreen).length ? (
                  Object.entries(summary.byScreen)
                    .sort(([, left], [, right]) => right - left)
                    .map(([screen, count]) => (
                      <div key={screen} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-white/65">
                          {screen.replaceAll("_", " ")}
                        </span>
                        <span className="font-semibold text-white">{count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-white/45">No Passenger activity recorded yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h3 className="font-semibold">Music, rest and technical health</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Music opened" value={summary.music.opened} />
                <Metric label="Music actions" value={summary.music.actions} />
                <Metric label="Idle entered" value={summary.idle.entered} />
                <Metric label="Logical rest" value={summary.idle.logicalRest} />
                <Metric label="Browser loads" value={summary.browserSessions} />
                <Metric
                  label="Loads without interaction"
                  value={summary.browserSessionsWithoutInteraction}
                />
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <h3 className="font-semibold">Games</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(summary.games).map(([game, counts]) => (
                <div key={game} className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold capitalize">{game.replaceAll("-", " ")}</p>
                  <p className="mt-2 text-xs text-white/50">
                    Opened {counts.opened} · Started {counts.started} · Finished {counts.completed}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-semibold">Usage map</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Anonymous paths from a Passenger engagement. This is semantic interaction flow,
                  never a touch-coordinate heatmap.
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#E6CE20]/75">
                Map of use
              </span>
            </div>
            {summary.usageMap.nodes.length ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Destinations
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {summary.usageMap.nodes.slice(0, 8).map((node) => (
                      <span
                        key={node.screen}
                        className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70"
                      >
                        {node.screen.replaceAll("_", " ")}{" "}
                        <b className="ml-1 text-[#E6CE20]">{node.count}</b>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Top routes
                  </p>
                  <div className="mt-3 space-y-2">
                    {summary.usageMap.flows.slice(0, 5).map((flow) => (
                      <p key={`${flow.from}-${flow.to}`} className="text-sm text-white/70">
                        <span className="capitalize">{flow.from.replaceAll("_", " ")}</span>
                        <span className="mx-2 text-[#E6CE20]">→</span>
                        <span className="capitalize">{flow.to.replaceAll("_", " ")}</span>
                        <b className="ml-2 text-white">{flow.count}</b>
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Top actions
                  </p>
                  <div className="mt-3 space-y-2">
                    {summary.usageMap.actions.slice(0, 5).map((action) => (
                      <p
                        key={`${action.screen}-${action.element}-${action.action}`}
                        className="text-sm text-white/70"
                      >
                        <span className="capitalize">{action.screen.replaceAll("_", " ")}</span>
                        <span className="mx-1 text-white/35">·</span>
                        <span>{action.action.replaceAll("_", " ")}</span>
                        <b className="ml-2 text-white">{action.count}</b>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/45">
                The map will appear after Passenger engagements are recorded.
              </p>
            )}

            {summary.usageMap.journeys.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Recent anonymous journeys
                </p>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {summary.usageMap.journeys.slice(0, 6).map((journey, index) => (
                    <div
                      key={journey.id}
                      className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5"
                    >
                      <p className="text-xs font-semibold text-white/80">
                        Engagement {index + 1} · {journey.entrySource.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        {journey.path.map((screen) => screen.replaceAll("_", " ")).join(" → ")}
                      </p>
                      <p className="mt-1 text-[11px] text-[#E6CE20]/80">
                        {journey.interactionCount} interactions ·{" "}
                        {formatPassengerDuration(journey.activeDurationMs)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <p className="text-xs text-white/40">
            {summary.interactiveEngagements} interactive Passenger engagements ·{" "}
            {summary.firstInteractions} first browser interactions ·{" "}
            {summary.lifecycle.tabletUnverified} unverified browser sessions ·{" "}
            {summary.lifecycle.driverConfirmed} confirmed by Driver MC.
          </p>
        </>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#E6CE20]">{value}</p>
    </div>
  );
}

function AdminDrivers({
  adminKey,
  session,
  onRefresh,
}: {
  adminKey: string;
  session: AdminSessionState;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    displayName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    slug: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const createDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await createDriverTenant({
        data: { ...form, ownerPhone: form.ownerPhone || null, adminKey },
      });
      setMessage(
        result.invited
          ? "Driver created and invitation sent."
          : "Driver created and linked to the existing user.",
      );
      setForm({ displayName: "", ownerName: "", ownerEmail: "", ownerPhone: "", slug: "" });
      await onRefresh();
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : "Unable to create driver.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <h2 className="text-lg font-semibold">Drivers and workspaces</h2>
        <div className="mt-4 space-y-3">
          {session.tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="rounded-xl border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{tenant.display_name}</p>
                <p className="text-xs text-white/45">
                  {tenant.id === "streex" ? "/" : `/${tenant.slug}`} · {tenant.owner_name} ·{" "}
                  {tenant.owner_email}
                </p>
                {tenant.onboarding && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      className={
                        tenant.onboarding.configurationReady ? "text-emerald-300" : "text-white/35"
                      }
                    >
                      Config {tenant.onboarding.configurationReady ? "ready" : "pending"}
                    </span>
                    <span
                      className={
                        tenant.onboarding.availabilityReady ? "text-emerald-300" : "text-white/35"
                      }
                    >
                      · Hours {tenant.onboarding.availabilityReady ? "ready" : "pending"}
                    </span>
                    <span
                      className={
                        tenant.onboarding.calendarConnected ? "text-emerald-300" : "text-white/35"
                      }
                    >
                      · Calendar {tenant.onboarding.calendarConnected ? "connected" : "pending"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/45">
                  {tenant.status}
                </span>
                {tenant.id !== "streex" && (
                  <select
                    value={tenant.status}
                    onChange={async (event) => {
                      setBusy(true);
                      try {
                        await updateTenantStatus({
                          data: {
                            adminKey,
                            tenantId: tenant.id,
                            status: event.target.value as
                              | "draft"
                              | "active"
                              | "suspended"
                              | "archived",
                          },
                        });
                        await onRefresh();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded-lg border border-white/10 bg-black px-2 py-1.5 text-xs"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="archived">Archived</option>
                  </select>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await sendTenantAccessLink({ data: { adminKey, tenantId: tenant.id } });
                      setMessage(`Access link sent to ${tenant.owner_email}.`);
                    } catch (linkError) {
                      setMessage(
                        linkError instanceof Error
                          ? linkError.message
                          : "Unable to send access link.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/70"
                >
                  Send access
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ownerName = window.prompt("New owner name", tenant.owner_name);
                    if (!ownerName) return;
                    const ownerEmail = window.prompt("New owner email", tenant.owner_email);
                    if (!ownerEmail) return;
                    setBusy(true);
                    try {
                      const result = await changeTenantOwner({
                        data: { adminKey, tenantId: tenant.id, ownerName, ownerEmail },
                      });
                      setMessage(
                        result.invited ? "Owner changed and invitation sent." : "Owner changed.",
                      );
                      await onRefresh();
                    } catch (ownerError) {
                      setMessage(
                        ownerError instanceof Error
                          ? ownerError.message
                          : "Unable to change owner.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/70"
                >
                  {tenant.id === "streex" ? "Assign driver owner" : "Change owner"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={createDriver}
        className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      >
        <h2 className="text-lg font-semibold">Add driver</h2>
        <p className="mt-1 text-xs text-white/45">
          Creates a private draft workspace and sends an invitation.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["displayName", "Public service name"],
              ["ownerName", "Driver name"],
              ["ownerEmail", "Driver email"],
              ["ownerPhone", "Phone"],
              ["slug", "Public URL slug"],
            ] as const
          ).map(([key, placeholder]) => (
            <input
              key={key}
              value={form[key]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              placeholder={placeholder}
              type={key === "ownerEmail" ? "email" : "text"}
              required={key !== "ownerPhone"}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
            />
          ))}
        </div>
        <button
          disabled={busy}
          className="mt-4 rounded-xl bg-[#E6CE20] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Working..." : "Create and invite"}
        </button>
      </form>
      {message && <p className="text-sm text-[#E6CE20]">{message}</p>}
    </section>
  );
}

function AdminBookings({ adminKey }: { adminKey: string }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<BookingRow["status"]>("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminBookings({ data: { adminKey } });
      setBookings((result.bookings ?? []) as BookingRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = Object.fromEntries(
    STATUS_TABS.map((s) => [s.key, bookings.filter((b) => b.status === s.key).length]),
  ) as Record<BookingRow["status"], number>;

  const visible = bookings.filter((b) => b.status === active);

  return (
    <section>
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                isActive
                  ? "bg-[#E6CE20] text-black border-[#E6CE20] font-semibold"
                  : "border-white/15 text-white/70 hover:text-white"
              }`}
            >
              {tab.label}{" "}
              <span className={isActive ? "opacity-70" : "opacity-50"}>
                ({counts[tab.key] ?? 0})
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 text-xs text-red-400/90 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-white/50">Loading...</p>}

      {!loading && visible.length === 0 && (
        <p className="text-sm text-white/30">No bookings in this category.</p>
      )}

      <div className="space-y-3">
        {visible.map((b) => (
          <BookingCard
            key={b.id}
            adminKey={adminKey}
            booking={b}
            onChange={load}
            setError={setError}
          />
        ))}
      </div>
    </section>
  );
}

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

type AvailabilityBlock = {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
};

type AgendaBooking = {
  id: string;
  name: string;
  phone: string;
  email: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  startAt: string | null;
  endAt: string | null;
  serviceType?: string | null;
  estimatedDurationMinutes?: number | null;
  passengers: number;
  price: number | null;
  status: string;
};

type BlockDraft = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
};

const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

function AdminAvailability({ adminKey }: { adminKey: string }) {
  const [activeDays, setActiveDays] = useState<Record<DayKey, boolean>>({
    sun: true,
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
  });
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [minNotice, setMinNotice] = useState(12);
  const [slotDuration, setSlotDuration] = useState(30);
  const [rideDuration, setRideDuration] = useState(60);
  const [timezone, setTimezone] = useState("America/Denver");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [agenda, setAgenda] = useState<AgendaBooking[]>([]);
  const [googleBusy, setGoogleBusy] = useState<CalendarGoogleBusyItem[]>([]);
  const [draft, setDraft] = useState<BlockDraft>(emptyBlock());
  const [adding, setAdding] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [sheetItem, setSheetItem] = useState<CalendarSheetItem | null>(null);
  const [calendarError, setCalendarError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminAvailability({ data: { adminKey } });
      const days = result.settings.daysActive;
      setActiveDays(indexesToDays(days));
      setStartTime(result.settings.startTime);
      setEndTime(result.settings.endTime);
      setMinNotice(result.settings.minNoticeHours);
      setSlotDuration(result.settings.slotDurationMinutes);
      setRideDuration(result.settings.defaultRideDurationMinutes);
      setTimezone(result.settings.timezone);
      setBlocks(result.blocks);
      setAgenda(result.agenda);
      setGoogleBusy(result.googleBusy ?? []);
      if (result.googleCalendarError) setError(result.googleCalendarError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load availability.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (key: DayKey) => setActiveDays((d) => ({ ...d, [key]: !d[key] }));

  const saveWindow = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateAdminAvailability({
        data: {
          adminKey,
          daysActive: daysToIndexes(activeDays),
          startTime,
          endTime,
          minNoticeHours: minNotice,
          slotDurationMinutes: slotDuration,
          defaultRideDurationMinutes: rideDuration,
          timezone,
        },
      });
      setMessage("Availability saved.");
      window.setTimeout(() => setMessage(null), 2500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async () => {
    if (!draft.startDate || !draft.endDate) return;
    setBlockSaving(true);
    setError(null);
    try {
      await createAdminBlockedSlot({
        data: {
          adminKey,
          startDate: draft.startDate,
          startTime: draft.startTime,
          endDate: draft.endDate,
          endTime: draft.endTime,
          reason: draft.reason,
        },
      });
      setDraft(emptyBlock());
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add block.");
    } finally {
      setBlockSaving(false);
    }
  };

  const removeBlock = async (id: string) => {
    if (!confirm("Delete this manual block?")) return;
    setError(null);
    const prev = blocks;
    setBlocks((b) => b.filter((x) => x.id !== id));
    try {
      await deleteAdminBlockedSlot({ data: { adminKey, id } });
      await load();
    } catch (e) {
      setBlocks(prev);
      setError(e instanceof Error ? e.message : "Failed to delete block.");
    }
  };

  const updateCalendarRideStatus = async (id: string, status: "completed" | "cancelled") => {
    const previousAgenda = agenda;
    setError(null);
    setSheetItem(null);
    setAgenda((items) => items.filter((item) => item.id !== id));

    try {
      await updateAdminBookingStatus({ data: { adminKey, id, status } });
      await load();
    } catch (e) {
      setAgenda(previousAgenda);
      setError(e instanceof Error ? e.message : "Failed to update booking.");
    }
  };

  const calendarAgenda = agenda
    .filter((a) => a.startAt)
    .map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      startAt: a.startAt,
      endAt: a.endAt,
      serviceType: a.serviceType,
      estimatedDurationMinutes: a.estimatedDurationMinutes,
      pickup: a.pickup,
      destination: a.destination,
      passengers: a.passengers,
      price: a.price,
    }));
  const calendarBlocks = blocks.map((b) => ({
    id: b.id,
    startAt: b.startAt,
    endAt: b.endAt,
    reason: b.reason,
  }));

  return (
    <section className="flex flex-col gap-5">
      {error && (
        <div className="text-xs text-red-400/90 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {message && (
        <div className="text-xs text-[#E6CE20] border border-[#E6CE20]/25 rounded-lg px-3 py-2">
          {message}
        </div>
      )}
      {loading && <p className="text-sm text-white/50">Loading availability...</p>}

      <AvailabilityCard
        title="Driver calendar"
        subtitle="Week view of confirmed, quoted, and blocked time in America/Denver."
      >
        {calendarError ? (
          <p className="text-xs text-white/45">
            Calendar failed to render. The list view below still shows your agenda.
          </p>
        ) : (
          <CalendarBoundary onError={() => setCalendarError(true)}>
            <AdminCalendar
              agenda={calendarAgenda}
              blocks={calendarBlocks}
              googleBusy={googleBusy}
              onSelect={setSheetItem}
            />
          </CalendarBoundary>
        )}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/55 pt-1">
          <LegendDot className="bg-[#E6CE20] text-black" label="Confirmed" />
          <LegendDot
            className="bg-[#E6CE20]/15 border border-[#E6CE20]/45 text-[#E6CE20]"
            label="Quoted"
          />
          <LegendDot
            className="bg-white/[0.08] border border-dashed border-white/25"
            label="Manual block"
          />
          <LegendDot className="bg-[#4285F4]/15 border border-[#4285F4]/45" label="Google busy" />
        </div>
      </AvailabilityCard>

      <AvailabilityCard
        title="Default availability window"
        subtitle="Passengers can request available slots inside this window. You still decide whether to quote and accept."
      >
        <div>
          <p className="text-[10px] uppercase streex-tracking text-white/40 mb-2">Active days</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_LABELS.map((d) => {
              const on = activeDays[d.key];
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`h-10 rounded-lg text-[11px] font-semibold transition-colors ${
                    on
                      ? "bg-[#E6CE20] text-black"
                      : "bg-white/[0.04] text-white/55 border border-white/10 hover:text-white"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AvField label="Start time">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={avInput}
            />
          </AvField>
          <AvField label="End time">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={avInput}
            />
          </AvField>
          <AvField label="Min. notice (hours)">
            <input
              type="number"
              min={0}
              value={minNotice}
              onChange={(e) => setMinNotice(Number(e.target.value))}
              className={avInput}
            />
          </AvField>
          <AvField label="Slot duration (min)">
            <input
              type="number"
              min={5}
              step={5}
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className={avInput}
            />
          </AvField>
          <AvField label="Default ride (min)">
            <input
              type="number"
              min={5}
              step={5}
              value={rideDuration}
              onChange={(e) => setRideDuration(Number(e.target.value))}
              className={avInput}
            />
          </AvField>
          <AvField label="Timezone">
            <div className={`${avInput} flex items-center text-white/70`}>{timezone}</div>
          </AvField>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-white/40">
            Quoted and confirmed rides block availability. Pending requests do not.
          </p>
          <button
            type="button"
            onClick={saveWindow}
            disabled={saving || loading}
            className="rounded-xl bg-[#E6CE20] text-black text-xs font-semibold px-4 py-2 hover:bg-[#E6CE20]/90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save window"}
          </button>
        </div>
      </AvailabilityCard>

      <AvailabilityCard
        title="Driver agenda"
        subtitle="Upcoming quoted and confirmed rides that are blocking availability."
      >
        {agenda.length === 0 ? (
          <p className="text-xs text-white/40">No quoted or confirmed rides on the agenda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agenda.map((ride) => (
              <li
                key={ride.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{ride.name}</p>
                    <p className="mt-1 text-xs text-white/55">
                      {formatServiceLabel(ride.serviceType, ride.estimatedDurationMinutes)} ·{" "}
                      {formatDateTime(ride.startAt)} · {ride.passengers} passenger
                      {ride.passengers === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#E6CE20]/25 bg-[#E6CE20]/10 px-2.5 py-1 text-[10px] uppercase streex-tracking text-[#E6CE20]">
                    {ride.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/65">
                  <span className="text-white/40">From</span> {ride.pickup}{" "}
                  <span className="text-white/40">→</span> {ride.destination}
                </p>
                {ride.price != null && (
                  <p className="mt-1 text-xs text-[#E6CE20]">${Number(ride.price).toFixed(2)}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </AvailabilityCard>

      <AvailabilityCard
        title="Manual blocks"
        subtitle="Hold time off the calendar for personal commitments or maintenance."
      >
        {blocks.length === 0 && !adding && (
          <p className="text-xs text-white/40">No manual blocks. Add one below.</p>
        )}

        {blocks.length > 0 && (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
                  </p>
                  {b.reason && (
                    <p className="text-[11px] text-white/50 mt-0.5 truncate">{b.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeBlock(b.id)}
                  className="shrink-0 text-[11px] text-white/50 hover:text-red-300"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <AvField label="Start date">
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  className={avInput}
                />
              </AvField>
              <AvField label="Start time">
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                  className={avInput}
                />
              </AvField>
              <AvField label="End date">
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  className={avInput}
                />
              </AvField>
              <AvField label="End time">
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                  className={avInput}
                />
              </AvField>
            </div>
            <AvField label="Reason (optional)">
              <input
                type="text"
                value={draft.reason}
                placeholder="e.g. Family commitment"
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                className={avInput}
              />
            </AvField>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setDraft(emptyBlock());
                }}
                className="rounded-lg px-3 py-2 text-xs text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addBlock}
                disabled={blockSaving}
                className="rounded-lg bg-[#E6CE20] text-black text-xs font-semibold px-3 py-2 hover:bg-[#E6CE20]/90 disabled:opacity-60"
              >
                {blockSaving ? "Adding..." : "Add block"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="self-start rounded-xl border border-dashed border-white/15 px-3 py-2 text-xs text-white/70 hover:border-[#E6CE20]/50 hover:text-white"
          >
            + Add block
          </button>
        )}
      </AvailabilityCard>

      <div className="rounded-2xl border border-[#E6CE20]/20 bg-[#E6CE20]/[0.05] px-4 py-3">
        <p className="text-[11px] uppercase streex-tracking text-[#E6CE20]/80 mb-1">
          Booking protection
        </p>
        <p className="text-xs text-white/70 leading-relaxed">
          Confirmed and quoted rides block availability automatically.
        </p>
      </div>

      <AvailabilityCard
        title="Google Calendar"
        subtitle="Connect Google, choose calendars that block availability, and select the dedicated STREEX Rides calendar."
      >
        <GoogleCalendarConnectionCard adminKey={adminKey} />
      </AvailabilityCard>

      <AdminCalendarEventSheet
        item={sheetItem}
        open={sheetItem !== null}
        onClose={() => setSheetItem(null)}
        onComplete={(id) => void updateCalendarRideStatus(id, "completed")}
        onCancel={(id) => void updateCalendarRideStatus(id, "cancelled")}
        onDeleteBlock={(id) => {
          setSheetItem(null);
          void removeBlock(id);
        }}
      />
    </section>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded ${className}`} />
      <span>{label}</span>
    </span>
  );
}

class CalendarBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const avInput =
  "w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40 transition-colors";

function AvField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase streex-tracking text-white/40">{label}</span>
      {children}
    </label>
  );
}

function AvailabilityCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-4">
      <header>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/45 mt-1">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function emptyBlock(): BlockDraft {
  return { startDate: "", startTime: "08:00", endDate: "", endTime: "10:00", reason: "" };
}

function indexesToDays(days: number[]): Record<DayKey, boolean> {
  return {
    sun: days.includes(0),
    mon: days.includes(1),
    tue: days.includes(2),
    wed: days.includes(3),
    thu: days.includes(4),
    fri: days.includes(5),
    sat: days.includes(6),
  };
}

function daysToIndexes(days: Record<DayKey, boolean>) {
  return DAY_LABELS.map((day, index) => (days[day.key] ? index : null)).filter(
    (day): day is number => day !== null,
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Time not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatServiceLabel(serviceType?: string | null, duration?: number | null) {
  if (serviceType === "hourly") {
    const hours = duration ? Math.round(duration / 60) : null;
    return `Hourly Service${hours ? ` · ${hours} hr` : ""}`;
  }

  return "Point to Point";
}

// ─────────────────────────────────────────────────────────────────────────────
type AdminServiceDraft = {
  id: string;
  name: string;
  price: string;
  enabled: boolean;
};

type AdminSectionKey = keyof AppConfig["sections"];

type PassengerExperienceMode = AppConfig["passengerConsole"]["experienceMode"];

function adminProfileFromConfig(config: AppConfig) {
  return {
    brandName: config.brandName,
    ownerName: config.ownerName,
    phone: config.phoneDisplay,
    email: config.email,
    website: config.website,
    instagram: config.instagram,
    whatsapp: config.whatsapp,
    google: config.googleReviews,
    nextdoor: config.nextdoor,
    tagline: config.tagline,
    subheadline: config.subheadline,
  };
}

function adminServicesFromConfig(config: AppConfig): AdminServiceDraft[] {
  return config.services.map((service) => ({
    id: service.id,
    name: service.name,
    price: service.price,
    enabled: service.enabled,
  }));
}

function AdminConfig({ adminKey, tenantId }: { adminKey: string; tenantId: string }) {
  const [profile, setProfile] = useState(() => adminProfileFromConfig(CONFIG));

  const [services, setServices] = useState<AdminServiceDraft[]>(() =>
    adminServicesFromConfig(CONFIG),
  );

  const [sections, setSections] = useState<Record<AdminSectionKey, boolean>>(
    () => ({ ...CONFIG.sections }) as Record<AdminSectionKey, boolean>,
  );
  const [media, setMedia] = useState(() => ({
    logoSrc: CONFIG.logoSrc,
    meetPhoto: CONFIG.meetPhoto,
    ogImage: CONFIG.ogImage,
    galleryImages: CONFIG.galleryImages.map((item) => ({ ...item })),
  }));
  const [uploading, setUploading] = useState<string | null>(null);
  const [areasText, setAreasText] = useState(CONFIG.areas.join("\n"));
  const [seo, setSeo] = useState({ title: CONFIG.seoTitle, description: CONFIG.seoDescription });
  const [passengerExperienceMode, setPassengerExperienceMode] = useState<PassengerExperienceMode>(
    CONFIG.passengerConsole.experienceMode,
  );
  const [passengerVisualTheme, setPassengerVisualTheme] = useState<PassengerVisualTheme | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = (key: keyof typeof profile, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const updateService = (id: string, patch: Partial<AdminServiceDraft>) =>
    setServices((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const toggleSection = (key: AdminSectionKey) =>
    setSections((current) => ({ ...current, [key]: !current[key] }));

  const handleAssetUpload = async (
    slot: string,
    kind: TenantAssetKind,
    file: File,
    applyUrl: (url: string) => void,
  ) => {
    setUploading(slot);
    setError(null);
    try {
      applyUrl(await uploadTenantAsset(tenantId, kind, file));
      setMessage("Image uploaded. Save config to publish it.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploading(null);
    }
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminSiteConfig({ data: { adminKey } });
      setProfile(adminProfileFromConfig(result.config));
      setServices(adminServicesFromConfig(result.config));
      setSections({ ...result.config.sections } as Record<AdminSectionKey, boolean>);
      setMedia({
        logoSrc: result.config.logoSrc,
        meetPhoto: result.config.meetPhoto,
        ogImage: result.config.ogImage,
        galleryImages: result.config.galleryImages.map((item) => ({ ...item })),
      });
      setAreasText(result.config.areas.join("\n"));
      setSeo({ title: result.config.seoTitle, description: result.config.seoDescription });
      setPassengerExperienceMode(result.config.passengerConsole.experienceMode);
      setPassengerVisualTheme(result.config.passengerConsole.visualTheme ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load site config.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateAdminSiteConfig({
        data: {
          adminKey,
          config: {
            brandName: profile.brandName,
            ownerName: profile.ownerName,
            tagline: profile.tagline,
            subheadline: profile.subheadline,
            phoneDisplay: profile.phone,
            email: profile.email,
            website: profile.website,
            instagram: profile.instagram,
            whatsapp: profile.whatsapp,
            googleReviews: profile.google,
            nextdoor: profile.nextdoor,
            services,
            sections,
            logoSrc: media.logoSrc,
            meetPhoto: media.meetPhoto,
            ogImage: media.ogImage,
            galleryImages: media.galleryImages,
            areas: areasText
              .split("\n")
              .map((area) => area.trim())
              .filter(Boolean),
            seoTitle: seo.title,
            seoDescription: seo.description,
            passengerConsole: {
              experienceMode: passengerExperienceMode,
              visualTheme: passengerVisualTheme ?? undefined,
            },
          },
        },
      });
      setMessage("Config saved. The public site will use these values on refresh.");
      window.setTimeout(() => setMessage(null), 3200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const sectionLabels: Partial<Record<AdminSectionKey, string>> = {
    textMe: "Text Me",
    callMe: "Call Me",
    saveContact: "Save Contact",
    scheduleRide: "Schedule Ride",
    moreOptions: "Streex Horizon",
    experienceGallery: "Experience Gallery",
    servicesGrid: "Services Grid",
    serviceAreas: "Service Areas",
    reviews: "Reviews",
    whyStreex: "Why Streex",
    meetJuan: "Meet Juan",
    paymentOptions: "Payment Options",
    findUs: "Find Us",
    feedbackForm: "Feedback Form",
    faq: "Frequently Asked Questions",
  };

  return (
    <form onSubmit={handleSave} className="relative space-y-6">
      <div className="rounded-2xl border border-[#E6CE20]/15 bg-[#E6CE20]/[0.04] px-4 py-3">
        <div className="flex items-start gap-3">
          <Settings2 className="h-4 w-4 mt-0.5 text-[#E6CE20]" />
          <div>
            <p className="text-[11px] uppercase streex-tracking text-[#E6CE20]/90 font-semibold">
              Config v2
            </p>
            <p className="mt-1 text-xs text-white/55 leading-relaxed">
              Edit the public Streex profile. The landing uses these saved values with code config
              as fallback.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase streex-tracking text-[#E6CE20]/80">
              Passenger Console
            </p>
            <h2 className="mt-1 text-base font-semibold">Default experience mode</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/50">
              This is the persistent tablet mode. Lite is the daily Passenger experience; Complete
              is reserved for the later personalized experience.
            </p>
          </div>
          <div className="flex rounded-xl border border-white/10 p-1">
            {(["lite", "complete"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPassengerExperienceMode(mode)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold capitalize transition ${
                  passengerExperienceMode === mode
                    ? "bg-[#E6CE20] text-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      <PassengerVisualThemeControl
        value={getPassengerVisualTheme({
          ...CONFIG.passengerConsole,
          experienceMode: passengerExperienceMode,
          visualTheme: passengerVisualTheme,
        })}
        onChange={setPassengerVisualTheme}
      />

      {loading && <p className="text-sm text-white/50">Loading config...</p>}

      {error && (
        <div className="text-xs text-red-400/90 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {message && (
        <div className="text-xs text-[#E6CE20] border border-[#E6CE20]/25 rounded-lg px-3 py-2">
          {message}
        </div>
      )}

      <ConfigGroup title="Identity" subtitle="How Streex is presented to passengers.">
        <ConfigField
          label="Business name"
          value={profile.brandName}
          onChange={(v) => updateProfile("brandName", v)}
        />
        <ConfigField
          label="Driver name"
          value={profile.ownerName}
          onChange={(v) => updateProfile("ownerName", v)}
        />
        <ConfigField
          label="Tagline"
          value={profile.tagline}
          onChange={(v) => updateProfile("tagline", v)}
          placeholder="Private rides. Elevated."
        />
        <ConfigField
          label="Subheadline"
          value={profile.subheadline}
          onChange={(v) => updateProfile("subheadline", v)}
          multiline
        />
      </ConfigGroup>

      <ConfigGroup title="Contact" subtitle="Direct lines passengers can use.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ConfigField
            label="Phone"
            value={profile.phone}
            onChange={(v) => updateProfile("phone", v)}
          />
          <ConfigField
            label="Email"
            value={profile.email}
            onChange={(v) => updateProfile("email", v)}
            type="email"
          />
          <ConfigField
            label="Website"
            value={profile.website}
            onChange={(v) => updateProfile("website", v)}
          />
          <ConfigField
            label="Instagram"
            value={profile.instagram}
            onChange={(v) => updateProfile("instagram", v)}
            prefix="@"
          />
          <ConfigField
            label="WhatsApp"
            value={profile.whatsapp}
            onChange={(v) => updateProfile("whatsapp", v)}
          />
          <ConfigField
            label="Google link"
            value={profile.google}
            onChange={(v) => updateProfile("google", v)}
          />
          <ConfigField
            label="Nextdoor link"
            value={profile.nextdoor}
            onChange={(v) => updateProfile("nextdoor", v)}
          />
        </div>
      </ConfigGroup>

      <ConfigGroup
        title="Photos and brand"
        subtitle="Images are private to this workspace and publish with the saved config."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AssetUploadField
            label="Logo"
            value={media.logoSrc}
            busy={uploading === "logo"}
            onUpload={(file) =>
              handleAssetUpload("logo", "brand", file, (url) =>
                setMedia((current) => ({ ...current, logoSrc: url })),
              )
            }
          />
          <AssetUploadField
            label="Driver photo"
            value={media.meetPhoto}
            busy={uploading === "profile"}
            onUpload={(file) =>
              handleAssetUpload("profile", "profile", file, (url) =>
                setMedia((current) => ({ ...current, meetPhoto: url })),
              )
            }
          />
          <AssetUploadField
            label="Social preview"
            value={media.ogImage}
            busy={uploading === "og"}
            onUpload={(file) =>
              handleAssetUpload("og", "brand", file, (url) =>
                setMedia((current) => ({ ...current, ogImage: url })),
              )
            }
          />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {media.galleryImages.map((item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-xl border border-white/10 p-3">
              <ConfigField
                label={`Gallery ${index + 1} label`}
                value={item.label}
                onChange={(label) =>
                  setMedia((current) => ({
                    ...current,
                    galleryImages: current.galleryImages.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, label } : entry,
                    ),
                  }))
                }
              />
              <div className="mt-3">
                <AssetUploadField
                  label="Image"
                  value={item.image}
                  busy={uploading === `gallery-${index}`}
                  onUpload={(file) =>
                    handleAssetUpload(`gallery-${index}`, "gallery", file, (url) =>
                      setMedia((current) => ({
                        ...current,
                        galleryImages: current.galleryImages.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, image: url } : entry,
                        ),
                      })),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </ConfigGroup>

      <ConfigGroup title="Services" subtitle="Toggle and name what appears in the services grid.">
        <div className="space-y-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[10px] uppercase streex-tracking text-white/40">{s.id}</span>
                <button
                  type="button"
                  onClick={() => updateService(s.id, { enabled: !s.enabled })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    s.enabled ? "bg-[#E6CE20]" : "bg-white/15"
                  }`}
                  aria-pressed={s.enabled}
                  aria-label={`Toggle ${s.name}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-transform ${
                      s.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={s.name}
                  onChange={(e) => updateService(s.id, { name: e.target.value })}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40"
                />
                <input
                  value={s.price}
                  onChange={(e) => updateService(s.id, { price: e.target.value })}
                  className="w-full sm:w-44 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-[#E6CE20] placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40"
                />
              </div>
            </div>
          ))}
        </div>
      </ConfigGroup>

      <ConfigGroup
        title="Service areas and SEO"
        subtitle="One destination per line. These values also help search engines describe the page."
      >
        <ConfigField label="Areas served" value={areasText} onChange={setAreasText} multiline />
        <div className="mt-4 space-y-3">
          <ConfigField
            label="SEO title"
            value={seo.title}
            onChange={(title) => setSeo((current) => ({ ...current, title }))}
          />
          <ConfigField
            label="SEO description"
            value={seo.description}
            onChange={(description) => setSeo((current) => ({ ...current, description }))}
            multiline
          />
        </div>
      </ConfigGroup>

      <ConfigGroup title="Sections" subtitle="Show or hide sections on the public landing page.">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(sectionLabels) as AdminSectionKey[]).map((key) => {
            const on = !!sections[key];
            const label = sectionLabels[key];
            if (!label) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSection(key)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  on
                    ? "border-[#E6CE20]/40 bg-[#E6CE20]/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <span className="text-sm text-white/85">{label}</span>
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    on ? "bg-[#E6CE20]" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-transform ${
                      on ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </ConfigGroup>

      <div className="sticky bottom-3 z-10 -mx-1">
        <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
          <p className="text-[11px] text-white/50">
            {message ? "Saved to the live site." : "Changes publish when you save."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await getTenantPreviewLink({ data: { adminKey } });
                  window.open(result.url, "_blank", "noopener,noreferrer");
                } catch (previewError) {
                  setError(
                    previewError instanceof Error ? previewError.message : "Preview unavailable.",
                  );
                }
              }}
              className="rounded-full border border-white/15 text-white text-xs px-4 py-2"
            >
              Preview
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-full bg-[#E6CE20] text-black text-xs font-semibold px-4 py-2 hover:bg-[#E6CE20]/90 transition-colors"
            >
              {saving ? "Saving..." : "Save config"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ConfigGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-4 sm:p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/45 mt-1">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function AssetUploadField({
  label,
  value,
  busy,
  onUpload,
}: {
  label: string;
  value: string;
  busy: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase streex-tracking text-white/45 mb-1.5">
        {label}
      </span>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <img src={value} alt="" className="h-28 w-full object-cover" />
        <div className="p-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
            className="block w-full text-xs text-white/55 file:mr-3 file:rounded-full file:border-0 file:bg-[#E6CE20] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
          />
          {busy && <p className="mt-1 text-[10px] text-[#E6CE20]">Uploading…</p>}
        </div>
      </div>
    </label>
  );
}

function ConfigField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  type = "text",
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  prefix?: string;
}) {
  const base =
    "w-full rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40 transition-colors";
  return (
    <label className="block">
      <span className="block text-[10px] uppercase streex-tracking text-white/45 mb-1.5">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${base} px-3 py-2 resize-none`}
        />
      ) : (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
              {prefix}
            </span>
          )}
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${base} ${prefix ? "pl-7 pr-3" : "px-3"} py-2`}
          />
        </div>
      )}
    </label>
  );
}

function BookingCard({
  booking,
  adminKey,
  onChange,
  setError,
}: {
  booking: BookingRow;
  adminKey: string;
  onChange: () => void;
  setError: (s: string | null) => void;
}) {
  const [price, setPrice] = useState<string>(booking.price != null ? String(booking.price) : "");
  const [busy, setBusy] = useState(false);

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChange();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const doQuote = () => {
    const n = Number(price);
    if (!n || n <= 0) {
      setError("Enter a valid price.");
      return;
    }
    wrap(() => sendAdminQuote({ data: { adminKey, id: booking.id, price: n } }));
  };

  const doStatus = (status: "confirmed" | "declined" | "completed" | "cancelled") =>
    wrap(() => updateAdminBookingStatus({ data: { adminKey, id: booking.id, status } }));

  const rejectRequest = () => {
    if (!confirm("Reject this request and notify the passenger by email?")) return;
    doStatus("declined");
  };

  const retryCalendarSync = () =>
    wrap(() => retryAdminBookingCalendarSync({ data: { adminKey, id: booking.id } }));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[15px] font-semibold text-white">{booking.name}</div>
          <div className="text-xs text-white/55 mt-0.5">
            {booking.phone} &middot; {booking.email}
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#E6CE20]/90 font-semibold">
          {booking.status}
        </span>
      </div>

      <div className="text-sm text-white/85 mb-1">
        <span className="text-white/55">From</span> {booking.pickup}{" "}
        <span className="text-white/55">→</span> {booking.destination}
      </div>
      <div className="text-xs text-white/60 mb-2">
        {formatServiceLabel(booking.service_type, booking.estimated_duration_minutes)} &middot;{" "}
        {booking.date} at {booking.time} &middot; {booking.passengers} passenger
        {booking.passengers === 1 ? "" : "s"}
        {booking.price != null && (
          <>
            {" "}
            &middot; <span className="text-[#E6CE20]">${Number(booking.price).toFixed(2)}</span>
          </>
        )}
      </div>
      {booking.notes && (
        <p className="text-xs text-white/55 italic mb-2 whitespace-pre-wrap">
          &ldquo;{booking.notes}&rdquo;
        </p>
      )}
      <div className="text-[11px] text-white/35 mb-3">
        {new Date(booking.created_at).toLocaleString()}
      </div>

      {booking.google_sync_status === "synced" && booking.status === "confirmed" && (
        <p className="mb-3 text-[11px] text-emerald-300/75">Google Calendar synced</p>
      )}
      {booking.google_sync_status === "deleted" && booking.status === "cancelled" && (
        <p className="mb-3 text-[11px] text-white/40">Removed from Google Calendar</p>
      )}
      {booking.status === "confirmed" && booking.google_sync_status === "not_synced" && (
        <button
          type="button"
          disabled={busy}
          onClick={retryCalendarSync}
          className="mb-3 text-[11px] font-semibold text-[#E6CE20] disabled:opacity-50"
        >
          Add this ride to Google Calendar
        </button>
      )}
      {booking.google_sync_status === "pending" && (
        <div className="mb-3 flex items-center gap-3 text-[11px] text-white/50">
          <span>Google Calendar sync pending</span>
          <button
            type="button"
            disabled={busy}
            onClick={retryCalendarSync}
            className="font-semibold text-[#E6CE20] disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}
      {booking.google_sync_status === "error" && (
        <div className="mb-3 rounded-lg border border-red-400/25 bg-red-400/[0.05] px-3 py-2">
          <p className="text-[11px] text-red-300">
            Calendar sync failed: {booking.google_sync_error || "Unknown error"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={retryCalendarSync}
            className="mt-2 text-[11px] font-semibold text-[#E6CE20] disabled:opacity-50"
          >
            Retry Google Calendar sync
          </button>
        </div>
      )}

      {booking.status === "pending" && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              className="w-full rounded-full bg-white/[0.05] border border-white/10 pl-7 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40"
            />
          </div>
          <button
            disabled={busy}
            onClick={doQuote}
            className="text-xs rounded-full px-4 py-2 bg-[#E6CE20] text-black font-semibold disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send Quote"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={rejectRequest}
            className="text-xs rounded-full px-4 py-2 border border-red-400/30 text-red-300 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}

      {booking.status === "quoted" && (
        <button
          disabled={busy}
          onClick={() => doStatus("cancelled")}
          className="text-xs rounded-full px-3 py-1.5 border border-white/20 text-white/85 disabled:opacity-60"
        >
          Cancel
        </button>
      )}

      {booking.status === "confirmed" && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => doStatus("completed")}
            className="text-xs rounded-full px-3 py-1.5 bg-[#E6CE20] text-black font-semibold disabled:opacity-60"
          >
            Mark as Completed
          </button>
          <button
            disabled={busy}
            onClick={() => doStatus("cancelled")}
            className="text-xs rounded-full px-3 py-1.5 border border-white/20 text-white/85 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function AdminReviews({ adminKey }: { adminKey: string }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminReviews({ data: { adminKey } });
      setReviews((result.reviews ?? []) as ReviewRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: ReviewRow["status"]) => {
    const prev = reviews;
    setReviews((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      await updateAdminReviewStatus({ data: { adminKey, id, status } });
    } catch (e) {
      setReviews(prev);
      setError(e instanceof Error ? e.message : "Failed to update review.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    const prev = reviews;
    setReviews((r) => r.filter((x) => x.id !== id));
    try {
      await deleteAdminReview({ data: { adminKey, id } });
    } catch (e) {
      setReviews(prev);
      setError(e instanceof Error ? e.message : "Failed to delete review.");
    }
  };

  const sections: { key: ReviewRow["status"]; label: string }[] = [
    { key: "pending", label: "Pending Reviews" },
    { key: "approved", label: "Approved Reviews" },
    { key: "rejected", label: "Rejected Reviews" },
  ];

  return (
    <section>
      {error && (
        <div className="mb-4 text-xs text-red-400/90 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-white/50">Loading...</p>}

      {!loading &&
        sections.map((section) => {
          const items = reviews.filter((r) => r.status === section.key);
          return (
            <section key={section.key} className="mb-10">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-3">
                {section.label} ({items.length})
              </h2>
              {items.length === 0 ? (
                <p className="text-sm text-white/30">No reviews.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-3.5 w-3.5 text-[#E6CE20]"
                            fill="#E6CE20"
                            strokeWidth={0}
                          />
                        ))}
                      </div>
                      <p className="text-[14px] text-white/85 mb-3 whitespace-pre-wrap">
                        {r.message}
                      </p>
                      <div className="text-xs text-white/55">
                        <span className="text-white/85 font-semibold">
                          {r.name?.trim() || "Streex Passenger"}
                        </span>
                        {" · "}
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status !== "approved" && (
                          <button
                            onClick={() => updateStatus(r.id, "approved")}
                            className="text-xs rounded-full px-3 py-1.5 bg-[#E6CE20] text-black font-semibold"
                          >
                            Approve
                          </button>
                        )}
                        {r.status !== "rejected" && (
                          <button
                            onClick={() => updateStatus(r.id, "rejected")}
                            className="text-xs rounded-full px-3 py-1.5 border border-white/20 text-white/85"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          className="text-xs rounded-full px-3 py-1.5 border border-red-400/30 text-red-400/90"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
    </section>
  );
}

function AdminRunnerScores({ adminKey }: { adminKey: string }) {
  const [scores, setScores] = useState<RunnerScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminRunnerScores({ data: { adminKey } });
      setScores((result.scores ?? []) as RunnerScoreRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Horizon scores.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: RunnerScoreRow["status"]) => {
    const prev = scores;
    setScores((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
    try {
      await updateAdminRunnerScoreStatus({ data: { adminKey, id, status } });
    } catch (e) {
      setScores(prev);
      setError(e instanceof Error ? e.message : "Failed to update Horizon score.");
    }
  };

  const editScore = async (id: string, name: string, score: number) => {
    const prev = scores;
    setScores((items) => items.map((item) => (item.id === id ? { ...item, name, score } : item)));
    try {
      await updateAdminRunnerScore({ data: { adminKey, id, name, score } });
    } catch (e) {
      setScores(prev);
      setError(e instanceof Error ? e.message : "Failed to edit Horizon score.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this Horizon score permanently?")) return;
    const prev = scores;
    setScores((items) => items.filter((item) => item.id !== id));
    try {
      await deleteAdminRunnerScore({ data: { adminKey, id } });
    } catch (e) {
      setScores(prev);
      setError(e instanceof Error ? e.message : "Failed to delete Horizon score.");
    }
  };

  const sections: { key: RunnerScoreRow["status"]; label: string }[] = [
    { key: "pending", label: "Pending Scores" },
    { key: "approved", label: "Approved Leaderboard" },
    { key: "rejected", label: "Rejected Scores" },
  ];

  return (
    <section>
      <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-lg font-semibold">Horizon Records</h2>
        <p className="mt-1 text-sm text-white/55">
          Approve scores before they appear publicly in the Horizon leaderboard.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-xs text-red-400/90 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-white/50">Loading...</p>}

      {!loading &&
        sections.map((section) => {
          const items = scores.filter((score) => score.status === section.key);
          return (
            <section key={section.key} className="mb-10">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-3">
                {section.label} ({items.length})
              </h2>
              {items.length === 0 ? (
                <p className="text-sm text-white/30">No records.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((score) => (
                    <RunnerScoreCard
                      key={score.id}
                      score={score}
                      onEdit={editScore}
                      onStatus={updateStatus}
                      onDelete={remove}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
    </section>
  );
}

function RunnerScoreCard({
  score,
  onEdit,
  onStatus,
  onDelete,
}: {
  score: RunnerScoreRow;
  onEdit: (id: string, name: string, score: number) => Promise<void>;
  onStatus: (id: string, status: RunnerScoreRow["status"]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(score.name);
  const [scoreValue, setScoreValue] = useState(String(score.score));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(score.name);
    setScoreValue(String(score.score));
  }, [score.name, score.score]);

  const changed = name.trim() !== score.name || Number(scoreValue) !== score.score;

  const saveEdit = async () => {
    const nextName = name.trim();
    const nextScore = Number(scoreValue);
    if (!nextName || !Number.isInteger(nextScore) || nextScore < 0) return;
    setBusy(true);
    try {
      await onEdit(score.id, nextName, nextScore);
    } finally {
      setBusy(false);
    }
  };

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#E6CE20]/80 font-semibold">
            {score.status}
          </span>
          <div className="mt-1 text-xs text-white/40">
            {new Date(score.created_at).toLocaleString()}
          </div>
        </div>
        <strong className="text-3xl leading-none text-[#E6CE20]">{score.score}</strong>
      </div>

      <div className="grid grid-cols-[1fr_96px] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          className="min-w-0 rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40"
        />
        <input
          type="number"
          min="0"
          value={scoreValue}
          onChange={(e) => setScoreValue(e.target.value)}
          className="min-w-0 rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E6CE20]/40"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={busy || !changed}
          onClick={saveEdit}
          className="text-xs rounded-full px-3 py-1.5 bg-[#E6CE20] text-black font-semibold disabled:opacity-50"
        >
          Save Edit
        </button>
        {score.status !== "approved" && (
          <button
            disabled={busy}
            onClick={() => wrap(() => onStatus(score.id, "approved"))}
            className="text-xs rounded-full px-3 py-1.5 border border-white/20 text-white/85 disabled:opacity-60"
          >
            Approve
          </button>
        )}
        {score.status !== "pending" && (
          <button
            disabled={busy}
            onClick={() => wrap(() => onStatus(score.id, "pending"))}
            className="text-xs rounded-full px-3 py-1.5 border border-white/20 text-white/85 disabled:opacity-60"
          >
            Pending
          </button>
        )}
        {score.status !== "rejected" && (
          <button
            disabled={busy}
            onClick={() => wrap(() => onStatus(score.id, "rejected"))}
            className="text-xs rounded-full px-3 py-1.5 border border-white/20 text-white/85 disabled:opacity-60"
          >
            Reject
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => wrap(() => onDelete(score.id))}
          className="text-xs rounded-full px-3 py-1.5 border border-red-400/30 text-red-400/90 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AdminThemes({ adminKey }: { adminKey: string }) {
  const fallback: TickerStyle = CONFIG.tickerStyle === "pill" ? "pill" : "boarding";
  const [tickerStyle, setTickerStyle] = useState<TickerStyle>(fallback);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getAdminTickerTheme({ data: { adminKey } });
        if (!cancelled) setTickerStyle(result.tickerStyle);
      } catch (error) {
        console.warn("[AdminThemes] Using default ticker style.", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminKey]);
  const themeOptions: Array<{
    key: TickerStyle;
    label: string;
    description: string;
  }> = [
    {
      key: "boarding",
      label: "Airport Boarding",
      description: "LED board inspired ticker using Streex black, yellow, and white.",
    },
    {
      key: "pill",
      label: "Clean Pills",
      description: "The simpler capsule ticker style kept as an alternate option.",
    },
  ];

  const saveTheme = async (nextStyle: TickerStyle) => {
    setSaving(nextStyle);
    setMessage(null);
    const previous = tickerStyle;
    try {
      const result = await updateAdminTickerTheme({
        data: { adminKey, tickerStyle: nextStyle },
      });
      if (!result?.ok || result.tickerStyle !== nextStyle) {
        throw new Error("Server did not confirm the theme change.");
      }
      setTickerStyle(nextStyle);
      window.dispatchEvent(
        new CustomEvent("streex:ticker-theme-changed", { detail: { tickerStyle: nextStyle } }),
      );
      setMessage("Theme saved.");
    } catch (e) {
      setTickerStyle(previous);
      setMessage(e instanceof Error ? e.message : "Failed to save theme.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-lg font-semibold">Ticker Theme</h2>
        <p className="mt-1 text-sm text-white/55">
          Current theme: <span className="text-[#E6CE20]">{loaded ? tickerStyle : "loading…"}</span>
        </p>
        <p className="mt-3 text-xs text-white/40">
          This saves the active ticker style in Lovable Cloud. The code config remains the fallback.
        </p>
        {message && <p className="mt-3 text-xs text-white/65">{message}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {themeOptions.map((theme) => {
          const selected = theme.key === tickerStyle;
          return (
            <button
              key={theme.key}
              type="button"
              onClick={() => saveTheme(theme.key)}
              disabled={saving !== null}
              className={`rounded-xl border p-4 ${
                selected ? "border-[#E6CE20]/70 bg-[#E6CE20]/10" : "border-white/10 bg-white/[0.03]"
              } text-left disabled:opacity-60`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{theme.label}</h3>
                {selected && (
                  <span className="rounded-full bg-[#E6CE20] px-2 py-0.5 text-[10px] font-semibold text-black">
                    {saving === theme.key ? "Saving" : "Active"}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/55">{theme.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
