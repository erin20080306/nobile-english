export function sceneCardStyle(color: string, strength = 0.9) {
  return {
    backgroundColor: color,
    backgroundImage: [
      `linear-gradient(110deg, rgba(255,255,255,${strength}) 0%, rgba(255,255,255,0.78) 54%, rgba(255,255,255,0.36) 100%)`,
      "url('/assets/scene-card-bg.svg')",
      `linear-gradient(135deg, ${color}, #ffffff)`,
    ].join(", "),
    backgroundPosition: "center, right -20px center, center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover, 220px 150px, cover",
  };
}
