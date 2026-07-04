"use client";

import { useEffect, useState } from "react";
import { themeCharacterService } from "@/services/themeCharacterService";

// Uses the bundled transparent fallback asset so the app never requests a
// missing image during local preview or production.
export default function CheerImage({
  size = 140,
  className = "",
  alt = "加油！Mobile Language 鼓勵角色",
  src: imageSrc,
}: {
  size?: number;
  className?: string;
  alt?: string;
  src?: string;
}) {
  const fallbackSrc = "/assets/cheer-fallback.svg";
  const [src, setSrc] = useState(imageSrc || "/assets/garden/doll-base.png");

  useEffect(() => {
    if (imageSrc) {
      setSrc(imageSrc);
      return undefined;
    }
    const syncSelectedCharacter = () => {
      setSrc(themeCharacterService.getSelectedCharacter().imageSrc);
    };
    syncSelectedCharacter();
    window.addEventListener("theme-character-change", syncSelectedCharacter);
    window.addEventListener("storage", syncSelectedCharacter);
    return () => {
      window.removeEventListener("theme-character-change", syncSelectedCharacter);
      window.removeEventListener("storage", syncSelectedCharacter);
    };
  }, [imageSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc);
      }}
      style={{ width: size, height: "auto", objectFit: "contain", background: "transparent" }}
      className={`drop-shadow-sm ${className}`}
    />
  );
}
