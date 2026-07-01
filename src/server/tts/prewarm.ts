import type { Scene } from "@/types";
import { getTutorVoiceProfileIdsForLanguage } from "@/data/tutorVoiceProfiles";
import { estimateCostUsd } from "./cost";
import { getOrCreateTtsAsset, peekTtsAsset } from "./service";
import { toVoiceLanguageCode } from "./voiceProfiles";
import type { GetOrCreateInput, TtsAssetType, VoiceGender } from "./types";

// A single text that needs a fixed audio asset for a scene.
export interface SceneAudioTextSpec {
  assetType: TtsAssetType;
  text: string;
  textPart2?: string;
}

// Future-proof, voice-agnostic description of all fixed audio a scene needs.
export interface SceneAudioSource {
  sceneId: string;
  sceneVersion: number;
  languageCode: string; // BCP-47, e.g. en-US
  texts: SceneAudioTextSpec[];
}

// Adapt today's Scene shape into audio sources. When the data model adds explicit
// 7 practice sentences + 6 tutor replies (tutorPart1/2), extend this mapping.
export function sceneToAudioSource(scene: Scene): SceneAudioSource {
  const languageCode = toVoiceLanguageCode(scene.targetLanguage || "en");
  const texts: SceneAudioTextSpec[] = [];

  for (const line of scene.dialogue) {
    if (!line.en?.trim()) continue;
    if (line.speaker === "user") texts.push({ assetType: "practice_sentence", text: line.en });
    else if (line.speaker === "tutor") texts.push({ assetType: "tutor_reply", text: line.en });
  }
  for (const pattern of scene.keyPatterns || []) {
    if (pattern.en?.trim()) texts.push({ assetType: "tutor_hint", text: pattern.en });
  }
  for (const word of scene.keyWords || []) {
    if (word?.trim()) texts.push({ assetType: "word_pronunciation", text: word });
  }

  return { sceneId: scene.id, sceneVersion: 1, languageCode, texts };
}

export interface PrewarmOptions {
  dryRun?: boolean;
  voiceGender?: VoiceGender; // fixed voice to prewarm (default female)
  voiceGenders?: VoiceGender[];
  allTutorProfiles?: boolean;
  voiceProfileIds?: string[];
}

export interface PrewarmReport {
  dryRun: boolean;
  totalTexts: number;
  alreadyCached: number;
  missing: number;
  generated: number;
  failed: number;
  estimatedChars: number;
  estimatedUsd: number;
}

function specToInput(
  source: SceneAudioSource,
  spec: SceneAudioTextSpec,
  voiceGender: VoiceGender,
  voiceProfileId?: string
): GetOrCreateInput {
  return {
    text: spec.text,
    textPart2: spec.textPart2,
    languageCode: source.languageCode,
    assetType: spec.assetType,
    voiceGender,
    voiceProfileId,
    sceneId: source.sceneId,
    sceneVersion: source.sceneVersion,
  };
}

function isTutorAudioAsset(assetType: TtsAssetType) {
  return (
    assetType === "tutor_reply" ||
    assetType === "tutor_pass" ||
    assetType === "tutor_minor_correction" ||
    assetType === "tutor_retry" ||
    assetType === "tutor_hint" ||
    assetType === "tutor_complete" ||
    assetType === "dynamic_tutor_reply"
  );
}

export async function prewarmSources(
  sources: SceneAudioSource[],
  options: PrewarmOptions = {}
): Promise<PrewarmReport> {
  const dryRun = options.dryRun ?? true;
  const voiceGender = options.voiceGender ?? "female";
  const tutorVoiceGenders = options.voiceGenders?.length ? options.voiceGenders : [voiceGender];

  let totalTexts = 0;
  let alreadyCached = 0;
  let missing = 0;
  let generated = 0;
  let failed = 0;
  let estimatedChars = 0;

  for (const source of sources) {
    for (const spec of source.texts) {
      const tutorProfileIds = isTutorAudioAsset(spec.assetType) && options.allTutorProfiles
        ? options.voiceProfileIds?.length
          ? options.voiceProfileIds
          : getTutorVoiceProfileIdsForLanguage(source.languageCode)
        : [];
      const entries = tutorProfileIds.length
        ? tutorProfileIds.map((voiceProfileId) => ({ gender: voiceGender, voiceProfileId }))
        : (isTutorAudioAsset(spec.assetType) ? tutorVoiceGenders : [voiceGender])
            .map((gender) => ({ gender, voiceProfileId: undefined }));

      for (const entry of entries) {
        totalTexts += 1;
        const input = specToInput(source, spec, entry.gender, entry.voiceProfileId);
        const peek = await peekTtsAsset(input);
        if (peek.cached) {
          alreadyCached += 1;
          continue;
        }
        missing += 1;
        estimatedChars += peek.billableChars; // only cache-misses are billed

        if (!dryRun) {
          try {
            const result = await getOrCreateTtsAsset(input);
            if (result.asset.status === "ready") generated += 1;
            else failed += 1;
          } catch {
            failed += 1;
          }
        }
      }
    }
  }

  return {
    dryRun,
    totalTexts,
    alreadyCached,
    missing,
    generated,
    failed,
    estimatedChars,
    estimatedUsd: estimateCostUsd(estimatedChars),
  };
}

export async function prewarmScenes(
  scenes: Scene[],
  options: PrewarmOptions = {}
): Promise<PrewarmReport> {
  return prewarmSources(scenes.map(sceneToAudioSource), options);
}
