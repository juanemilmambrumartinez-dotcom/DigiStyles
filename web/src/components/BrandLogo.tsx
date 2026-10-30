"use client";

import Image from "next/image";
import { useState } from "react";

type BrandLogoProps = {
  logo: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  fallbackText: string;
};

export function BrandLogo({ logo, fallbackText }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span>{fallbackText}</span>;
  }

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={logo.width}
      height={logo.height}
      className="h-11 w-11 rounded-full bg-foreground object-contain"
      priority
      onError={() => setFailed(true)}
    />
  );
}
