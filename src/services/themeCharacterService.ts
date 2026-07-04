import {
  DEFAULT_THEME_CHARACTER_ID,
  THEME_CHARACTERS,
  getThemeCharacter,
  type ThemeCharacterId,
} from "@/data/themeCharacters";
import { KEYS, storageService } from "./storageService";

export type ThemeCharacterState = {
  selectedId: ThemeCharacterId;
  changedOnce: boolean;
  equipmentIds: string[];
  updatedAt?: string;
};

type SelectCharacterResult = {
  ok: boolean;
  state: ThemeCharacterState;
  message: string;
};

const validIds = new Set(THEME_CHARACTERS.map((character) => character.id));

function nowIso() {
  return new Date().toISOString();
}

function defaultState(): ThemeCharacterState {
  return {
    selectedId: DEFAULT_THEME_CHARACTER_ID,
    changedOnce: false,
    equipmentIds: [],
  };
}

function normalizeState(raw?: Partial<ThemeCharacterState>): ThemeCharacterState {
  const rawSelectedId = raw?.selectedId;
  const selectedId = rawSelectedId && validIds.has(rawSelectedId)
    ? rawSelectedId
    : DEFAULT_THEME_CHARACTER_ID;
  return {
    selectedId,
    changedOnce: Boolean(raw?.changedOnce),
    equipmentIds: Array.isArray(raw?.equipmentIds) ? raw.equipmentIds.filter(Boolean) : [],
    updatedAt: raw?.updatedAt,
  };
}

function notifyCharacterChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("theme-character-change"));
}

function saveState(state: ThemeCharacterState) {
  storageService.set(KEYS.themeCharacterState, state);
  notifyCharacterChange();
  return state;
}

export const themeCharacterService = {
  getState(): ThemeCharacterState {
    return normalizeState(storageService.get<ThemeCharacterState>(KEYS.themeCharacterState, defaultState()));
  },

  getAll() {
    return THEME_CHARACTERS;
  },

  getCharacter(id?: string) {
    return getThemeCharacter(id);
  },

  getSelectedCharacter() {
    return getThemeCharacter(this.getState().selectedId);
  },

  getCharacterIndex(id?: string) {
    const index = THEME_CHARACTERS.findIndex((character) => character.id === id);
    return index >= 0 ? index : 0;
  },

  selectCharacter(nextId: ThemeCharacterId): SelectCharacterResult {
    const state = this.getState();
    const nextCharacter = getThemeCharacter(nextId);
    if (state.selectedId === nextCharacter.id) {
      return {
        ok: true,
        state,
        message: `目前已使用 ${nextCharacter.name}。`,
      };
    }
    if (state.changedOnce) {
      return {
        ok: false,
        state,
        message: "主題人物只能更換一次。",
      };
    }
    const nextState = saveState({
      ...state,
      selectedId: nextCharacter.id,
      changedOnce: true,
      updatedAt: nowIso(),
    });
    return {
      ok: true,
      state: nextState,
      message: `已更換為 ${nextCharacter.name}。主題人物只能更換一次。`,
    };
  },
};
