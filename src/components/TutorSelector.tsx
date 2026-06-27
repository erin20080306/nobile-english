"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Volume2 } from "lucide-react";
import { TUTORS, getTutorById, getDefaultTutorId, type TutorProfile } from "@/data/tutors";
import type { LearningLanguageCode } from "@/types";
import { storageService } from "@/services/storageService";
import { speechService } from "@/services/speechService";
import { learningService } from "@/services/learningService";

const TUTOR_KEY = "selected_tutor_id";
const TUTOR_FALLBACK_PHOTO = "/assets/tutors/tutor-fallback.svg";

function tutorKey(language: LearningLanguageCode) {
  return `${TUTOR_KEY}_${language}`;
}

export function getSelectedTutor(language: LearningLanguageCode = learningService.getCurrentLanguage()): TutorProfile {
  const fallback = getDefaultTutorId(language);
  const id = storageService.get<string>(tutorKey(language), storageService.get<string>(TUTOR_KEY, fallback));
  const tutor = getTutorById(id, language);
  return tutor.targetLanguage === language ? tutor : getTutorById(fallback, language);
}

export function saveSelectedTutor(id: string, language: LearningLanguageCode = learningService.getCurrentLanguage()) {
  storageService.set(tutorKey(language), id);
  if (language === "en") storageService.set(TUTOR_KEY, id);
}

function TutorAvatar({ tutor, size = 72 }: { tutor: TutorProfile; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-soft shrink-0"
      style={{ width: size, height: size, background: tutor.avatarBg }}
    >
      <img
        src={tutor.photoUrl}
        alt={tutor.name}
        width={size}
        height={size}
        onError={(e) => { e.currentTarget.src = TUTOR_FALLBACK_PHOTO; }}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export default function TutorSelector({
  onSelect,
  compact = false,
  targetLanguage,
}: {
  onSelect?: (tutor: TutorProfile) => void;
  compact?: boolean;
  targetLanguage?: LearningLanguageCode;
}) {
  const language = targetLanguage || learningService.getCurrentLanguage();
  const [selected, setSelected] = useState<string>(() => getSelectedTutor(language).id);

  useEffect(() => {
    setSelected(getSelectedTutor(language).id);
  }, [language]);

  function pick(tutor: TutorProfile) {
    setSelected(tutor.id);
    saveSelectedTutor(tutor.id, language);
    onSelect?.(tutor);
  }

  const visibleTutors = TUTORS.filter((t) => t.targetLanguage === language);
  const males = visibleTutors.filter((t) => t.gender === "male");
  const females = visibleTutors.filter((t) => t.gender === "female");

  if (compact) {
    const current = getTutorById(selected, language);
    return (
      <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-softer">
        <TutorAvatar tutor={current} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-ink truncate">{current.name} {current.flag}</p>
          <p className="text-xs text-inkSoft truncate">{current.accentLabel}</p>
        </div>
        <span className="text-xs text-lilacDeep font-bold">更換</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold text-inkSoft mb-2 px-1">👨 男生導師</p>
        <div className="grid grid-cols-2 gap-3">
          {males.map((t) => <TutorCard key={t.id} tutor={t} selected={selected === t.id} onPick={pick} />)}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-inkSoft mb-2 px-1">👩 女生導師</p>
        <div className="grid grid-cols-2 gap-3">
          {females.map((t) => <TutorCard key={t.id} tutor={t} selected={selected === t.id} onPick={pick} />)}
        </div>
      </div>
    </div>
  );
}

function TutorCard({
  tutor,
  selected,
  onPick,
}: {
  tutor: TutorProfile;
  selected: boolean;
  onPick: (t: TutorProfile) => void;
}) {
  function previewVoice() {
    speechService.speak(tutor.sampleLine, {
      lang: tutor.lang,
      voiceKeywords: tutor.voiceKeywords,
      ttsVoice: tutor.ttsVoice,
      ttsInstructions: tutor.ttsInstructions,
      rate: learningService.getSpeechRate(tutor.targetLanguage),
      volumeGain: tutor.ttsVolumeGain,
      onError: (message) => alert(message),
    });
  }

  return (
    <motion.div
      className={`relative rounded-[28px] p-2 text-left transition border-2 overflow-hidden ${
        selected ? "border-lilacDeep shadow-soft" : "border-transparent bg-white shadow-softer"
      }`}
      style={{ background: selected ? tutor.avatarBg : undefined }}
    >
      {selected && (
        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-lilacDeep flex items-center justify-center">
          <Check size={11} className="text-white" />
        </span>
      )}
      <button type="button" onClick={() => onPick(tutor)} className="w-full active:scale-[0.98] transition">
        <div className="relative h-36 w-full overflow-hidden rounded-[24px] bg-ink">
          <img
            src={tutor.photoUrl}
            alt={tutor.name}
            onError={(e) => { e.currentTarget.src = TUTOR_FALLBACK_PHOTO; }}
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-white/10" />
          <span className="absolute left-2 bottom-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-extrabold text-ink">
            {tutor.flag} {tutor.accentLabel}
          </span>
        </div>
        <div className="px-2 pt-2 text-left">
          <p className="font-extrabold text-ink text-base leading-tight">{tutor.name}</p>
          <p className="text-xs text-inkSoft mt-0.5 leading-tight line-clamp-2">{tutor.description}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={previewVoice}
        className="mt-3 w-full rounded-2xl bg-white/80 text-lilacDeep text-xs font-extrabold py-2 flex items-center justify-center gap-1 active:scale-95 transition"
      >
        <Volume2 size={13} /> 試聽聲音
      </button>
    </motion.div>
  );
}

export { TutorAvatar };
