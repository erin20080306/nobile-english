"use client";

import { useState } from "react";

// Uses the bundled transparent fallback asset so the app never requests a
// missing image during local preview or production.
export default function CheerImage({
  size = 140,
  className = "",
  alt = "加油！Mobile English 鼓勵角色",
  src: imageSrc = "/assets/cheer-fallback.svg",
}: {
  size?: number;
  className?: string;
  alt?: string;
  src?: string;
}) {
  const [src, setSrc] = useState(imageSrc);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => {
        if (src !== "/assets/cheer-fallback.svg") setSrc("/assets/cheer-fallback.svg");
      }}
      style={{ width: size, height: "auto", objectFit: "contain", background: "transparent" }}
      className={`drop-shadow-sm ${className}`}
    />
  );
}
