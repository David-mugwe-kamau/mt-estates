const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/login")) {
    localStorage.removeItem("mt_estates_token");
    localStorage.removeItem("mt_estates_user");
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/auth/login?next=${next}`;
    return undefined as T;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    const detail = err.detail;
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar_url?: string | null;
  role: string;
  roles: string[];
  created_at: string;
  is_platform_admin?: boolean;
  subscriptions?: Array<Record<string, unknown>>;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export const auth = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    list_rentals?: boolean;
    host_airbnb?: boolean;
  }) => request<UserResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<LoginResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(data) }),

  me: (token: string) => request<UserResponse>("/api/v1/auth/me", {}, token),

  updateProfile: (
    data: { name?: string; phone?: string; avatar_url?: string },
    token: string,
  ) =>
    request<UserResponse>("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify(data) }, token),
};

// ── Properties ────────────────────────────────────────────────────────────────

export interface PropertyImage {
  id: number;
  property_id: number;
  url: string;
  sort_order: number;
  is_cover: boolean;
  unit_type_id?: number | null;
  is_unused?: boolean;
  unused_at?: string | null;
  created_at: string;
}

export interface UnitTypeResponse {
  id: number;
  property_id: number;
  category: string;
  custom_label: string | null;
  label: string;
  sort_order: number;
  images: PropertyImage[];
  vacant_units: number;
  total_units: number;
  min_rent: number | null;
  rent_amount: number | null;
  is_vacant: boolean;
  created_at: string;
}

export interface PropertyResponse {
  id: number;
  owner_id: number;
  name: string;
  location: string;
  county?: string | null;
  locality?: string | null;
  listing_type: string | null;
  is_published: boolean;
  description: string | null;
  image_url: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  water_rate_per_unit?: number | null;
  garbage_fee?: number | null;
  main_meter_reading?: number | null;
  view_count?: number;
  cover_image_id?: number | null;
  created_at: string;
  type_count?: number | null;
  has_vacant_type?: boolean | null;
  vacant_type_labels?: string[] | null;
}

export interface PropertyDetail extends PropertyResponse {
  images: PropertyImage[];
  unit_types?: UnitTypeResponse[];
}

export interface PropertyCreateInput {
  name: string;
  location: string;
  county?: string;
  locality?: string;
  listing_type: "rental" | "airbnb" | "for_sale";
  description?: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_email?: string;
  latitude?: number;
  longitude?: number;
  water_rate_per_unit?: number;
  garbage_fee?: number;
}

export interface PropertyUpdateInput extends Partial<PropertyCreateInput> {
  is_published?: boolean;
  image_url?: string;
  main_meter_reading?: number;
}

export const properties = {
  list: (token: string) =>
    request<PropertyResponse[]>("/api/v1/properties", {}, token),

  get: (id: number, token: string) =>
    request<PropertyDetail>(`/api/v1/properties/${id}`, {}, token),

  create: (data: PropertyCreateInput, token: string) =>
    request<PropertyResponse>("/api/v1/properties", { method: "POST", body: JSON.stringify(data) }, token),

  update: (id: number, data: PropertyUpdateInput, token: string) =>
    request<PropertyResponse>(`/api/v1/properties/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  delete: (id: number, token: string) =>
    request<void>(`/api/v1/properties/${id}`, { method: "DELETE" }, token),

  addImage: (propertyId: number, url: string, token: string, isCover = false, unitTypeId?: number) =>
    request<PropertyImage>(
      `/api/v1/properties/${propertyId}/images`,
      {
        method: "POST",
        body: JSON.stringify({ url, is_cover: isCover, unit_type_id: unitTypeId ?? null }),
      },
      token,
    ),

  setCover: (propertyId: number, imageId: number, token: string) =>
    request<PropertyImage>(
      `/api/v1/properties/${propertyId}/images/${imageId}/cover`,
      { method: "PATCH" },
      token,
    ),

  setListingCover: (propertyId: number, imageId: number, token: string) =>
    request<PropertyResponse>(
      `/api/v1/properties/${propertyId}/listing-cover`,
      { method: "PATCH", body: JSON.stringify({ image_id: imageId }) },
      token,
    ),

  addUnitType: (
    propertyId: number,
    data: { category: string; custom_label?: string; rent_amount?: number },
    token: string,
  ) =>
    request<UnitTypeResponse>(
      `/api/v1/properties/${propertyId}/unit-types`,
      { method: "POST", body: JSON.stringify(data) },
      token,
    ),

  updateUnitType: (
    propertyId: number,
    typeId: number,
    data: { rent_amount?: number; is_vacant?: boolean; category?: string; custom_label?: string },
    token: string,
  ) =>
    request<UnitTypeResponse>(
      `/api/v1/properties/${propertyId}/unit-types/${typeId}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token,
    ),

  removeUnitType: (propertyId: number, typeId: number, token: string) =>
    request<{ message: string }>(`/api/v1/properties/${propertyId}/unit-types/${typeId}`, { method: "DELETE" }, token),

  removeImage: (propertyId: number, imageId: number, token: string) =>
    request<void>(`/api/v1/properties/${propertyId}/images/${imageId}`, { method: "DELETE" }, token),
};

export interface UnusedImage {
  id: number;
  property_id: number;
  property_name: string | null;
  url: string;
  unused_at: string | null;
  created_at: string;
}

export interface UnusedUnit {
  id: number;
  property_id: number;
  property_name: string | null;
  unit_number: string;
  rent_amount: number;
  status: string;
  unused_at: string | null;
}

export interface UnusedListing {
  id: number;
  owner_id: number;
  name: string;
  location: string;
  listing_type: string | null;
  unused_at: string | null;
  created_at: string;
}

export const admin = {
  unusedImages: (token: string) =>
    request<UnusedImage[]>("/api/v1/admin/unused-images", {}, token),
  restoreImage: (imageId: number, token: string) =>
    request<PropertyImage>(`/api/v1/admin/unused-images/${imageId}/restore`, { method: "PATCH" }, token),
  purgeImage: (imageId: number, token: string) =>
    request<{ message: string }>(`/api/v1/admin/unused-images/${imageId}`, { method: "DELETE" }, token),
  unusedUnits: (token: string) =>
    request<UnusedUnit[]>("/api/v1/admin/unused-units", {}, token),
  restoreUnit: (unitId: number, token: string) =>
    request<UnitResponse>(`/api/v1/admin/unused-units/${unitId}/restore`, { method: "PATCH" }, token),
  purgeUnit: (unitId: number, token: string) =>
    request<{ message: string }>(`/api/v1/admin/unused-units/${unitId}`, { method: "DELETE" }, token),
  unusedListings: (token: string) =>
    request<UnusedListing[]>("/api/v1/admin/unused-listings", {}, token),
  restoreListing: (propertyId: number, token: string) =>
    request<PropertyResponse>(`/api/v1/admin/unused-listings/${propertyId}/restore`, { method: "PATCH" }, token),
  purgeListing: (propertyId: number, token: string) =>
    request<{ message: string }>(`/api/v1/admin/unused-listings/${propertyId}`, { method: "DELETE" }, token),
};

// ── Units ─────────────────────────────────────────────────────────────────────

export interface UnitResponse {
  id: number;
  property_id: number;
  unit_number: string;
  rent_amount: number;
  status: string;
  unit_type_id?: number | null;
  is_unused?: boolean;
  unused_at?: string | null;
}

export const units = {
  list: (token: string, propertyId?: number) => {
    const qs = propertyId ? `?property_id=${propertyId}` : "";
    return request<UnitResponse[]>(`/api/v1/units${qs}`, {}, token);
  },

  create: (
    data: { property_id: number; unit_number: string; rent_amount: number; status?: string; unit_type_id?: number },
    token: string,
  ) => request<UnitResponse>("/api/v1/units", { method: "POST", body: JSON.stringify(data) }, token),

  update: (
    id: number,
    data: { unit_number?: string; status?: string; rent_amount?: number; unit_type_id?: number },
    token: string,
  ) => request<UnitResponse>(`/api/v1/units/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  remove: (id: number, token: string) =>
    request<{ message: string }>(`/api/v1/units/${id}`, { method: "DELETE" }, token),
};

// ── Public Listings ───────────────────────────────────────────────────────────

export interface VacantTypeSummary {
  label: string;
  category: string;
  rent_amount: number | null;
}

export interface PublicListing {
  id: number;
  name: string;
  location: string;
  county?: string | null;
  locality?: string | null;
  listing_type: string;
  description?: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  min_rent: number | null;
  image_url: string | null;
  vacant_types?: VacantTypeSummary[];
}

export interface PublicListingDetail extends PublicListing {
  images: PropertyImage[];
  unit_types?: UnitTypeResponse[];
  cover_image_id?: number | null;
}

export const listings = {
  public: (params?: {
    listing_type?: string;
    location?: string;
    county?: string;
    locality?: string;
    min_price?: number;
    max_price?: number;
    lat?: number;
    lng?: number;
    radius?: number;
    category?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
    }
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request<PublicListing[]>(`/api/v1/listings${query}`);
  },

  get: (id: number) => request<PublicListingDetail>(`/api/v1/listings/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  rent_collected: number;
}

export const dashboard = {
  stats: (token: string) =>
    request<DashboardStats>("/api/v1/dashboard", {}, token),
};

// ── Wishlist ──────────────────────────────────────────────────────────────────

export interface WishlistItem {
  id: number;
  title: string;
  location_text: string | null;
  listing_type: string;
  notes: string | null;
  external_ref: string | null;
  is_available: boolean | null;
  created_at: string;
}

export const wishlist = {
  list: (token: string) =>
    request<WishlistItem[]>("/api/v1/wishlist", {}, token),
  add: (data: Omit<WishlistItem, "id" | "created_at" | "is_available">, token: string) =>
    request<WishlistItem>("/api/v1/wishlist", { method: "POST", body: JSON.stringify(data) }, token),
  remove: (id: number, token: string) =>
    request<void>(`/api/v1/wishlist/${id}`, { method: "DELETE" }, token),
};

// ── Viewings ──────────────────────────────────────────────────────────────────

export interface ViewingRequest {
  id: number;
  property_id: number;
  user_id: number;
  preferred_date: string | null;
  message: string | null;
  status: string;
  created_at: string;
  property_name?: string | null;
  property_location?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  listing_type?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
}

export const viewings = {
  create: (
    data: { property_id: number; preferred_date?: string; message?: string },
    token: string,
  ) => request<ViewingRequest>("/api/v1/viewings", { method: "POST", body: JSON.stringify(data) }, token),
  mine: (token: string) => request<ViewingRequest[]>("/api/v1/viewings/mine", {}, token),
  received: (token: string) => request<ViewingRequest[]>("/api/v1/viewings/received", {}, token),
  update: (id: number, status: string, token: string) =>
    request<ViewingRequest>(`/api/v1/viewings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
};

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillingLine {
  id: number | null;
  unit_id: number;
  unit_number: string;
  tenant_id?: number | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  period: string;
  previous_reading: number;
  current_reading: number;
  water_units: number;
  water_cost: number;
  garbage_fee: number;
  rent_amount: number;
  total_due: number;
  arrears: number;
  amount_paid: number;
  balance: number;
}

export interface BillingStatement {
  property_id: number;
  period: string;
  water_rate_per_unit: number;
  garbage_fee: number;
  main_meter_reading: number | null;
  lines: BillingLine[];
  totals: Record<string, number>;
}

export const billing = {
  get: (propertyId: number, period: string, token: string) =>
    request<BillingStatement>(`/api/v1/billing/${propertyId}/${period}`, {}, token),
  periods: (propertyId: number, token: string) =>
    request<string[]>(`/api/v1/billing/${propertyId}/periods`, {}, token),
  save: (
    propertyId: number,
    period: string,
    data: {
      readings: Array<{
        unit_id: number;
        previous_reading?: number;
        current_reading: number;
        amount_paid?: number;
      }>;
      main_meter_reading?: number;
    },
    token: string,
  ) =>
    request<BillingStatement>(
      `/api/v1/billing/${propertyId}/${period}/readings`,
      { method: "POST", body: JSON.stringify(data) },
      token,
    ),
  pay: (readingId: number, amount_paid: number, token: string) =>
    request<{ id: number; amount_paid: number; balance: number; total_due: number }>(
      `/api/v1/billing/readings/${readingId}/payment`,
      { method: "PATCH", body: JSON.stringify({ amount_paid }) },
      token,
    ),
};
