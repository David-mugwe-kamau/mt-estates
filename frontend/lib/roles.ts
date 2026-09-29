export const FREE_GALLERY_LIMIT = 6;

/** Check if user is a rental landlord (handles legacy role names). */
export function isRentalLandlord(roles: string[] = []): boolean {
  return roles.includes("rental_landlord") || roles.includes("landlord");
}

/** Check if user is an Airbnb host. */
export function isAirbnbHost(roles: string[] = []): boolean {
  return roles.includes("airbnb_host");
}

/** Can manage listings (rental or airbnb). */
export function canManageListings(roles: string[] = []): boolean {
  return isRentalLandlord(roles) || isAirbnbHost(roles);
}

export const LISTING_TYPE_LABEL: Record<string, string> = {
  rental: "Rental",
  airbnb: "Airbnb",
  for_sale: "For Sale",
};

/** Platform owner of MT Estates (maintenance / unused photo purge). */
export function isPlatformAdmin(user: { is_platform_admin?: boolean; roles?: string[]; role?: string } | null): boolean {
  if (!user) return false;
  if (user.is_platform_admin) return true;
  if (user.role === "admin" || user.role === "owner") return true;
  return (user.roles || []).includes("owner");
}
