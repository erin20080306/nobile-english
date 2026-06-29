"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Volume2, Star, Mic, MicOff, VolumeX } from "lucide-react";
import type { Scene, TutorFeedback, DialogueResult } from "@/types";
import { aiTutorService } from "@/services/aiTutorService";
import { dictionaryService } from "@/services/dictionaryService";
import { learningService } from "@/services/learningService";
import { speechService } from "@/services/speechService";
import { audioQueueService } from "@/services/audioQueueService";
import { tutorVoiceService } from "@/services/tutorVoiceService";
import { getLearningLanguage } from "@/data/learningLanguages";
import ClickableText from "@/components/ClickableText";
import WordSheet from "@/components/WordSheet";
import { getSelectedTutor } from "@/components/TutorSelector";

interface Msg {
  role: "tutor" | "user";
  en: string;
  zh: string;
  feedback?: TutorFeedback;
}

const MIN_PRACTICE_TURNS = 5;
const MAX_PRACTICE_TURNS = 7;
const TUTOR_FALLBACK_PHOTO = "/assets/tutors/tutor-fallback.svg";

const SCENE_PERSONAS: Record<string, string[]> = {
  cafe:       ["Mia", "Leo", "Sophie"],
  airport:    ["Jake", "Emma", "Ryan"],
  hotel:      ["Olivia", "Liam", "Ava"],
  shopping:   ["Noah", "Chloe", "Ethan"],
  interview:  ["Dr. Carter", "Ms. Lee", "Mr. Brown"],
  hospital:   ["Dr. Kim", "Nurse Lily", "Dr. Sam"],
  restaurant: ["Lucas", "Isabella", "Mason"],
  free:       ["Alex", "Jordan", "Taylor"],
  default:    ["Alex", "Jordan", "Taylor", "Morgan"],
};

function pickPersona(scene: Scene): string {
  if (scene.name.includes("問路") || scene.enName.toLowerCase().includes("direction")) {
    return "Morgan, a helpful local guide";
  }
  const themeId = scene.themeId;
  const list = SCENE_PERSONAS[themeId ?? "default"] ?? SCENE_PERSONAS.default;
  return list[Math.floor(Math.random() * list.length)];
}

function localizedOpening(scene: Scene, targetLanguage: ReturnType<typeof getLearningLanguage>, fallback: { en: string; zh: string }) {
  const choose = (items: { en: string; zh: string }[]) => items[Math.floor(Math.random() * items.length)] || fallback;
  const title = `${scene.name} ${scene.enName} ${scene.themeId}`.toLowerCase();
  const map = {
    en: {
      free: [
        { en: "Hi! What would you like to talk about today?", zh: "嗨！今天想聊什麼呢？" },
        { en: "Hey, good to see you. What topic feels useful today?", zh: "嘿，很高興見到你。今天想練什麼主題？" },
        { en: "Hi there. Tell me what you want to practice, and we'll make it real.", zh: "嗨。告訴我你想練什麼，我們把它變成真實對話。" },
      ],
      restaurant: [
        { en: "Good evening. Welcome in. Do you have a reservation?", zh: "晚上好，歡迎光臨。請問有預約嗎？" },
        { en: "Hi, welcome. Are you dining in today, or picking up an order?", zh: "你好，歡迎。今天內用還是取餐？" },
        { en: "Welcome. How many people are in your party tonight?", zh: "歡迎光臨。今晚幾位用餐？" },
      ],
      cafe: [
        { en: "Hi there. What can I get started for you today?", zh: "你好。今天想先點什麼？" },
        { en: "Welcome in. Are you thinking coffee, tea, or something cold?", zh: "歡迎光臨。你想喝咖啡、茶，還是冰飲？" },
        { en: "Hey, take your time. What sounds good today?", zh: "嘿，慢慢看。今天想喝什麼？" },
      ],
      travel: [
        { en: "Excuse me, you seem a bit lost. Are you looking for somewhere?", zh: "不好意思，你看起來有點迷路。你在找地方嗎？" },
        { en: "Hi, can I help? Which place are you trying to get to?", zh: "你好，我可以幫忙嗎？你想去哪裡？" },
        { en: "You look like you're checking directions. Where are you headed?", zh: "你看起來在看路線。你要去哪裡？" },
      ],
      daily: [
        { en: "Hey, good to see you. How's your day going so far?", zh: "嘿，很高興看到你。今天目前過得如何？" },
        { en: "Hi! What's been the busiest part of your day?", zh: "嗨！你今天最忙的是什麼？" },
        { en: "Nice to see you. Tell me one thing that happened today.", zh: "很高興見到你。跟我說今天發生的一件事。" },
      ],
      default: [
        fallback,
        { en: "Hi, let's start naturally. What's the first thing you want to say?", zh: "嗨，我們自然開始吧。你第一句想說什麼？" },
        { en: "Great, let's role-play this. What would you say first?", zh: "很好，我們來角色扮演。你第一句會怎麼說？" },
      ],
    },
    ja: {
      free: [
        { en: "こんにちは。今日はどんなテーマで話しましょうか？", zh: "你好。今天想用什麼主題聊天呢？" },
        { en: "こんにちは。今日は何を練習したいですか？", zh: "你好。今天想練習什麼呢？" },
      ],
      restaurant: [
        { en: "いらっしゃいませ。ご予約はありますか？", zh: "歡迎光臨。請問有預約嗎？" },
        { en: "こんばんは。何名様ですか？", zh: "晚上好。請問幾位？" },
      ],
      cafe: [
        { en: "いらっしゃいませ。今日は何を注文しますか？", zh: "歡迎光臨。今天想點什麼呢？" },
        { en: "こんにちは。店内でお召し上がりですか？", zh: "你好。請問內用嗎？" },
      ],
      travel: [
        { en: "こんにちは。どこへ行きたいですか？道案内しますよ。", zh: "你好。你想去哪裡？我可以幫你指路。" },
        { en: "大丈夫ですか？道に迷いましたか？", zh: "你還好嗎？迷路了嗎？" },
      ],
      daily: [
        { en: "こんにちは。今日はどんな一日でしたか？", zh: "你好。今天過得怎麼樣？" },
        { en: "お疲れさまです。今日はいそがしかったですか？", zh: "辛苦了。今天忙嗎？" },
      ],
      default: [
        { en: "こんにちは。この場面で会話を始めましょう。", zh: "你好。我們開始這個情境對話吧。" },
        { en: "では、自然な会話で練習しましょう。", zh: "那我們用自然對話來練習吧。" },
      ],
    },
    ko: {
      free: [
        { en: "안녕하세요. 오늘은 어떤 주제로 이야기해 볼까요?", zh: "你好。今天想聊什麼主題呢？" },
        { en: "안녕하세요. 오늘 무엇을 연습하고 싶어요?", zh: "你好。今天想練什麼呢？" },
      ],
      restaurant: [
        { en: "어서 오세요. 예약하셨나요?", zh: "歡迎光臨。請問有預約嗎？" },
        { en: "안녕하세요. 몇 분이세요?", zh: "你好。請問幾位？" },
      ],
      cafe: [
        { en: "어서 오세요. 무엇을 주문하시겠어요?", zh: "歡迎光臨。你想點什麼呢？" },
        { en: "안녕하세요. 매장에서 드시나요?", zh: "你好。請問內用嗎？" },
      ],
      travel: [
        { en: "안녕하세요. 어디로 가고 싶으세요? 길을 안내해 드릴게요.", zh: "你好。你想去哪裡？我可以幫你指路。" },
        { en: "길을 찾고 계세요? 어디로 가세요?", zh: "你在找路嗎？你要去哪裡？" },
      ],
      daily: [
        { en: "안녕하세요. 오늘 하루는 어땠어요?", zh: "你好。今天過得怎麼樣？" },
        { en: "오늘 바빴어요? 하나만 이야기해 주세요.", zh: "今天忙嗎？跟我說一件事。" },
      ],
      default: [
        { en: "안녕하세요. 이 상황으로 대화를 시작해 봐요.", zh: "你好。我們開始這個情境對話吧。" },
        { en: "좋아요. 자연스럽게 역할 연습을 해 봐요.", zh: "很好。我們自然地角色練習吧。" },
      ],
    },
    it: {
      free: [
        { en: "Ciao! Di che cosa vuoi parlare oggi?", zh: "你好！今天想聊什麼呢？" },
        { en: "Ciao! Che cosa vuoi esercitare oggi?", zh: "你好！今天想練習什麼呢？" },
      ],
      restaurant: [
        { en: "Buonasera, benvenuti. Avete una prenotazione?", zh: "晚上好，歡迎光臨。請問有預約嗎？" },
        { en: "Buongiorno. Per quante persone?", zh: "您好。請問幾位？" },
      ],
      cafe: [
        { en: "Ciao, benvenuto. Che cosa prendi oggi?", zh: "你好，歡迎光臨。今天想點什麼？" },
        { en: "Ciao! Lo prendi qui o da portare via?", zh: "你好！內用還是外帶？" },
      ],
      travel: [
        { en: "Ciao! Dove vuoi andare? Posso aiutarti con le indicazioni.", zh: "你好！你想去哪裡？我可以幫你指路。" },
        { en: "Hai bisogno di aiuto con la strada?", zh: "你需要幫忙看路嗎？" },
      ],
      daily: [
        { en: "Ciao! Com'è andata la tua giornata?", zh: "你好！今天過得怎麼樣？" },
        { en: "Ciao! Raccontami una cosa successa oggi.", zh: "你好！跟我說今天發生的一件事。" },
      ],
      default: [
        { en: "Ciao! Iniziamo questa conversazione insieme.", zh: "你好！我們一起開始這個情境對話吧。" },
        { en: "Perfetto. Facciamo una conversazione naturale.", zh: "很好。我們來一段自然對話。" },
      ],
    },
    es: {
      free: [
        { en: "¡Hola! ¿De qué quieres hablar hoy?", zh: "你好！今天想聊什麼呢？" },
        { en: "¡Hola! ¿Qué quieres practicar hoy?", zh: "你好！今天想練習什麼呢？" },
      ],
      restaurant: [
        { en: "Buenas noches, bienvenidos. ¿Tienen una reserva?", zh: "晚上好，歡迎光臨。請問有預約嗎？" },
        { en: "Hola, bienvenidos. ¿Para cuántas personas?", zh: "你好，歡迎。請問幾位？" },
      ],
      cafe: [
        { en: "Hola, bienvenido. ¿Qué quieres pedir hoy?", zh: "你好，歡迎光臨。今天想點什麼？" },
        { en: "Hola. ¿Lo quieres para tomar aquí o para llevar?", zh: "你好。內用還是外帶？" },
      ],
      travel: [
        { en: "Hola. ¿A dónde quieres ir? Puedo ayudarte con las indicaciones.", zh: "你好。你想去哪裡？我可以幫你指路。" },
        { en: "¿Necesitas ayuda con la dirección?", zh: "你需要幫忙看路嗎？" },
      ],
      daily: [
        { en: "¡Hola! ¿Cómo va tu día?", zh: "你好！今天過得怎麼樣？" },
        { en: "¡Hola! Cuéntame algo que te pasó hoy.", zh: "你好！跟我說今天發生的一件事。" },
      ],
      default: [
        { en: "¡Hola! Empecemos esta conversación.", zh: "你好！我們開始這個情境對話吧。" },
        { en: "Perfecto. Vamos a practicar una conversación natural.", zh: "很好。我們來一段自然對話。" },
      ],
    },
  }[targetLanguage.code];
  if (!map) return fallback;
  if (scene.themeId === "free") return choose(map.free);
  if (title.includes("餐廳") || title.includes("restaurant") || scene.themeId === "restaurant") return choose(map.restaurant);
  if (title.includes("咖啡") || title.includes("cafe")) return choose(map.cafe);
  if (title.includes("問路") || title.includes("direction") || scene.themeId === "travel") return choose(map.travel);
  if (scene.themeId === "daily") return choose(map.daily);
  return choose(map.default);
}

export default function ConversationPractice({
  scene,
  showZh,
  pronunciationOn = true,
  finishLabel = "結束對話並看成果",
  onUserTurn,
  onFinish,
}: {
  scene: Scene;
  showZh: boolean;
  pronunciationOn?: boolean;
  finishLabel?: string;
  onUserTurn?: (text: string) => boolean | void;
  onFinish: (result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) => void;
}) {
  const targetLanguage = scene.targetLanguage || learningService.getCurrentLanguage();
  const languageInfo = getLearningLanguage(targetLanguage);
  const activeScene = { ...scene, targetLanguage };
  const baseFirstTutor =
    scene.dialogue.find((d) => d.speaker === "tutor") || { en: "Hi! Let's practice together.", zh: "嗨！我們一起練習吧。" };
  const firstTutor = localizedOpening(scene, languageInfo, baseFirstTutor);

  const [msgs, setMsgs] = useState<Msg[]>([{ role: "tutor", en: firstTutor.en, zh: firstTutor.zh }]);
  const [input, setInput] = useState("");
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(pronunciationOn);
  const [activeWord, setActiveWord] = useState<{ word: string; sentence?: string } | null>(null);
  const [toast, setToast] = useState("");
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(() => learningService.getSpeechRate(targetLanguage));
  const [persona] = useState(() => pickPersona(scene));
  const [selectedTutor] = useState(() => getSelectedTutor(targetLanguage));
  const tutorName = selectedTutor.name;

  const endRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const stopListenRef = useRef<(() => void) | null>(null);
  const voiceDraftRef = useRef("");
  const voiceSubmitHandledRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const userTurnsRef = useRef<string[]>([]);
  const feedbacksRef = useRef<TutorFeedback[]>([]);
  const finishedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Speak the opening tutor line once and unlock audio
  useEffect(() => {
    let openingTimer: number | undefined;
    let hasPlayed = false;
    
    if (autoSpeak) {
      const playOpening = () => {
        if (hasPlayed) return;
        hasPlayed = true;
        void tutorVoiceService.playTutorReply(
          { reply: firstTutor.en, replyZh: firstTutor.zh, ttsCandidate: firstTutor.en, naturalness: 80, grammarTip: "", betterWay: "", zhExplain: "", encouragement: "" },
          {
            languageCode: targetLanguage,
            voiceGender: selectedTutor.gender,
            voiceProfileId: selectedTutor.id,
            onSpeakStart: () => setTutorVoiceActive(true),
            onSpeakEnd: () => setTutorVoiceActive(false),
          }
        );
      };
      
      // Try to play after a short delay
      openingTimer = window.setTimeout(() => {
        playOpening();
      }, 150);
      
      // Also play on first user interaction (fallback for autoplay policy)
      const onInteraction = () => {
        playOpening();
      };
      document.addEventListener('click', onInteraction, { once: true });
      document.addEventListener('touchstart', onInteraction, { once: true });
      
      return () => {
        document.removeEventListener('click', onInteraction);
        document.removeEventListener('touchstart', onInteraction);
      };
    }
    return () => {
      mountedRef.current = false;
      if (openingTimer) window.clearTimeout(openingTimer);
      tutorVoiceService.stop();
      audioQueueService.clearQueue();
      stopListenRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flashToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  }

  function setTutorVoiceActive(active: boolean) {
    if (mountedRef.current) setTutorSpeaking(active);
  }

  async function speak(text: string, animateTutor = true) {
    try {
      await tutorVoiceService.playManual(text, {
        languageCode: targetLanguage,
        voiceGender: selectedTutor.gender,
        voiceProfileId: selectedTutor.id,
        onSpeakStart: animateTutor ? () => setTutorVoiceActive(true) : undefined,
        onSpeakEnd: animateTutor ? () => setTutorVoiceActive(false) : undefined,
      });
    } catch (error) {
      setTutorVoiceActive(false);
      flashToast("無法播放發音");
    }
  }

  function updateSpeechRate(value: number) {
    const next = Math.max(0.75, Math.min(1.25, Number(value)));
    setSpeechRate(next);
    learningService.setSpeechRate(targetLanguage, next);
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || finishedRef.current) return;
    setBusy(true);
    setInput("");

    // Reset recording state to ensure tutor voice can play
    if (listening) {
      stopListenRef.current?.();
      setListening(false);
    }
    tutorVoiceService.setRecording(false);

    setMsgs((m) => [...m, { role: "user", en: trimmed, zh: "" }]);
    const history = [...historyRef.current];
    historyRef.current.push(trimmed);
    userTurnsRef.current = [...userTurnsRef.current, trimmed];

    if (onUserTurn?.(trimmed)) {
      setBusy(false);
      return;
    }

    // Unlock audio on first user interaction
    await audioQueueService.unlockAudio();

    let learnerSpeechDone = Promise.resolve();
    if (autoSpeak) {
      learnerSpeechDone = tutorVoiceService.playManual(trimmed, {
        languageCode: targetLanguage,
        voiceGender: selectedTutor.gender,
        voiceProfileId: selectedTutor.id,
      });
    }

    const fb = await aiTutorService.feedback(activeScene, trimmed, turn + 1, history, persona);
    feedbacksRef.current = [...feedbacksRef.current, fb];
    const reachedMax = userTurnsRef.current.length >= MAX_PRACTICE_TURNS;
    await learnerSpeechDone;
    if (!mountedRef.current) return;

    setMsgs((m) => {
      const copy = [...m];
      const lastUser = [...copy].reverse().find((x) => x.role === "user" && !x.feedback);
      if (lastUser) lastUser.feedback = fb;
      if (!reachedMax) copy.push({ role: "tutor", en: fb.reply, zh: fb.replyZh });
      return [...copy];
    });
    setTurn((t) => t + 1);
    setBusy(false);
    if (reachedMax) {
      finishedRef.current = true;
      tutorVoiceService.stop();
      audioQueueService.clearQueue();
      stopListenRef.current?.();
      flashToast("已完成 7 句，正在產生成績");
      window.setTimeout(() => finishWith(userTurnsRef.current, feedbacksRef.current, true), 550);
      return;
    }
    if (autoSpeak) {
      void tutorVoiceService.playTutorReply(fb, {
        languageCode: targetLanguage,
        voiceGender: selectedTutor.gender,
        voiceProfileId: selectedTutor.id,
        onSpeakStart: () => setTutorVoiceActive(true),
        onSpeakEnd: () => setTutorVoiceActive(false),
      });
    }
  }

  function toggleMic() {
    if (listening) {
      stopListenRef.current?.();
      finishVoiceInput(true);
      return;
    }
    tutorVoiceService.stop();
    tutorVoiceService.setRecording(true);
    voiceDraftRef.current = "";
    voiceSubmitHandledRef.current = false;
    setVoiceDraft("");
    const stop = speechService.listen({
      lang: selectedTutor.lang,
      onResult: (text) => {
        const transcript = text.trim();
        if (!transcript) return;
        voiceDraftRef.current = transcript;
        setVoiceDraft(transcript);
        setInput(transcript);
      },
      onError: (msg) => {
        voiceSubmitHandledRef.current = true;
        voiceDraftRef.current = "";
        tutorVoiceService.setRecording(false);
        flashToast(msg);
        setListening(false);
        setVoiceDraft("");
      },
      onEnd: () => {
        tutorVoiceService.setRecording(false);
        finishVoiceInput(true);
      },
    });
    if (stop) {
      stopListenRef.current = stop;
      setListening(true);
    }
  }

  function finishVoiceInput(showEmptyToast: boolean) {
    if (voiceSubmitHandledRef.current) return;
    voiceSubmitHandledRef.current = true;
    setListening(false);
    const spoken = voiceDraftRef.current.trim();
    voiceDraftRef.current = "";
    setVoiceDraft("");
    if (spoken) {
      setInput(spoken);
      void handleSend(spoken);
    } else if (showEmptyToast) {
      flashToast("沒有辨識到語音，請再試一次或改用打字回覆。");
    }
  }

  function finishWith(userTurns: string[], feedbacks: TutorFeedback[], force = false) {
    if (!force && userTurns.length < MIN_PRACTICE_TURNS) {
      flashToast(`請至少練習 ${MIN_PRACTICE_TURNS} 句對話再結束`);
      return;
    }
    const result = aiTutorService.summarize(activeScene, feedbacks, userTurns);
    tutorVoiceService.stop();
    audioQueueService.clearQueue();
    stopListenRef.current?.();
    onFinish(result, userTurns, feedbacks);
  }

  function finish() {
    const userTurns = userTurnsRef.current.length
      ? userTurnsRef.current
      : msgs.filter((m) => m.role === "user").map((m) => m.en);
    const feedbacks = feedbacksRef.current.length
      ? feedbacksRef.current
      : (msgs.filter((m) => m.feedback).map((m) => m.feedback!) as TutorFeedback[]);
    finishWith(userTurns, feedbacks);
  }

  const recSupported = speechService.isRecognitionSupported();
  const userTurnCount = msgs.filter((m) => m.role === "user").length;

  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pb-3 bg-cream/95">
        <div className={`relative h-52 overflow-hidden rounded-[30px] bg-ink shadow-soft transition-all duration-300 ${tutorSpeaking ? "ring-4 ring-mint/70" : ""}`}>
          <img
            src={selectedTutor.photoUrl}
            alt=""
            onError={(e) => { e.currentTarget.src = TUTOR_FALLBACK_PHOTO; }}
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg opacity-50"
          />
          <motion.img
            src={selectedTutor.photoUrl}
            alt={selectedTutor.name}
            onError={(e) => { e.currentTarget.src = TUTOR_FALLBACK_PHOTO; }}
            animate={tutorSpeaking ? { scale: [1, 1.025, 1.01], y: [0, -3, 0] } : { scale: 1, y: 0 }}
            transition={tutorSpeaking ? { duration: 1.15, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
            className={`relative h-full w-full object-contain object-center transition-[filter] duration-300 ${tutorSpeaking ? "drop-shadow-[0_0_24px_rgba(167,139,250,0.55)]" : ""}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-white/10" />
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-extrabold text-white backdrop-blur">
            <span className={`h-2 w-2 rounded-full bg-mintDeep shadow-[0_0_12px_rgba(86,211,145,0.9)] ${tutorSpeaking ? "animate-ping" : ""}`} />
            LIVE
          </div>
          {tutorSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-16 top-4 flex h-10 items-center gap-1 rounded-2xl bg-white/90 px-3 shadow-softer"
              aria-hidden="true"
            >
              <span className="h-3 w-1 rounded-full bg-lilacDeep animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-5 w-1 rounded-full bg-lilacDeep animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="h-4 w-1 rounded-full bg-lilacDeep animate-bounce" style={{ animationDelay: "240ms" }} />
              <span className="h-6 w-1 rounded-full bg-peachDeep animate-bounce" style={{ animationDelay: "360ms" }} />
            </motion.div>
          )}
          <button
            onClick={() => speak(selectedTutor.sampleLine)}
            className="absolute right-4 top-4 h-10 w-10 rounded-2xl bg-white/90 text-lilacDeep flex items-center justify-center shadow-softer active:scale-90 transition"
            title="試聽導師聲音"
          >
            <Volume2 size={18} />
          </button>
          <div className="absolute left-4 right-4 bottom-4">
            <p className="text-xl font-black text-white leading-tight drop-shadow">{selectedTutor.name} {selectedTutor.flag}</p>
            <p className="text-sm font-semibold text-white/85 truncate">{selectedTutor.accentLabel} · {selectedTutor.description}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 px-4 pb-44 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i}>
            <div className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              {m.role === "tutor" && <span className="text-xs font-bold text-inkSoft ml-1 mb-0.5">{tutorName}</span>}
              <div className={`max-w-[85%] rounded-3xl p-3 ${m.role === "user" ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
                <ClickableText
                  text={m.en}
                  onWord={(word) => setActiveWord({ word, sentence: m.en })}
                  language={targetLanguage}
                  className={m.role === "user" ? "text-white" : "text-ink"}
                />
                {showZh && m.zh && <p className={`text-sm mt-1 ${m.role === "user" ? "text-white/80" : "text-inkSoft"}`}>{m.zh}</p>}
                <div className="mt-1 flex gap-3">
                  <button onClick={() => speak(m.en, m.role === "tutor")} className={m.role === "user" ? "text-white/90" : "text-lilacDeep"}><Volume2 size={15} /></button>
                  <button onClick={() => { dictionaryService.toggleSentence(m.en, m.zh, scene.name); flashToast("已收藏句子"); }} className={m.role === "user" ? "text-white/90" : "text-peachDeep"}><Star size={15} /></button>
                </div>
              </div>
            </div>

            {m.feedback && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 ml-auto max-w-[90%] rounded-3xl bg-mint/60 p-3 text-sm">
                <p className="font-bold text-mintDeep">即時回饋 · 自然度 {m.feedback.naturalness}</p>
                <p className="text-ink mt-1">📝 {m.feedback.grammarTip}</p>
                <p className="text-ink">✨ 更自然：{m.feedback.betterWay}</p>
                {showZh && <p className="text-inkSoft">{m.feedback.zhExplain}</p>}
                <p className="text-peachDeep font-semibold mt-1">{m.feedback.encouragement}</p>
              </motion.div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex justify-start flex-col gap-1">
            <span className="text-xs font-bold text-inkSoft ml-1">{tutorName}</span>
            <div className="rounded-3xl bg-white shadow-softer px-4 py-3 text-inkSoft text-sm flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 rounded-full bg-lilacDeep/50 animate-bounce" style={{animationDelay:"0ms"}} />
                <span className="h-2 w-2 rounded-full bg-lilacDeep/50 animate-bounce" style={{animationDelay:"150ms"}} />
                <span className="h-2 w-2 rounded-full bg-lilacDeep/50 animate-bounce" style={{animationDelay:"300ms"}} />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm px-4 py-2 rounded-2xl shadow-soft max-w-[90%] text-center">
          {toast}
        </div>
      )}

      {/* Input bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-3 bg-cream/95 backdrop-blur space-y-2">
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <span className="text-xs font-bold text-inkSoft">
            已練習 {Math.min(userTurnCount, MAX_PRACTICE_TURNS)}/{MAX_PRACTICE_TURNS} 句
          </span>
          <button onClick={() => { setAutoSpeak((v) => !v); tutorVoiceService.setAutoPlay(!autoSpeak); }} className="flex items-center gap-1 text-xs font-bold text-inkSoft">
            {autoSpeak ? <Volume2 size={14} className="text-lilacDeep" /> : <VolumeX size={14} />}
            自動朗讀：{autoSpeak ? "開" : "關"}
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-1">
          <button className="text-xs font-bold text-peachDeep" onClick={finish}>{finishLabel}</button>
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-bold text-inkSoft shrink-0">語速 {speechRate.toFixed(2)}x</span>
          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={speechRate}
            onChange={(e) => updateSpeechRate(Number(e.target.value))}
            className="w-full accent-lilacDeep"
            aria-label={`${languageInfo.zhName}語速`}
          />
        </div>

        {listening && (
          <div className="rounded-[28px] bg-white p-3 shadow-softer">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-peach text-peachDeep">
                <span className="absolute h-3 w-3 rounded-full bg-peachDeep animate-ping" />
                <Mic size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-ink">錄音中 · 請說{languageInfo.zhName}</p>
                <p className="truncate text-xs font-semibold text-inkSoft">
                  {voiceDraft || `辨識語言：${selectedTutor.lang}`}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleMic}
                className="rounded-2xl bg-lilacDeep px-4 py-2 text-sm font-extrabold text-white active:scale-95"
              >
                結束
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 bg-white rounded-3xl px-3 py-2 shadow-softer">
          <button
            onClick={toggleMic}
            disabled={busy || finishedRef.current}
            title={recSupported ? "語音輸入" : "此瀏覽器不支援語音輸入"}
            className={`h-10 w-10 rounded-2xl flex items-center justify-center active:scale-90 transition shrink-0 ${
              listening ? "bg-peachDeep text-white animate-pulse" : recSupported ? "bg-mint text-mintDeep" : "bg-cream text-inkSoft"
            }`}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="用語音或打字回覆…"
            disabled={finishedRef.current}
            className="flex-1 bg-transparent outline-none text-ink min-w-0"
          />
          <button onClick={() => handleSend(input)} disabled={busy || !input.trim() || finishedRef.current} className="h-10 w-10 rounded-2xl bg-lilacDeep text-white flex items-center justify-center active:scale-90 transition disabled:opacity-50 shrink-0">
            <Send size={18} />
          </button>
        </div>
      </div>

      <WordSheet
        word={activeWord?.word || null}
        sentence={activeWord?.sentence}
        language={targetLanguage}
        showChinese={showZh}
        onClose={() => setActiveWord(null)}
      />
    </div>
  );
}
