"use client";

import { useRef, useState } from "react";
import type { PropertyImage } from "@/lib/api";
import { compressImageForListing } from "@/lib/compressImage";
import { FREE_GALLERY_LIMIT } from "@/lib/roles";

interface GalleryManagerProps {
  images: PropertyImage[];
  onUpload: (dataUrl: string) => Promise<void>;
  onSetCover: (imageId: number) => Promise<void>;
  onRemove: (imageId: number) => Promise<void>;
  onUseAsListingCover?: (imageId: number) => Promise<void>;
  listingCoverId?: number | null;
  title?: string;
  hint?: string;
  disabled?: boolean;
}

export function GalleryManager({
  images,
  onUpload,
  onSetCover,
  onRemove,
  onUseAsListingCover,
  listingCoverId,
  title = "Photo gallery",
  hint,
  disabled,
}: GalleryManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (images.length >= FREE_GALLERY_LIMIT) {
      setError(`Free gallery limit is ${FREE_GALLERY_LIMIT} photos.`);
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await compressImageForListing(file);
      await onUpload(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">
            {hint ??
              `Free — up to ${FREE_GALLERY_LIMIT} photos for this type. Photos are not copied to other types. First photo is the type cover.`}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || uploading || images.length >= FREE_GALLERY_LIMIT}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg bg-mt-blue px-3 py-2 text-xs font-semibold text-white hover:bg-mt-blue/90 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Add photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {images.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No photos yet. Add your first photo to attract tenants.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="relative">
                <img src={img.url} alt="" className="h-32 w-full object-cover" />
                {img.is_cover && (
                  <span className="absolute top-2 left-2 rounded-full bg-mt-orange px-2 py-0.5 text-[10px] font-bold text-white">
                    Type cover
                  </span>
                )}
                {listingCoverId === img.id && (
                  <span className="absolute top-2 right-2 rounded-full bg-mt-blue px-2 py-0.5 text-[10px] font-bold text-white">
                    Listing cover
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 bg-slate-50 p-2">
                {!img.is_cover && (
                  <button
                    type="button"
                    onClick={() => onSetCover(img.id)}
                    className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-slate-800 ring-1 ring-slate-200"
                  >
                    Type cover
                  </button>
                )}
                {onUseAsListingCover && listingCoverId !== img.id && (
                  <button
                    type="button"
                    onClick={() => onUseAsListingCover(img.id)}
                    className="rounded bg-mt-blue px-2 py-1 text-[10px] font-semibold text-white"
                  >
                    Listing cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(img.id)}
                  className="rounded bg-red-500 px-2 py-1 text-[10px] font-semibold text-white"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
