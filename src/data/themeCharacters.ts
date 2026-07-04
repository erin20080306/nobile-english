export type ThemeCharacterId = "fat-duck" | "sister-piggy" | "sour-duck";

export type ThemeCharacter = {
  id: ThemeCharacterId;
  name: string;
  zhName: string;
  imageSrc: string;
  description: string;
};

export const DEFAULT_THEME_CHARACTER_ID: ThemeCharacterId = "fat-duck";

export const THEME_CHARACTERS: ThemeCharacter[] = [
  {
    id: "fat-duck",
    name: "Fat Duck",
    zhName: "胖鴨鴨",
    imageSrc: "/assets/garden/doll-base.png",
    description: "原本陪你練習的主題人物，穩定、可愛、很適合每日練習。",
  },
  {
    id: "sister-piggy",
    name: "Sister Piggy",
    zhName: "豬豬",
    imageSrc: "/assets/characters/sister-piggy.png",
    description: "背著書包的溫柔學伴，適合單字複習與考試英文練習。",
  },
  {
    id: "sour-duck",
    name: "Sour Duck",
    zhName: "酸鴨鴨",
    imageSrc: "/assets/characters/sour-duck.png",
    description: "戴著小帽子的活潑學伴，適合場景對話和每日挑戰。",
  },
];

export function getThemeCharacter(id?: string) {
  return THEME_CHARACTERS.find((character) => character.id === id) || THEME_CHARACTERS[0];
}
