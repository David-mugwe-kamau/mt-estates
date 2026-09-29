"use client";

import { useEffect, useState } from "react";
import { getUser, getToken, logout } from "@/lib/auth";
import { auth } from "@/lib/api";
import type { UserResponse } from "@/lib/api";
import { canManageListings, isRentalLandlord, isAirbnbHost, isPlatformAdmin } from "@/lib/roles";

export default function DashboardPage() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login";
      return;
    }

    // Try to get fresh user data from the API
    auth.me(token)
      .then((u) => setUser(u))
      .catch(() => {
        // Fall back to localStorage data
        const local = getUser<UserResponse>();
        if (local) setUser(local);
        else window.location.href = "/auth/login";
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const isLandlord = isRentalLandlord(user.roles);
  const isHost = isAirbnbHost(user.roles);
  const showListings = canManageListings(user.roles);
  const showAdmin = isPlatformAdmin(user);
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-mt-blue to-mt-blue/80 px-6 py-7 text-white shadow-md">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-white/40" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-extrabold">
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-white/70">Welcome back</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{user.name}</h1>
            <p className="text-sm text-white/70">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          href="/rentals"
          icon="🏠"
          title="Browse Rentals"
          desc="Find a home to rent near you"
          color="blue"
        />
        <QuickCard
          href="/airbnbs"
          icon="🛏️"
          title="Browse Airbnbs"
          desc="Book short-stay spaces"
          color="orange"
        />
        <QuickCard
          href="/for-sale"
          icon="🏡"
          title="Properties for Sale"
          desc="Find your dream home"
          color="blue"
        />
        <QuickCard
          href="/dashboard/wishlist"
          icon="❤️"
          title="My Wishlist"
          desc="Saved listings and properties"
          color="orange"
        />
        <QuickCard
          href="/dashboard/profile"
          icon="👤"
          title="My Profile"
          desc="Edit your account details"
          color="blue"
        />
        <QuickCard
          href="/dashboard/properties"
          icon="🏢"
          title="My Listings"
          desc={showListings ? "Manage your properties" : "List a rental or Airbnb"}
          color="orange"
        />
        <QuickCard
          href="/dashboard/my-viewings"
          icon="📅"
          title="My Viewings"
          desc="Track viewing requests you sent"
          color="blue"
        />
        {showListings && (
          <QuickCard
            href="/dashboard/viewings"
            icon="📬"
            title="Viewing requests"
            desc="Confirm or decline tenant viewings"
            color="orange"
          />
        )}
        {showAdmin && (
          <QuickCard
            href="/dashboard/admin/unused-images"
            icon="🛠️"
            title="Unused photos"
            desc="Restore or permanently delete hidden gallery images"
            color="blue"
          />
        )}
        {showAdmin && (
          <QuickCard
            href="/dashboard/admin/unused-units"
            icon="🚪"
            title="Unused units"
            desc="Restore or permanently delete hidden units & rent rows"
            color="orange"
          />
        )}
        {showAdmin && (
          <QuickCard
            href="/dashboard/admin/unused-listings"
            icon="🏚️"
            title="Unused listings"
            desc="Restore or permanently delete hidden properties"
            color="blue"
          />
        )}
      </div>

      {/* Account info */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Account details</h2>
        <div className="divide-y divide-slate-100">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? "Not set"} />
          <Row
            label="Account type"
            value={
              [
                "Tenant",
                isLandlord ? "Landlord" : null,
                isHost ? "Airbnb Host" : null,
              ]
                .filter(Boolean)
                .join(" · ")
            }
          />
        </div>
        <div className="flex gap-3 pt-2">
          <a
            href="/dashboard/profile"
            className="rounded-lg border border-mt-blue px-4 py-2 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white transition"
          >
            Edit profile
          </a>
          <button
            onClick={logout}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickCard({
  href, icon, title, desc, color,
}: {
  href: string; icon: string; title: string; desc: string; color: "blue" | "orange";
}) {
  return (
    <a
      href={href}
      className={`flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-${color === "blue" ? "mt-blue" : "mt-orange"}/30`}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className={`text-sm font-bold ${color === "blue" ? "text-mt-blue" : "text-mt-orange"}`}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
