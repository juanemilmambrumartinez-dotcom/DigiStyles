import Image from "next/image";

type ProductImageProps = {
  src?: string | null;
  name: string;
  category: string;
  color?: string;
  priority?: boolean;
  sizes: string;
};

function placeholderForCategory(category: string) {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory.includes("ropa")) return "/placeholders/placeholder-ropa.svg";
  if (normalizedCategory.includes("acces")) return "/placeholders/placeholder-accesorios.svg";
  return "/placeholders/placeholder-tenis.svg";
}

export function ProductImage({ src, name, category, color, priority = false, sizes }: ProductImageProps) {
  const alt = color ? `${name}, color ${color}` : `${name}, ${category}`;

  return (
    <Image
      src={src || placeholderForCategory(category)}
      alt={src ? alt : ""}
      role="img"
      aria-label={src ? undefined : `Placeholder de ${category} para ${name}`}
      fill
      priority={priority}
      sizes={sizes}
      className="object-contain p-5"
    />
  );
}
