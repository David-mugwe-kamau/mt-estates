import type { VacantTypeSummary } from "@/lib/api";

interface ListingCardProps {
  id: string | number;
  title: string;
  location: string;
  price: string;
  image: string;
  type: "rental" | "airbnb" | "for_sale";
  latitude?: number | null;
  longitude?: number | null;
  vacantTypes?: VacantTypeSummary[];
}

function mapsUrl(location: string, lat?: number | null, lng?: number | null): string {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function ListingCard({
  id,
  title,
  location,
  price,
  image,
  type,
  latitude,
  longitude,
  vacantTypes,
}: ListingCardProps) {
  const detailHref = `/${type === "for_sale" ? "for-sale" : type === "airbnb" ? "airbnbs" : "rentals"}/${id}`;
  const showTypes = (type === "rental" || type === "airbnb") && (vacantTypes?.length ?? 0) > 0;

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 flex flex-col">
      <a href={detailHref} className="block overflow-hidden">
        <img
          src={image}
          alt={title}
          className="h-44 w-full object-cover transition duration-500 hover:scale-105"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fallback === "1") return;
            el.dataset.fallback = "1";
            el.src =
              "data:image/svg+xml," +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#005B8E"/><stop offset="1" stop-color="#F47920"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="50%" y="50%" fill="white" font-size="28" font-family="sans-serif" text-anchor="middle" dy=".3em">MT Estates</text></svg>`,
              );
          }}
        />
      </a>

      <div className="flex flex-col flex-1 p-4 space-y-2">
        <a href={detailHref} className="block space-y-0.5 hover:opacity-80">
          <h2 className="text-base font-bold text-slate-900 leading-snug">{title}</h2>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {location}
          </p>
          <p className={`text-sm font-semibold ${type === "airbnb" ? "text-mt-orange" : "text-mt-blue"}`}>
            {price}
          </p>
        </a>

        {showTypes && (
          <ul className="space-y-0.5">
            {vacantTypes!.map((t) => (
              <li key={`${t.category}-${t.label}`} className="text-xs text-slate-600">
                {t.label}
                {t.rent_amount != null
                  ? ` · KSh ${Number(t.rent_amount).toLocaleString("en-KE")}`
                  : ""}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1 mt-auto">
          <a
            href={mapsUrl(location, latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-mt-blue hover:text-mt-blue transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Directions
          </a>

          <a
            href={detailHref}
            className="ml-auto text-xs font-semibold text-mt-blue hover:text-mt-orange"
          >
            View details →
          </a>
        </div>
      </div>
    </article>
  );
}
