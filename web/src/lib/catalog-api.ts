const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
}

export interface ProductListItem {
  id: number;
  name: string;
  slug: string;
  brand: string;
  price: number;
  category: string;
  imageUrl: string | null;
}

export interface ProductPageResponse {
  items: ProductListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProductVariant {
  id: number;
  size: string;
  color: string;
  stock: number;
  price: number | null;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string;
  brand: string;
  basePrice: number;
  category: string;
  images: { url: string; sortOrder: number }[];
  variants: ProductVariant[];
}

function apiUrl(path: string) {
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_URL no está configurada.");
  return `${apiBaseUrl.replace(/\/$/, "")}${path}`;
}

export async function fetchCatalog(path: string) {
  const response = await fetch(apiUrl(path), { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
  return response;
}
