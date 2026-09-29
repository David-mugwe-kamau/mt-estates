export const UNIT_CATEGORIES = [
  { id: "single_room", label: "Single room" },
  { id: "double_room", label: "Double room" },
  { id: "bedsitter", label: "Bedsitter / studio" },
  { id: "one_bedroom", label: "1 bedroom" },
  { id: "two_bedroom", label: "2 bedroom" },
  { id: "three_bedroom", label: "3 bedroom" },
  { id: "four_bedroom", label: "4 bedroom" },
  { id: "five_bedroom_plus", label: "5 bedroom+" },
  { id: "maisonette", label: "Maisonette" },
  { id: "bungalow", label: "Bungalow" },
  { id: "townhouse", label: "Townhouse" },
  { id: "penthouse", label: "Penthouse" },
  { id: "sq", label: "SQ / backyard unit" },
  { id: "shared_room", label: "Shared / hostel room" },
  { id: "other", label: "Other" },
] as const;

export type UnitCategoryId = (typeof UNIT_CATEGORIES)[number]["id"];
