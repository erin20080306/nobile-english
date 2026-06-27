const photoByTheme: Record<string, string> = {
  daily: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80",
  cafe: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
  travel: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  airport: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80",
  shopping: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
  work: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
  interview: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
  social: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80",
  phone: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  exam: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=900&q=80",
  custom: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
};

export function scenePhotoUrl(themeId?: string) {
  return themeId ? photoByTheme[themeId] || photoByTheme.custom : photoByTheme.custom;
}

export function sceneCardStyle(color: string, strength = 0.2, themeId?: string) {
  const photo = scenePhotoUrl(themeId);
  return {
    backgroundColor: color,
    backgroundImage: [
      `linear-gradient(110deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.45) 40%, rgba(35,28,54,${strength}) 100%)`,
      "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.28) 100%)",
      `url('${photo}')`,
      `linear-gradient(135deg, ${color}, #ffffff)`,
    ].join(", "),
    backgroundPosition: "center, center, center, center",
    backgroundRepeat: "no-repeat, no-repeat, no-repeat, no-repeat",
    backgroundSize: "cover, cover, cover, cover",
  };
}
