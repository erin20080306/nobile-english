"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { TUTORS, getTutorById, DEFAULT_TUTOR_ID, type TutorProfile } from "@/data/tutors";
import { storageService } from "@/services/storageService";

const TUTOR_KEY = "selected_tutor_id";

export function getSelectedTutor(): TutorProfile {
  const id = storageService.get<string>(TUTOR_KEY, DEFAULT_TUTOR_ID);
  return getTutorById(id);
}

export function saveSelectedTutor(id: string) {
  storageService.set(TUTOR_KEY, id);
}

function TutorAvatar({ tutor, size = 72 }: { tutor: TutorProfile; size?: number }) {
  const src = `https://api.dicebear.com/9.x/lorelei/svg?seed=${tutor.avatarSeed}&backgroundColor=${tutor.avatarBg.replace("#", "")}`;
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-soft shrink-0"
      style={{ width: size, height: size, background: tutor.avatarBg }}
    >
      <img src={src} alt={tutor.name} width={size} height={size} className="object-cover" />
    </div>
  );
}

export default function TutorSelector({
  onSelect,
  compact = false,
}: {
  onSelect?: (tutor: TutorProfile) => void;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<string>(() =>
    storageService.get<string>(TUTOR_KEY, DEFAULT_TUTOR_ID)
  );

  function pick(tutor: TutorProfile) {
    setSelected(tutor.id);
    saveSelectedTutor(tutor.id);
    onSelect?.(tutor);
  }

  const males = TUTORS.filter((t) => t.gender === "male");
  const females = TUTORS.filter((t) => t.gender === "female");

  if (compact) {
    const current = getTutorById(selected);
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
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => onPick(tutor)}
      className={`relative rounded-3xl p-3 text-left transition border-2 ${
        selected ? "border-lilacDeep shadow-soft" : "border-transparent bg-white shadow-softer"
      }`}
      style={{ background: selected ? tutor.avatarBg : undefined }}
    >
      {selected && (
        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-lilacDeep flex items-center justify-center">
          <Check size={11} className="text-white" />
        </span>
      )}
      <div className="flex flex-col items-center gap-2">
        <TutorAvatar tutor={tutor} size={68} />
        <div className="text-center">
          <p className="font-extrabold text-ink text-sm">{tutor.name} {tutor.flag}</p>
          <p className="text-xs text-inkSoft">{tutor.accentLabel}</p>
          <p className="text-xs text-inkSoft mt-0.5 leading-tight">{tutor.description}</p>
        </div>
      </div>
    </motion.button>
  );
}

export { TutorAvatar };
