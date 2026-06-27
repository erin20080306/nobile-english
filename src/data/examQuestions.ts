import type { ExamQuestion, ExamType, QuestionType } from "@/types";

type Cat = "vocabulary" | "grammar" | "reading" | "listening";
let _id = 0;
function q(
  exam: ExamType,
  category: Cat,
  type: QuestionType,
  question: string,
  options: string[],
  answerIndex: number,
  explanationZh: string,
  extra?: { passage?: string; reviewWords?: string[] }
): ExamQuestion {
  _id++;
  return {
    id: `${exam}-${_id}`,
    exam,
    category,
    type,
    question,
    options,
    answerIndex,
    explanationZh,
    passage: extra?.passage,
    reviewWords: extra?.reviewWords,
  };
}

const toeic: ExamQuestion[] = [
  q("TOEIC", "vocabulary", "vocabulary", "The shipment will ___ tomorrow morning.", ["arrive", "arrival", "arriving", "arrives"], 0, "助動詞 will 後接原形動詞 arrive。", { reviewWords: ["arrive", "shipment"] }),
  q("TOEIC", "grammar", "grammar", "Please submit the report ___ Friday.", ["in", "on", "at", "to"], 1, "星期幾用介系詞 on → on Friday。"),
  q("TOEIC", "vocabulary", "vocabulary", "We need to ___ the meeting to next week.", ["reschedule", "recycle", "remind", "remove"], 0, "reschedule = 重新安排時間。", { reviewWords: ["reschedule", "schedule"] }),
  q("TOEIC", "grammar", "grammar", "The manager, along with the staff, ___ attending the event.", ["is", "are", "were", "have"], 0, "主詞 The manager 為單數，along with... 不影響動詞 → is。"),
  q("TOEIC", "vocabulary", "vocabulary", "Our company offers a competitive ___ package.", ["salary", "celery", "saliva", "solar"], 0, "salary = 薪資。", { reviewWords: ["salary", "competitive"] }),
  q("TOEIC", "reading", "reading", "What is the purpose of the email?", ["To confirm an order", "To cancel a flight", "To apply for a job", "To book a hotel"], 0, "信中提到 confirm your order，目的是確認訂單。", { passage: "Dear customer, we are writing to confirm your order #2231. It will be delivered within 3 business days." }),
  q("TOEIC", "grammar", "fill-blank", "If you have any questions, please ___ free to contact us.", ["feel", "feeling", "felt", "feels"], 0, "固定用法 feel free to。"),
  q("TOEIC", "vocabulary", "vocabulary", "The new policy will ___ next month.", ["take effect", "take off", "take care", "take part"], 0, "take effect = 生效。", { reviewWords: ["policy", "effect"] }),
  q("TOEIC", "grammar", "grammar", "The documents ___ by the assistant yesterday.", ["prepared", "were prepared", "prepare", "preparing"], 1, "被動語態過去式 → were prepared。"),
  q("TOEIC", "reading", "reading", "When will the office reopen?", ["Monday", "Tuesday", "Wednesday", "Friday"], 0, "公告寫 reopen on Monday。", { passage: "The office will be closed for renovation this weekend and will reopen on Monday." }),
  q("TOEIC", "vocabulary", "vocabulary", "Please ___ your receipt for a refund.", ["keep", "throw", "lose", "eat"], 0, "keep your receipt = 保留收據。", { reviewWords: ["receipt", "refund"] }),
  q("TOEIC", "grammar", "grammar", "Neither the manager nor the employees ___ aware of the change.", ["was", "were", "is", "has"], 1, "neither...nor 動詞與最近主詞一致 → employees → were。"),
  q("TOEIC", "vocabulary", "vocabulary", "The conference was ___ due to bad weather.", ["postponed", "posted", "positioned", "posed"], 0, "postpone = 延期。", { reviewWords: ["postpone", "conference"] }),
  q("TOEIC", "grammar", "fill-blank", "We look forward ___ from you soon.", ["to hear", "to hearing", "hearing", "hear"], 1, "look forward to + Ving。"),
  q("TOEIC", "vocabulary", "vocabulary", "All employees must ___ to the safety rules.", ["adhere", "appear", "agree", "answer"], 0, "adhere to = 遵守。", { reviewWords: ["adhere", "safety"] }),
  q("TOEIC", "reading", "situational", "A customer says the product is defective. What should you offer?", ["A replacement", "A complaint", "A delay", "A meeting"], 0, "瑕疵品應提供更換（replacement）。"),
  q("TOEIC", "grammar", "grammar", "The report needs ___ before the deadline.", ["finish", "to finish", "finishing", "finished"], 2, "need + Ving 表被動需要 → finishing。"),
  q("TOEIC", "vocabulary", "vocabulary", "Sales have increased ___ 20% this quarter.", ["by", "of", "on", "in"], 0, "increase by + 數值。", { reviewWords: ["increase", "quarter"] }),
  q("TOEIC", "grammar", "reorder", "Reorder: please / the invoice / send / to me", ["Please send the invoice to me.", "Send please me to invoice.", "The invoice me send please.", "To me please send invoice."], 0, "祈使句：Please + 動詞 + 受詞。"),
  q("TOEIC", "reading", "reading", "What does the customer want?", ["A refund", "A discount", "A new size", "A receipt"], 2, "顧客說 the size is too small, can I exchange → 想換尺寸。", { passage: "Hi, the shirt I bought is too small. Can I exchange it for a larger size?" }),
  q("TOEIC", "listening", "situational", "[Conversation] Where will the speakers probably meet?", ["At the front desk", "In the warehouse", "At the airport gate", "In a restaurant kitchen"], 0, "對話提到 visitor badge 和 lobby，因此最可能在櫃台或大廳碰面。", { passage: "Man: I just arrived for the 10 a.m. meeting. Woman: Great. Please pick up your visitor badge at the front desk, and I'll meet you in the lobby.", reviewWords: ["badge", "lobby"] }),
  q("TOEIC", "reading", "reading", "What is implied about the delivery?", ["It may arrive later than planned", "It has already been returned", "It was sent to the wrong country", "It contains damaged items"], 0, "信件說 warehouse is experiencing delays，可推論配送可能延遲。", { passage: "Due to a high volume of orders, our warehouse is experiencing delays. We apologize and will send tracking information as soon as your package ships.", reviewWords: ["imply", "delay", "tracking"] }),
  q("TOEIC", "grammar", "fill-blank", "The training session is mandatory for employees ___ joined after March 1.", ["who", "which", "where", "whose"], 0, "先行詞 employees 是人，關係代名詞用 who。"),
  q("TOEIC", "vocabulary", "vocabulary", "The client asked for a more ___ estimate before approving the budget.", ["detailed", "detailing", "details", "detail"], 0, "estimate 前需要形容詞 detailed。", { reviewWords: ["estimate", "approve", "budget"] }),
];

const ielts: ExamQuestion[] = [
  q("IELTS", "vocabulary", "vocabulary", "The research provides strong ___ for the theory.", ["evidence", "evident", "evidently", "evidences"], 0, "evidence（證據）為不可數名詞。", { reviewWords: ["evidence", "theory"] }),
  q("IELTS", "grammar", "grammar", "Rarely ___ such a beautiful sunset.", ["I have seen", "have I seen", "I saw", "did I saw"], 1, "否定副詞 Rarely 置句首需倒裝 → have I seen。"),
  q("IELTS", "vocabulary", "vocabulary", "The government plans to ___ carbon emissions.", ["reduce", "reuse", "refuse", "review"], 0, "reduce = 減少。", { reviewWords: ["reduce", "emission"] }),
  q("IELTS", "reading", "reading", "According to the passage, what causes the change?", ["Human activity", "Natural cycles", "Animal behavior", "Unknown reasons"], 0, "文中指出 mainly caused by human activity。", { passage: "Scientists agree that recent climate change is mainly caused by human activity, especially burning fossil fuels." }),
  q("IELTS", "vocabulary", "vocabulary", "Her argument was both clear and ___.", ["persuasive", "persuade", "persuasion", "persuasively"], 0, "需要形容詞 persuasive（有說服力的）。", { reviewWords: ["persuasive", "argument"] }),
  q("IELTS", "grammar", "fill-blank", "The more you practice, ___ you become.", ["the better", "better", "the best", "good"], 0, "the + 比較級, the + 比較級。"),
  q("IELTS", "reading", "reading", "What is the writer's main opinion?", ["Online learning has benefits", "Online learning is useless", "Schools should close", "Teachers are unnecessary"], 0, "作者認為線上學習有好處（benefits）。", { passage: "Although online learning has some drawbacks, it offers flexibility and access to global resources, which are clear benefits." }),
  q("IELTS", "vocabulary", "vocabulary", "The findings were ___ with previous studies.", ["consistent", "consist", "consistency", "consistently"], 0, "be consistent with = 與…一致。", { reviewWords: ["consistent", "findings"] }),
  q("IELTS", "grammar", "grammar", "It is essential that he ___ on time.", ["is", "be", "was", "being"], 1, "essential that + 主詞 + 原形動詞（虛擬語氣）→ be。"),
  q("IELTS", "vocabulary", "vocabulary", "Urbanization has led to a ___ in green space.", ["decline", "incline", "recline", "decade"], 0, "decline = 下降、減少。", { reviewWords: ["decline", "urbanization"] }),
  q("IELTS", "reading", "situational", "In a discussion, how do you politely disagree?", ["You're wrong.", "I see your point, but...", "No way.", "That's silly."], 1, "I see your point, but... 是禮貌表達不同意。"),
  q("IELTS", "grammar", "grammar", "Not only ___ late, but he also forgot the files.", ["he was", "was he", "he is", "is he"], 1, "Not only 句首倒裝 → was he。"),
  q("IELTS", "vocabulary", "vocabulary", "The policy had a significant ___ on the economy.", ["impact", "import", "impart", "impair"], 0, "have an impact on = 對…有影響。", { reviewWords: ["impact", "economy"] }),
  q("IELTS", "reading", "reading", "What can be inferred about the author?", ["Supports renewable energy", "Dislikes technology", "Is a politician", "Hates cities"], 0, "文末強調再生能源優點，可推論作者支持。", { passage: "Renewable energy not only reduces pollution but also creates jobs, making it a wise long-term investment." }),
  q("IELTS", "vocabulary", "vocabulary", "Students should ___ their sources properly.", ["cite", "site", "sight", "sit"], 0, "cite = 引用出處。", { reviewWords: ["cite", "source"] }),
  q("IELTS", "grammar", "reorder", "Reorder: a major / climate change / challenge / is", ["Climate change is a major challenge.", "A major challenge climate change is.", "Is climate change a major challenge.", "Challenge a major is climate change."], 0, "主詞 + be + 補語結構。"),
  q("IELTS", "vocabulary", "vocabulary", "The author ___ that more research is needed.", ["concludes", "include", "exclude", "preclude"], 0, "conclude = 下結論。", { reviewWords: ["conclude", "research"] }),
  q("IELTS", "grammar", "fill-blank", "Had I known earlier, I ___ have helped.", ["will", "would", "can", "may"], 1, "與過去事實相反假設 → would have。"),
  q("IELTS", "reading", "reading", "What is the purpose of paragraph 2?", ["To give examples", "To conclude", "To introduce", "To apologize"], 0, "第二段列舉例子支持論點。", { passage: "For example, cities like Copenhagen and Amsterdam have invested heavily in cycling infrastructure." }),
  q("IELTS", "vocabulary", "vocabulary", "The two theories are fundamentally ___.", ["different", "differ", "difference", "differently"], 0, "be 動詞後接形容詞 different。", { reviewWords: ["fundamentally", "theory"] }),
  q("IELTS", "reading", "reading", "Which statement best matches the writer's view?", ["Public transport can reduce urban pollution", "Cars should be banned immediately", "Cycling is impossible in large cities", "Pollution is unrelated to transport"], 0, "作者支持公共運輸能降低都市污染，其他選項過度絕對或不符。", { passage: "Expanding public transport is unlikely to solve every urban problem, but it can reduce air pollution and make cities more accessible.", reviewWords: ["accessible", "pollution"] }),
  q("IELTS", "vocabulary", "vocabulary", "The word 'substantial' is closest in meaning to ___.", ["considerable", "temporary", "minor", "uncertain"], 0, "substantial = 大量的、顯著的，接近 considerable。", { reviewWords: ["substantial", "considerable"] }),
  q("IELTS", "grammar", "fill-blank", "The data ___ that students benefit from regular feedback.", ["suggests", "suggest", "suggesting", "to suggest"], 1, "IELTS/學術英文常把 data 視為複數，接 suggest。"),
  q("IELTS", "listening", "situational", "In IELTS Speaking, which answer is the strongest?", ["Yes.", "I like it.", "Yes, especially because it helps me stay focused after a long day.", "Good."], 2, "口說高分回答需要延伸原因與細節，而不只短答。"),
];

const toefl: ExamQuestion[] = [
  q("TOEFL", "reading", "reading", "The word 'crucial' is closest in meaning to ___.", ["essential", "optional", "minor", "casual"], 0, "crucial = 關鍵的，近義 essential。", { reviewWords: ["crucial", "essential"] }),
  q("TOEFL", "grammar", "grammar", "The professor asked the students ___ their essays.", ["revise", "to revise", "revising", "revised"], 1, "ask sb to do → to revise。"),
  q("TOEFL", "vocabulary", "vocabulary", "Photosynthesis ___ sunlight into energy.", ["converts", "covers", "connects", "contains"], 0, "convert A into B = 把A轉換成B。", { reviewWords: ["convert", "photosynthesis"] }),
  q("TOEFL", "reading", "reading", "What is the main idea of the passage?", ["Bees are vital pollinators", "Bees are dangerous", "Honey is healthy", "Flowers are pretty"], 0, "全文強調蜜蜂作為授粉者的重要性。", { passage: "Bees play a vital role in ecosystems by pollinating plants, which supports food production worldwide." }),
  q("TOEFL", "vocabulary", "vocabulary", "The data ___ a clear trend.", ["reveal", "reveals", "revealing", "revealed"], 1, "data 此處視為單數主詞 → reveals（學術常見）。", { reviewWords: ["reveal", "trend"] }),
  q("TOEFL", "grammar", "fill-blank", "___ being tired, she finished the project.", ["Despite", "Although", "However", "Because"], 0, "Despite + 名詞/動名詞片語。"),
  q("TOEFL", "listening", "reading", "What is the lecture mainly about?", ["The water cycle", "A history exam", "A campus tour", "A job fair"], 0, "講座主旨為水循環（the water cycle）。", { passage: "[Lecture] Today we'll examine how water moves through evaporation, condensation, and precipitation." }),
  q("TOEFL", "vocabulary", "vocabulary", "The experiment yielded ___ results.", ["significant", "signify", "signal", "signature"], 0, "需要形容詞 significant（顯著的）。", { reviewWords: ["significant", "experiment"] }),
  q("TOEFL", "grammar", "grammar", "Scientists believe that the universe ___ expanding.", ["is", "are", "be", "being"], 0, "the universe 單數主詞 → is。"),
  q("TOEFL", "reading", "reading", "Why does the author mention the example of glaciers?", ["To show evidence of warming", "To describe tourism", "To explain cooking", "To sell tours"], 0, "冰川融化作為暖化的證據。", { passage: "Melting glaciers, the author notes, serve as visible evidence of rising global temperatures." }),
  q("TOEFL", "vocabulary", "vocabulary", "Her research ___ to our understanding of memory.", ["contributes", "distributes", "attributes", "tributes"], 0, "contribute to = 對…有貢獻。", { reviewWords: ["contribute", "memory"] }),
  q("TOEFL", "grammar", "grammar", "The theory, ___ was proposed in 1905, changed physics.", ["which", "who", "whom", "where"], 0, "先行詞為事物且非限定 → which。"),
  q("TOEFL", "listening", "situational", "What does the student need help with?", ["Choosing a course", "Finding a dorm", "Paying tuition", "Buying books"], 0, "學生詢問選課（choosing a course）。", { passage: "[Conversation] Student: I'm not sure which biology course to take next semester." }),
  q("TOEFL", "vocabulary", "vocabulary", "The findings ___ the original hypothesis.", ["support", "supportive", "supporter", "supposedly"], 0, "需要動詞 support。", { reviewWords: ["support", "hypothesis"] }),
  q("TOEFL", "grammar", "reorder", "Reorder: rapidly / technology / is / advancing", ["Technology is advancing rapidly.", "Rapidly technology advancing is.", "Is technology advancing rapidly.", "Advancing rapidly is technology."], 0, "主詞 + be + 現在分詞 + 副詞。"),
  q("TOEFL", "reading", "reading", "The phrase 'as a result' signals ___.", ["a cause-effect relationship", "a contrast", "an example", "a time order"], 0, "as a result 表因果關係。"),
  q("TOEFL", "vocabulary", "vocabulary", "Many species are on the ___ of extinction.", ["verge", "edge of fun", "side", "top"], 0, "on the verge of = 瀕臨。", { reviewWords: ["verge", "extinction"] }),
  q("TOEFL", "grammar", "fill-blank", "The results were surprising; ___, they were not published.", ["nevertheless", "therefore", "because", "so that"], 0, "nevertheless 表轉折（儘管如此）。"),
  q("TOEFL", "listening", "situational", "A professor says 'Let's table this discussion.' This means ___.", ["postpone it", "start it now", "vote on it", "write it down"], 0, "table this = 暫緩討論（美式）。"),
  q("TOEFL", "vocabulary", "vocabulary", "The ancient ruins were remarkably well ___.", ["preserved", "presented", "pressured", "presumed"], 0, "preserve = 保存。", { reviewWords: ["preserve", "ancient"] }),
  q("TOEFL", "listening", "reading", "Why does the professor mention tree rings?", ["To provide evidence for past climate patterns", "To explain how to plant trees", "To compare two campus buildings", "To introduce a homework policy"], 0, "教授提到 tree rings 是為了說明過去氣候模式的證據。", { passage: "[Lecture] Tree rings can reveal periods of drought and rainfall, giving scientists evidence about past climate conditions.", reviewWords: ["evidence", "climate", "drought"] }),
  q("TOEFL", "reading", "reading", "What can be inferred from the passage?", ["The species adapted to a colder environment", "The species disappeared immediately", "The habitat never changed", "Researchers rejected all fossil evidence"], 0, "文章提到 thicker fur and smaller ears，表示物種適應較冷環境。", { passage: "Fossil evidence suggests that over many generations, the animal developed thicker fur and smaller ears, traits commonly associated with colder climates.", reviewWords: ["infer", "adapt", "fossil"] }),
  q("TOEFL", "vocabulary", "vocabulary", "The word 'plausible' is closest in meaning to ___.", ["reasonable", "impossible", "ancient", "brief"], 0, "plausible = 合理可信的。", { reviewWords: ["plausible", "reasonable"] }),
  q("TOEFL", "grammar", "fill-blank", "The committee recommended that the proposal ___ revised before approval.", ["be", "is", "was", "being"], 0, "recommend that + 主詞 + 原形動詞，正式英文用 be revised。"),
];

export const examQuestions: ExamQuestion[] = [...toeic, ...ielts, ...toefl];
