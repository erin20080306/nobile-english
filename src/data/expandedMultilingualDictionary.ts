import type { LearningLanguageCode, Word } from "@/types";

export function entry(
  language: Exclude<LearningLanguageCode, "en">,
  word: string,
  phonetic: string,
  pos: Word["pos"],
  enDef: string,
  zh: string,
  example: string,
  exampleZh: string,
  related: string[] = []
): Word {
  return { language, word, phonetic, pos, enDef, zh, example, exampleZh, related };
}

export const expandedMultilingualDictionaryEntries: Word[] = [

  // ════════════════════════════════════════════════════════════════════
  // JAPANESE (日本語) — 95 entries
  // ════════════════════════════════════════════════════════════════════

  // Food & Cooking
  entry("ja", "朝ご飯", "asagohan", "n.", "breakfast", "早餐", "毎朝七時に朝ご飯を食べます。", "我每天早上七點吃早餐。"),
  entry("ja", "昼ご飯", "hirugohan", "n.", "lunch", "午餐", "昼ご飯は何を食べますか。", "你午餐吃什麼？"),
  entry("ja", "晩ご飯", "bangohan", "n.", "dinner", "晚餐", "今夜の晩ご飯は何ですか。", "今晚晚餐是什麼？"),
  entry("ja", "お腹が空いた", "onaka ga suita", "adj.", "hungry", "肚子餓了", "お腹が空いたので何か食べたいです。", "我餓了，想吃點東西。"),
  entry("ja", "おいしい", "oishii", "adj.", "delicious or tasty", "好吃的", "このラーメンはおいしいです。", "這碗拉麵很好吃。"),
  entry("ja", "ラーメン", "raamen", "n.", "ramen noodles", "拉麵", "ラーメンを一杯ください。", "請給我一碗拉麵。"),
  entry("ja", "寿司", "sushi", "n.", "sushi", "壽司", "寿司が大好きです。", "我非常喜歡壽司。"),
  entry("ja", "天ぷら", "tenpura", "n.", "tempura; battered and fried food", "天婦羅", "天ぷらをください。", "請給我天婦羅。"),
  entry("ja", "お茶", "ocha", "n.", "green tea", "綠茶", "お茶を一杯いかがですか。", "要來一杯綠茶嗎？"),
  entry("ja", "ビール", "biiru", "n.", "beer", "啤酒", "冷たいビールをください。", "請給我一杯冰啤酒。"),
  entry("ja", "甘い", "amai", "adj.", "sweet in taste", "甜的", "このケーキは甘すぎます。", "這個蛋糕太甜了。"),
  entry("ja", "辛い", "karai", "adj.", "spicy or hot in taste", "辣的", "この料理は辛いですか。", "這道菜辣嗎？"),
  entry("ja", "アレルギーがあります", "arerugii ga arimasu", "v.", "I have an allergy", "我有過敏", "えびアレルギーがあります。", "我對蝦子過敏。"),
  entry("ja", "量", "ryou", "n.", "amount or portion", "份量", "量が多いですね。", "份量很多呢。"),
  entry("ja", "辛抱", "shimbo", "v.", "patience while eating", "耐心", "辛抱強く待ってください。", "請耐心等待。"),

  // Shopping & Money
  entry("ja", "いくらですか", "ikura desu ka", "pron.", "how much is it?", "多少錢？", "これはいくらですか。", "這個多少錢？"),
  entry("ja", "安い", "yasui", "adj.", "cheap or inexpensive", "便宜的", "これはとても安いですね。", "這個很便宜呢。"),
  entry("ja", "高い", "takai", "adj.", "expensive or tall", "貴的；高的", "このかばんは高すぎます。", "這個包包太貴了。"),
  entry("ja", "割引", "waribiki", "n.", "discount", "折扣", "割引はありますか。", "有折扣嗎？"),
  entry("ja", "クレジットカード", "kurejitto kaado", "n.", "credit card", "信用卡", "クレジットカードで払えますか。", "可以刷卡嗎？"),
  entry("ja", "現金", "genkin", "n.", "cash", "現金", "現金でお願いします。", "請用現金。"),
  entry("ja", "領収書", "ryoushusho", "n.", "receipt", "收據", "領収書をください。", "請給我收據。"),
  entry("ja", "袋", "fukuro", "n.", "bag or sack", "袋子", "袋をください。", "請給我袋子。"),
  entry("ja", "試着", "shichaku", "n.", "trying on clothes", "試穿", "試着してもいいですか。", "可以試穿嗎？"),
  entry("ja", "サイズ", "saizu", "n.", "size", "尺寸", "Mサイズはありますか。", "有M號嗎？"),
  entry("ja", "色", "iro", "n.", "color", "顏色", "別の色はありますか。", "有其他顏色嗎？"),

  // Transport & Directions
  entry("ja", "電車", "densha", "n.", "train or subway", "電車", "電車で行きます。", "我搭電車去。"),
  entry("ja", "バス停", "basu tei", "n.", "bus stop", "公車站", "バス停はどこですか。", "公車站在哪裡？"),
  entry("ja", "地下鉄", "chikatetsu", "n.", "subway or metro", "地鐵", "地下鉄の乗り方を教えてください。", "請告訴我怎麼搭地鐵。"),
  entry("ja", "タクシー", "takushii", "n.", "taxi", "計程車", "タクシーを呼んでください。", "請幫我叫計程車。"),
  entry("ja", "まっすぐ", "massugu", "adv.", "straight ahead", "直走", "まっすぐ行ってください。", "請直走。"),
  entry("ja", "右に曲がる", "migi ni magaru", "v.", "to turn right", "右轉", "次の信号を右に曲がります。", "在下一個紅綠燈右轉。"),
  entry("ja", "左に曲がる", "hidari ni magaru", "v.", "to turn left", "左轉", "コンビニの前で左に曲がります。", "在便利商店前左轉。"),
  entry("ja", "近い", "chikai", "adj.", "near or close", "近的", "駅は近いですか。", "車站近嗎？"),
  entry("ja", "遠い", "tooi", "adj.", "far away", "遠的", "ここから遠いですか。", "從這裡遠嗎？"),
  entry("ja", "乗り換え", "norikae", "n.", "transfer between trains", "換乘；轉車", "どこで乗り換えますか。", "在哪裡轉車？"),
  entry("ja", "切符", "kippu", "n.", "ticket", "票", "切符を買ってください。", "請買票。"),

  // Weather
  entry("ja", "天気", "tenki", "n.", "weather", "天氣", "今日の天気はどうですか。", "今天天氣如何？"),
  entry("ja", "晴れ", "hare", "n.", "clear sunny weather", "晴天", "明日は晴れです。", "明天是晴天。"),
  entry("ja", "雨", "ame", "n.", "rain", "雨", "雨が降っています。", "正在下雨。"),
  entry("ja", "雪", "yuki", "n.", "snow", "雪", "今日は雪が降るかもしれません。", "今天可能會下雪。"),
  entry("ja", "暑い", "atsui", "adj.", "hot in temperature", "熱的", "今日はとても暑いですね。", "今天好熱呢。"),
  entry("ja", "寒い", "samui", "adj.", "cold in temperature", "冷的", "今日は寒いですね。", "今天好冷呢。"),
  entry("ja", "涼しい", "suzushii", "adj.", "pleasantly cool", "涼爽的", "今日は涼しいですね。", "今天真涼爽呢。"),
  entry("ja", "曇り", "kumori", "n.", "cloudy weather", "陰天", "今日は曇りです。", "今天是陰天。"),

  // Family & People
  entry("ja", "家族", "kazoku", "n.", "family", "家人；家庭", "家族と旅行します。", "我和家人去旅行。"),
  entry("ja", "父", "chichi", "n.", "one's own father", "父親", "父は会社員です。", "我父親是上班族。"),
  entry("ja", "母", "haha", "n.", "one's own mother", "母親", "母はとても優しいです。", "我母親非常溫柔。"),
  entry("ja", "兄", "ani", "n.", "one's own older brother", "哥哥", "兄は医者です。", "我哥哥是醫生。"),
  entry("ja", "姉", "ane", "n.", "one's own older sister", "姐姐", "姉は東京に住んでいます。", "我姐姐住在東京。"),
  entry("ja", "友達", "tomodachi", "n.", "friend", "朋友", "友達と映画を見ました。", "我和朋友看了電影。"),

  // Work & Study
  entry("ja", "仕事", "shigoto", "n.", "work or job", "工作", "仕事は何ですか。", "你的工作是什麼？"),
  entry("ja", "会社", "kaisha", "n.", "company or office", "公司", "どの会社で働いていますか。", "你在哪家公司工作？"),
  entry("ja", "上司", "jooshi", "n.", "superior or boss", "上司；老闆", "上司に報告しました。", "我向上司報告了。"),
  entry("ja", "会議", "kaigi", "n.", "meeting or conference", "會議", "午後に会議があります。", "下午有會議。"),
  entry("ja", "締め切り", "shimekiri", "n.", "deadline", "截止日期", "締め切りは金曜日です。", "截止日期是星期五。"),
  entry("ja", "大学", "daigaku", "n.", "university", "大學", "大学で英語を勉強しています。", "我在大學學英文。"),
  entry("ja", "授業", "jugyou", "n.", "class or lesson", "課程", "授業は何時に始まりますか。", "課程幾點開始？"),
  entry("ja", "試験", "shiken", "n.", "test or exam", "考試", "明日は試験があります。", "明天有考試。"),
  entry("ja", "宿題", "shukudai", "n.", "homework", "作業", "宿題を忘れました。", "我忘了做作業。"),

  // Daily Life & Health
  entry("ja", "病院", "byouin", "n.", "hospital", "醫院", "病院に行かなければなりません。", "我必須去醫院。"),
  entry("ja", "薬", "kusuri", "n.", "medicine or drug", "藥", "薬を飲んでください。", "請服藥。"),
  entry("ja", "頭が痛い", "atama ga itai", "adj.", "having a headache", "頭痛", "頭が痛いので休みたいです。", "我頭痛，想休息。"),
  entry("ja", "熱がある", "netsu ga aru", "v.", "to have a fever", "發燒", "熱があります。", "我發燒了。"),
  entry("ja", "疲れた", "tsukareta", "adj.", "tired or exhausted", "疲累的", "仕事で疲れました。", "工作讓我很累。"),
  entry("ja", "元気", "genki", "adj.", "healthy and energetic", "有活力的；健康的", "お元気ですか。", "你好嗎？"),
  entry("ja", "眠い", "nemui", "adj.", "sleepy or drowsy", "想睡的", "眠くて勉強できません。", "我太想睡覺了，沒辦法念書。"),

  // Useful Phrases
  entry("ja", "少々お待ちください", "shoushou omachi kudasai", "v.", "please wait a moment", "請稍候", "少々お待ちください。", "請稍候。"),
  entry("ja", "わかりません", "wakarimasen", "v.", "I don't understand", "我不明白", "すみません、わかりません。", "不好意思，我不明白。"),
  entry("ja", "もう一度お願いします", "mou ichido onegaishimasu", "v.", "please say that again", "請再說一次", "もう一度お願いします。", "請再說一次。"),
  entry("ja", "どうぞ", "douzo", "adv.", "please; go ahead", "請；請便", "どうぞ、どうぞ。", "請，請。"),
  entry("ja", "大丈夫", "daijoubu", "adj.", "okay; no problem", "沒問題；好的", "大丈夫ですか。", "你還好嗎？"),
  entry("ja", "楽しい", "tanoshii", "adj.", "fun or enjoyable", "開心的；有趣的", "日本語を学ぶのは楽しいです。", "學日文很開心。"),
  entry("ja", "難しい", "muzukashii", "adj.", "difficult or hard", "困難的", "この漢字は難しいです。", "這個漢字很難。"),
  entry("ja", "簡単", "kantan", "adj.", "easy or simple", "簡單的", "これは簡単です。", "這很簡單。"),

  // ════════════════════════════════════════════════════════════════════
  // KOREAN (한국어) — 90 entries
  // ════════════════════════════════════════════════════════════════════

  // Greetings & Basics
  entry("ko", "감사합니다", "gamsahamnida", "interj.", "thank you (formal)", "謝謝您", "도움을 주셔서 감사합니다.", "謝謝您的幫助。"),
  entry("ko", "죄송합니다", "joesonghamnida", "interj.", "I am sorry (formal)", "對不起", "늦어서 죄송합니다.", "對不起，我遲到了。"),
  entry("ko", "괜찮아요", "gwaenchanayo", "adj.", "it's okay; no problem", "沒關係；還好", "괜찮아요. 걱정하지 마세요.", "沒關係，不用擔心。"),
  entry("ko", "잠깐만요", "jamkkanmanyo", "adv.", "just a moment please", "請稍候", "잠깐만요, 확인해 볼게요.", "請稍候，我確認一下。"),
  entry("ko", "모르겠어요", "moreugesseoyo", "v.", "I don't know", "我不知道", "죄송하지만 모르겠어요.", "對不起，我不知道。"),
  entry("ko", "이해했어요", "ihaehesseoyo", "v.", "I understood", "我明白了", "네, 이해했어요.", "好的，我明白了。"),
  entry("ko", "다시 한번", "dasi hanbeon", "adv.", "one more time; again", "再一次", "다시 한번 말씀해 주세요.", "請再說一次。"),

  // Food & Restaurant
  entry("ko", "맛있어요", "masisseoyo", "adj.", "delicious; tasty", "好吃", "정말 맛있어요!", "真的很好吃！"),
  entry("ko", "맵다", "maepda", "adj.", "spicy hot", "辣的", "이 음식은 얼마나 맵나요?", "這道菜有多辣？"),
  entry("ko", "달다", "dalda", "adj.", "sweet in taste", "甜的", "이 케이크는 너무 달아요.", "這個蛋糕太甜了。"),
  entry("ko", "짜다", "jjada", "adj.", "salty in taste", "鹹的", "국이 좀 짜요.", "湯有點鹹。"),
  entry("ko", "삼겹살", "samgyeopsal", "n.", "grilled pork belly", "五花肉（燒烤）", "삼겹살을 먹고 싶어요.", "我想吃五花肉。"),
  entry("ko", "비빔밥", "bibimbap", "n.", "mixed rice bowl", "拌飯", "비빔밥 하나 주세요.", "請給我一份拌飯。"),
  entry("ko", "김치", "kimchi", "n.", "fermented spicy cabbage", "泡菜", "김치가 들어있나요?", "有泡菜嗎？"),
  entry("ko", "된장찌개", "doenjangjjigae", "n.", "soybean paste stew", "大醬湯", "된장찌개와 밥 주세요.", "請給我大醬湯和白飯。"),
  entry("ko", "물", "mul", "n.", "water", "水", "물 한 잔 주세요.", "請給我一杯水。"),
  entry("ko", "계산서", "gyesanseo", "n.", "the bill or check", "帳單", "계산서 부탁드립니다.", "麻煩請給我帳單。"),
  entry("ko", "포장", "pojang", "n.", "takeout or packaging", "外帶；打包", "포장해 주세요.", "請幫我打包。"),
  entry("ko", "예약", "yeyak", "n.", "reservation", "預約", "예약했어요.", "我有預約。"),

  // Shopping
  entry("ko", "얼마예요", "eolmayeyo", "pron.", "how much is it?", "多少錢？", "이게 얼마예요?", "這個多少錢？"),
  entry("ko", "싸다", "ssada", "adj.", "cheap or inexpensive", "便宜的", "이건 정말 싸요.", "這個真的很便宜。"),
  entry("ko", "비싸다", "bissada", "adj.", "expensive", "貴的", "너무 비싸요.", "太貴了。"),
  entry("ko", "할인", "halin", "n.", "discount", "折扣", "할인이 있나요?", "有折扣嗎？"),
  entry("ko", "카드", "kadeu", "n.", "card (credit/debit)", "信用卡", "카드로 결제할게요.", "我要刷卡。"),
  entry("ko", "영수증", "yeongsujeung", "n.", "receipt", "收據", "영수증 주세요.", "請給我收據。"),
  entry("ko", "사이즈", "saijeu", "n.", "size", "尺寸", "이 사이즈 있나요?", "有這個尺寸嗎？"),
  entry("ko", "입어봐도 될까요", "ibeobwado doelkkayo", "v.", "may I try this on?", "可以試穿嗎？", "이거 입어봐도 될까요?", "這個可以試穿嗎？"),
  entry("ko", "봉투", "bongtu", "n.", "bag or envelope", "袋子", "봉투 하나 주세요.", "請給我一個袋子。"),

  // Transport
  entry("ko", "지하철", "jihacheol", "n.", "subway or metro", "地鐵", "지하철로 가요.", "搭地鐵去。"),
  entry("ko", "버스", "beoseu", "n.", "bus", "公車", "버스 정류장이 어디예요?", "公車站在哪裡？"),
  entry("ko", "택시", "taeksi", "n.", "taxi", "計程車", "택시를 불러 주세요.", "請幫我叫計程車。"),
  entry("ko", "표", "pyo", "n.", "ticket", "票", "표를 어디서 사요?", "在哪裡買票？"),
  entry("ko", "출구", "chulgu", "n.", "exit", "出口", "3번 출구로 나오세요.", "請從3號出口出來。"),
  entry("ko", "직진", "jikjin", "adv.", "go straight ahead", "直走", "계속 직진하세요.", "請繼續直走。"),
  entry("ko", "오른쪽", "oreunjjok", "n.", "right side", "右邊", "오른쪽으로 가세요.", "請往右走。"),
  entry("ko", "왼쪽", "oenjjok", "n.", "left side", "左邊", "왼쪽으로 도세요.", "請往左轉。"),
  entry("ko", "가깝다", "gakkapda", "adj.", "close or nearby", "近的", "역이 가까워요.", "車站很近。"),
  entry("ko", "멀다", "meolda", "adj.", "far away", "遠的", "여기서 멀어요?", "從這裡遠嗎？"),

  // Weather
  entry("ko", "날씨", "nalsi", "n.", "weather", "天氣", "날씨가 어때요?", "天氣如何？"),
  entry("ko", "맑다", "makda", "adj.", "clear and sunny", "晴朗的", "오늘은 맑아요.", "今天天氣晴朗。"),
  entry("ko", "비", "bi", "n.", "rain", "雨", "비가 와요.", "在下雨。"),
  entry("ko", "눈", "nun", "n.", "snow", "雪", "눈이 많이 와요.", "雪下得很大。"),
  entry("ko", "덥다", "deobda", "adj.", "hot in temperature", "熱的", "오늘 정말 더워요.", "今天真的很熱。"),
  entry("ko", "춥다", "chupda", "adj.", "cold in temperature", "冷的", "많이 춥네요.", "好冷啊。"),
  entry("ko", "바람", "baram", "n.", "wind", "風", "바람이 강해요.", "風很強。"),
  entry("ko", "흐리다", "heurida", "adj.", "cloudy or overcast", "陰天的", "하늘이 흐려요.", "天空是陰的。"),

  // Family & People
  entry("ko", "가족", "gajok", "n.", "family", "家人", "가족과 여행해요.", "我和家人旅行。"),
  entry("ko", "아버지", "abeoji", "n.", "father", "父親", "아버지는 선생님이에요.", "我父親是老師。"),
  entry("ko", "어머니", "eomeoni", "n.", "mother", "母親", "어머니가 요리를 잘해요.", "我母親很會做菜。"),
  entry("ko", "친구", "chingu", "n.", "friend", "朋友", "친구랑 영화 봤어요.", "我和朋友看了電影。"),

  // Work & Study
  entry("ko", "직장", "jikjang", "n.", "workplace or job", "職場；工作", "직장이 어디예요?", "你的工作在哪裡？"),
  entry("ko", "회사", "hoesa", "n.", "company", "公司", "어느 회사에서 일해요?", "你在哪家公司工作？"),
  entry("ko", "회의", "hoeui", "n.", "meeting", "會議", "오후에 회의가 있어요.", "下午有會議。"),
  entry("ko", "숙제", "sukje", "n.", "homework", "作業", "숙제를 다 했어요.", "我做完作業了。"),
  entry("ko", "시험", "siheom", "n.", "test or exam", "考試", "내일 시험이 있어요.", "明天有考試。"),

  // Health & Feelings
  entry("ko", "아프다", "apeuda", "adj.", "to be in pain; to feel sick", "痛；生病", "배가 아파요.", "我肚子痛。"),
  entry("ko", "피곤하다", "pigonhada", "adj.", "tired or exhausted", "疲倦的", "너무 피곤해요.", "我太累了。"),
  entry("ko", "기분이 좋다", "gibuni jota", "adj.", "to be in a good mood", "心情很好", "오늘 기분이 좋아요.", "今天心情很好。"),
  entry("ko", "행복하다", "haengbokhada", "adj.", "to be happy", "快樂的", "지금 행복해요.", "我現在很快樂。"),
  entry("ko", "걱정하다", "geokjeonghada", "v.", "to worry about", "擔心", "걱정하지 마세요.", "不用擔心。"),
  entry("ko", "약", "yak", "n.", "medicine", "藥", "약을 드세요.", "請服藥。"),
  entry("ko", "병원", "byeongwon", "n.", "hospital", "醫院", "병원에 가야 해요.", "需要去醫院。"),

  // ════════════════════════════════════════════════════════════════════
  // ITALIAN (Italiano) — 90 entries
  // ════════════════════════════════════════════════════════════════════

  // Greetings & Basics
  entry("it", "buongiorno", "/bwɔnˈdʒorno/", "interj.", "good morning or good day", "早安；你好（白天）", "Buongiorno! Come sta?", "早安！您好嗎？"),
  entry("it", "buonasera", "/bwɔnaˈseːra/", "interj.", "good evening", "晚安；晚上好", "Buonasera, benvenuto!", "晚上好，歡迎！"),
  entry("it", "grazie", "/ˈɡrattsje/", "interj.", "thank you", "謝謝", "Grazie mille!", "非常感謝！"),
  entry("it", "prego", "/ˈpreːɡo/", "interj.", "you're welcome; please", "不客氣；請", "Prego, si accomodi.", "請坐。"),
  entry("it", "scusi", "/ˈskuːzi/", "interj.", "excuse me (formal)", "對不起；不好意思", "Scusi, può ripetere?", "對不起，可以再說一次嗎？"),
  entry("it", "mi dispiace", "/mi disˈpjaːtʃe/", "interj.", "I am sorry", "對不起；很遺憾", "Mi dispiace molto.", "我非常抱歉。"),
  entry("it", "non capisco", "/non kaˈpisko/", "v.", "I don't understand", "我不明白", "Non capisco. Può spiegare?", "我不明白。可以解釋嗎？"),
  entry("it", "può ripetere", "/pwɔ riˈpeːtere/", "v.", "can you repeat?", "可以重複嗎？", "Può ripetere più lentamente?", "可以慢一點重複嗎？"),
  entry("it", "capito", "/kaˈpiːto/", "v.", "understood", "明白了", "Capito, grazie!", "明白了，謝謝！"),

  // Food & Restaurant
  entry("it", "colazione", "/kolatˈtsjoːne/", "n.", "breakfast", "早餐", "Faccio colazione alle sette.", "我七點吃早餐。"),
  entry("it", "pranzo", "/ˈprantso/", "n.", "lunch", "午餐", "Cosa prendete a pranzo?", "你們午餐吃什麼？"),
  entry("it", "cena", "/ˈtʃeːna/", "n.", "dinner or supper", "晚餐", "Andiamo a cena insieme.", "我們一起去吃晚餐。"),
  entry("it", "antipasto", "/antiˈpasto/", "n.", "starter or appetizer", "前菜", "Come antipasto vorrei la bruschetta.", "前菜我想要烤麵包片。"),
  entry("it", "primo", "/ˈpriːmo/", "n.", "first course (usually pasta)", "第一道菜（通常是麵食）", "Come primo prendo la pasta.", "第一道菜我選義大利麵。"),
  entry("it", "secondo", "/seˈkondo/", "n.", "second course (meat or fish)", "第二道菜（通常是肉或魚）", "Come secondo prendo il pesce.", "第二道菜我選魚。"),
  entry("it", "dolce", "/ˈdoltʃe/", "n.", "dessert or sweet", "甜點", "Vorrei un dolce.", "我想要一份甜點。"),
  entry("it", "vino rosso", "/ˈviːno ˈrɔsso/", "n.", "red wine", "紅酒", "Un bicchiere di vino rosso, per favore.", "請給我一杯紅酒。"),
  entry("it", "acqua naturale", "/ˈakkwa natuˈraːle/", "n.", "still water", "純水（無氣泡）", "Acqua naturale o frizzante?", "要純水還是氣泡水？"),
  entry("it", "assaggio", "/asˈsaddʒo/", "n.", "a taste or sample", "嚐一口；試吃", "Posso assaggiare?", "我可以試吃嗎？"),
  entry("it", "allergie", "/allerˈdʒiːe/", "n.", "allergies", "過敏", "Ho delle allergie alimentari.", "我有食物過敏。"),
  entry("it", "conto", "/ˈkonto/", "n.", "the bill", "帳單", "Il conto, per favore.", "請給我帳單。"),

  // Shopping
  entry("it", "quanto costa", "/ˈkwanto ˈkosta/", "pron.", "how much does it cost?", "多少錢？", "Quanto costa questa borsa?", "這個包包多少錢？"),
  entry("it", "economico", "/ekoˈnɔːmiko/", "adj.", "inexpensive or affordable", "便宜的；實惠的", "È molto economico.", "這個很實惠。"),
  entry("it", "caro", "/ˈkaːro/", "adj.", "expensive or dear", "貴的", "È troppo caro.", "太貴了。"),
  entry("it", "saldo", "/ˈsaldo/", "n.", "sale or discount", "折扣；特賣", "C'è un saldo?", "有打折嗎？"),
  entry("it", "taglia", "/ˈtaʎʎa/", "n.", "size (clothing)", "尺寸（衣物）", "Che taglia porta?", "您穿幾號？"),
  entry("it", "colore", "/koˈloːre/", "n.", "color", "顏色", "Ha altri colori?", "有其他顏色嗎？"),
  entry("it", "posso provarlo", "/ˈposso proˈvarlo/", "v.", "may I try it on?", "可以試穿嗎？", "Posso provarlo?", "我可以試穿嗎？"),
  entry("it", "carta di credito", "/ˈkarta di ˈkrɛːdito/", "n.", "credit card", "信用卡", "Posso pagare con carta di credito?", "我可以刷信用卡嗎？"),
  entry("it", "scontrino", "/skonˈtriːno/", "n.", "receipt", "收據", "Posso avere lo scontrino?", "可以給我收據嗎？"),
  entry("it", "busta", "/ˈbusta/", "n.", "bag or envelope", "袋子；信封", "Posso avere una busta?", "可以給我一個袋子嗎？"),

  // Transport
  entry("it", "aeroporto", "/aerɔˈpɔrto/", "n.", "airport", "機場", "Come arrivo all'aeroporto?", "我要怎麼到機場？"),
  entry("it", "biglietto", "/biʎˈʎetto/", "n.", "ticket", "票", "Dove compro il biglietto?", "在哪裡買票？"),
  entry("it", "fermata", "/ferˈmaːta/", "n.", "stop (bus or tram)", "站牌；站", "Qual è la prossima fermata?", "下一站是哪裡？"),
  entry("it", "metropolitana", "/metropoliˈtaːna/", "n.", "subway or metro", "地鐵", "Prendo la metropolitana.", "我搭地鐵。"),
  entry("it", "taxi", "/ˈtaksi/", "n.", "taxi", "計程車", "Chiami un taxi, per favore.", "請幫我叫計程車。"),
  entry("it", "vada dritto", "/ˈvaːda ˈdritto/", "v.", "go straight ahead", "直走", "Vada dritto per cento metri.", "直走一百公尺。"),
  entry("it", "giri a destra", "/ˈdʒiːri a ˈdestra/", "v.", "turn right", "右轉", "Al semaforo giri a destra.", "在紅綠燈右轉。"),
  entry("it", "giri a sinistra", "/ˈdʒiːri a siˈnistra/", "v.", "turn left", "左轉", "Giri a sinistra dopo il bar.", "在咖啡廳後左轉。"),
  entry("it", "vicino", "/viˈtʃiːno/", "adj.", "near or close", "近的", "È vicino da qui?", "從這裡近嗎？"),
  entry("it", "lontano", "/lonˈtaːno/", "adj.", "far away", "遠的", "Non è lontano.", "不遠。"),

  // Weather
  entry("it", "tempo", "/ˈtempo/", "n.", "weather or time", "天氣；時間", "Che tempo fa oggi?", "今天天氣怎麼樣？"),
  entry("it", "sole", "/ˈsoːle/", "n.", "sun or sunshine", "太陽；晴天", "C'è il sole oggi.", "今天有陽光。"),
  entry("it", "pioggia", "/ˈpjoddʒa/", "n.", "rain", "雨", "C'è tanta pioggia.", "雨下很大。"),
  entry("it", "neve", "/ˈneːve/", "n.", "snow", "雪", "Nevica molto qui in inverno.", "這裡冬天雪下得很多。"),
  entry("it", "caldo", "/ˈkaldo/", "adj.", "hot or warm", "熱的；暖的", "Fa molto caldo oggi.", "今天好熱。"),
  entry("it", "freddo", "/ˈfrɛddo/", "adj.", "cold", "冷的", "Fa freddo stasera.", "今晚很冷。"),
  entry("it", "nuvoloso", "/nuvoˈloːso/", "adj.", "cloudy", "陰天的", "Il cielo è nuvoloso.", "天空是陰的。"),
  entry("it", "vento", "/ˈvento/", "n.", "wind", "風", "C'è molto vento.", "風很大。"),

  // Family & Feelings
  entry("it", "famiglia", "/faˈmiʎʎa/", "n.", "family", "家庭", "La mia famiglia è grande.", "我的家庭很大。"),
  entry("it", "padre", "/ˈpaːdre/", "n.", "father", "父親", "Mio padre è medico.", "我父親是醫生。"),
  entry("it", "madre", "/ˈmaːdre/", "n.", "mother", "母親", "Mia madre cucina benissimo.", "我母親廚藝很好。"),
  entry("it", "amico", "/aˈmiːko/", "n.", "friend (male)", "朋友（男）", "Il mio amico abita qui.", "我的朋友住在這裡。"),
  entry("it", "amica", "/aˈmiːka/", "n.", "friend (female)", "朋友（女）", "La mia amica lavora qui.", "我的朋友在這裡工作。"),
  entry("it", "contento", "/konˈtento/", "adj.", "happy or pleased", "高興的；滿意的", "Sono molto contento.", "我非常高興。"),
  entry("it", "stanco", "/ˈstaŋko/", "adj.", "tired", "疲倦的", "Sono stanco dopo il lavoro.", "工作後我很累。"),
  entry("it", "preoccupato", "/preɔkkuˈpaːto/", "adj.", "worried or anxious", "擔心的", "Sono preoccupato.", "我很擔心。"),

  // Work & Health
  entry("it", "lavoro", "/laˈvoːro/", "n.", "work or job", "工作", "Che lavoro fa?", "您做什麼工作？"),
  entry("it", "ufficio", "/ufˈfitʃo/", "n.", "office", "辦公室", "Lavoro in ufficio.", "我在辦公室工作。"),
  entry("it", "riunione", "/rjuˈnjoːne/", "n.", "meeting", "會議", "Ho una riunione oggi.", "我今天有會議。"),
  entry("it", "ospedale", "/ospeˈdaːle/", "n.", "hospital", "醫院", "Devo andare all'ospedale.", "我需要去醫院。"),
  entry("it", "medico", "/ˈmɛːdiko/", "n.", "doctor", "醫生", "Ho bisogno di un medico.", "我需要看醫生。"),
  entry("it", "farmacia", "/farˈmatʃa/", "n.", "pharmacy", "藥局", "Dov'è la farmacia più vicina?", "最近的藥局在哪裡？"),
  entry("it", "medicina", "/mediˈtʃiːna/", "n.", "medicine", "藥", "Prenda questa medicina.", "請服這個藥。"),
  entry("it", "dolore", "/doˈloːre/", "n.", "pain or ache", "疼痛", "Ho dolore alla testa.", "我頭痛。"),
  entry("it", "febbre", "/ˈfɛbbre/", "n.", "fever", "發燒", "Ho la febbre.", "我發燒了。"),

  // ════════════════════════════════════════════════════════════════════
  // SPANISH (Español) — 90 entries
  // ════════════════════════════════════════════════════════════════════

  // Greetings & Basics
  entry("es", "buenos días", "/ˈbwenos ˈdi.as/", "interj.", "good morning", "早安", "¡Buenos días! ¿Cómo está usted?", "早安！您好嗎？"),
  entry("es", "buenas tardes", "/ˈbwenas ˈtaɾ.ðes/", "interj.", "good afternoon", "午安", "Buenas tardes. Bienvenido.", "午安，歡迎。"),
  entry("es", "buenas noches", "/ˈbwenas ˈno.tʃes/", "interj.", "good night or good evening", "晚安", "Buenas noches. Hasta mañana.", "晚安，明天見。"),
  entry("es", "gracias", "/ˈɡɾa.θjas/", "interj.", "thank you", "謝謝", "Muchas gracias por su ayuda.", "非常感謝您的幫助。"),
  entry("es", "de nada", "/de ˈna.ða/", "interj.", "you're welcome", "不客氣", "¡De nada! Con gusto.", "不客氣，很樂意。"),
  entry("es", "lo siento", "/lo ˈsjen.to/", "interj.", "I am sorry", "對不起", "Lo siento mucho.", "我非常抱歉。"),
  entry("es", "no entiendo", "/no enˈtjen.do/", "v.", "I don't understand", "我不明白", "No entiendo. ¿Puede explicar?", "我不明白，可以解釋嗎？"),
  entry("es", "¿puede repetir?", "/ˈpwe.ðe repe.ˈtiɾ/", "v.", "can you repeat?", "可以重複嗎？", "¿Puede repetir más despacio?", "可以慢慢重複嗎？"),
  entry("es", "claro", "/ˈkla.ɾo/", "adv.", "of course; clear", "當然；清楚", "Claro que sí.", "當然可以。"),
  entry("es", "por supuesto", "/poɾ suˈpwes.to/", "adv.", "of course; certainly", "當然", "Por supuesto, con mucho gusto.", "當然，非常樂意。"),

  // Food & Restaurant
  entry("es", "desayuno", "/de.saˈʝu.no/", "n.", "breakfast", "早餐", "¿A qué hora sirven el desayuno?", "幾點供應早餐？"),
  entry("es", "almuerzo", "/alˈmweɾ.θo/", "n.", "lunch", "午餐", "¿Qué hay de almuerzo hoy?", "今天午餐有什麼？"),
  entry("es", "cena", "/ˈθe.na/", "n.", "dinner", "晚餐", "¿Cenamos juntos esta noche?", "今晚我們一起吃晚餐嗎？"),
  entry("es", "rico", "/ˈri.ko/", "adj.", "delicious or tasty", "好吃的", "¡Está muy rico!", "真的很好吃！"),
  entry("es", "picante", "/piˈkan.te/", "adj.", "spicy or hot", "辣的", "¿Es muy picante?", "很辣嗎？"),
  entry("es", "dulce", "/ˈdul.θe/", "adj.", "sweet in taste", "甜的", "Este postre está muy dulce.", "這個甜點很甜。"),
  entry("es", "tapas", "/ˈta.pas/", "n.", "small Spanish snack dishes", "西班牙小點心", "Pedimos varias tapas.", "我們點了幾道小點心。"),
  entry("es", "paella", "/paˈe.ʝa/", "n.", "Spanish rice dish", "西班牙燉飯", "La paella es deliciosa.", "西班牙燉飯很好吃。"),
  entry("es", "tortilla", "/toɾˈti.ʝa/", "n.", "egg omelette (Spain) or flatbread (Mexico)", "蛋餅（西班牙）", "Una tortilla española, por favor.", "請給我一份西班牙蛋餅。"),
  entry("es", "vino tinto", "/ˈbi.no ˈtin.to/", "n.", "red wine", "紅酒", "Una copa de vino tinto, por favor.", "請給我一杯紅酒。"),
  entry("es", "la cuenta", "/la ˈkwen.ta/", "n.", "the bill", "帳單", "La cuenta, por favor.", "請給我帳單。"),
  entry("es", "para llevar", "/ˈpa.ɾa ʝeˈβaɾ/", "v.", "to go or takeout", "外帶", "¿Es para aquí o para llevar?", "內用還是外帶？"),

  // Shopping
  entry("es", "¿cuánto vale?", "/ˈkwan.to ˈβa.le/", "pron.", "how much is it?", "多少錢？", "¿Cuánto vale este vestido?", "這件洋裝多少錢？"),
  entry("es", "barato", "/baˈɾa.to/", "adj.", "cheap or inexpensive", "便宜的", "Qué barato. Lo compro.", "好便宜，我買了。"),
  entry("es", "caro", "/ˈka.ɾo/", "adj.", "expensive", "貴的", "Es demasiado caro.", "太貴了。"),
  entry("es", "oferta", "/oˈfeɾ.ta/", "n.", "offer or sale", "特價；優惠", "¿Hay alguna oferta?", "有優惠嗎？"),
  entry("es", "talla", "/ˈta.ʝa/", "n.", "clothing size", "尺寸（衣物）", "¿Tienen esta talla?", "有這個尺寸嗎？"),
  entry("es", "color", "/koˈloɾ/", "n.", "color", "顏色", "¿Tienen otro color?", "有其他顏色嗎？"),
  entry("es", "probador", "/proˈβa.ðoɾ/", "n.", "fitting room", "試衣間", "¿Dónde está el probador?", "試衣間在哪裡？"),
  entry("es", "tarjeta de crédito", "/taɾˈxe.ta ðe ˈkɾe.ði.to/", "n.", "credit card", "信用卡", "¿Aceptan tarjeta de crédito?", "接受信用卡嗎？"),
  entry("es", "recibo", "/reˈθi.βo/", "n.", "receipt", "收據", "¿Me da el recibo?", "可以給我收據嗎？"),
  entry("es", "bolsa", "/ˈbol.sa/", "n.", "bag", "袋子", "¿Me da una bolsa?", "可以給我一個袋子嗎？"),

  // Transport
  entry("es", "aeropuerto", "/ae.ɾoˈpweɾ.to/", "n.", "airport", "機場", "¿Cómo llego al aeropuerto?", "我要怎麼去機場？"),
  entry("es", "billete", "/biˈʎe.te/", "n.", "ticket", "票", "¿Dónde compro el billete?", "在哪裡買票？"),
  entry("es", "parada", "/paˈɾa.ða/", "n.", "stop (bus or metro)", "站；站牌", "¿Cuál es la próxima parada?", "下一站是哪裡？"),
  entry("es", "metro", "/ˈme.tɾo/", "n.", "subway or metro", "地鐵", "Voy en metro.", "我搭地鐵去。"),
  entry("es", "siga recto", "/ˈsi.ɣa ˈrek.to/", "v.", "go straight", "直走", "Siga recto dos cuadras.", "直走兩個街區。"),
  entry("es", "gire a la derecha", "/ˈxi.ɾe a la deˈɾe.tʃa/", "v.", "turn right", "右轉", "Gire a la derecha en el semáforo.", "在紅綠燈右轉。"),
  entry("es", "gire a la izquierda", "/ˈxi.ɾe a la iθˈkjeɾ.ða/", "v.", "turn left", "左轉", "Gire a la izquierda.", "請左轉。"),
  entry("es", "está lejos", "/esˈta ˈle.xos/", "adj.", "it is far", "很遠", "¿Está lejos de aquí?", "離這裡遠嗎？"),
  entry("es", "está cerca", "/esˈta ˈθeɾ.ka/", "adj.", "it is near", "很近", "La estación está cerca.", "車站很近。"),
  entry("es", "transbordo", "/tɾansˈboɾ.ðo/", "n.", "transfer between lines", "換乘；轉乘", "¿Dónde hago transbordo?", "在哪裡換乘？"),

  // Weather
  entry("es", "tiempo", "/ˈtjem.po/", "n.", "weather or time", "天氣；時間", "¿Qué tiempo hace hoy?", "今天天氣怎樣？"),
  entry("es", "sol", "/sol/", "n.", "sun or sunshine", "太陽；陽光", "Hace mucho sol hoy.", "今天陽光很強。"),
  entry("es", "lluvia", "/ˈʎu.βja/", "n.", "rain", "雨", "Va a llover.", "快要下雨了。"),
  entry("es", "nieve", "/ˈnje.βe/", "n.", "snow", "雪", "Está nevando mucho.", "雪下得很大。"),
  entry("es", "calor", "/kaˈloɾ/", "n.", "heat or warmth", "熱；暖", "Hace mucho calor.", "好熱。"),
  entry("es", "frío", "/ˈfɾi.o/", "n.", "cold", "冷", "Hace mucho frío hoy.", "今天好冷。"),
  entry("es", "nublado", "/nuˈβla.ðo/", "adj.", "cloudy", "陰天的", "El cielo está nublado.", "天空是陰的。"),
  entry("es", "viento", "/ˈβjen.to/", "n.", "wind", "風", "Hay mucho viento.", "風很大。"),

  // Family & Feelings
  entry("es", "familia", "/faˈmi.lja/", "n.", "family", "家庭", "Mi familia es muy unida.", "我的家庭很團結。"),
  entry("es", "padre", "/ˈpa.ðɾe/", "n.", "father", "父親", "Mi padre trabaja mucho.", "我父親工作很努力。"),
  entry("es", "madre", "/ˈma.ðɾe/", "n.", "mother", "母親", "Mi madre cocina muy bien.", "我母親廚藝很好。"),
  entry("es", "amigo", "/aˈmi.ɣo/", "n.", "friend (male)", "朋友（男）", "Mi amigo vive aquí.", "我的朋友住在這裡。"),
  entry("es", "amiga", "/aˈmi.ɣa/", "n.", "friend (female)", "朋友（女）", "Mi amiga trabaja aquí.", "我的朋友在這裡工作。"),
  entry("es", "contento", "/konˈten.to/", "adj.", "happy or pleased", "高興的", "Estoy muy contento.", "我非常高興。"),
  entry("es", "cansado", "/kanˈsa.ðo/", "adj.", "tired", "疲倦的", "Estoy cansado después del trabajo.", "工作後我很累。"),
  entry("es", "preocupado", "/pre.okuˈpa.ðo/", "adj.", "worried", "擔心的", "Estoy preocupado.", "我很擔心。"),
  entry("es", "nervioso", "/neɾˈβjo.so/", "adj.", "nervous or anxious", "緊張的", "Estoy nervioso antes del examen.", "考試前我很緊張。"),

  // Work & Health
  entry("es", "trabajo", "/tɾaˈβa.xo/", "n.", "work or job", "工作", "¿En qué trabaja usted?", "您從事什麼工作？"),
  entry("es", "empresa", "/emˈpɾe.sa/", "n.", "company or firm", "公司", "Trabajo en una empresa grande.", "我在一家大公司工作。"),
  entry("es", "reunión", "/re.uˈnjon/", "n.", "meeting", "會議", "Tengo una reunión esta tarde.", "我今天下午有會議。"),
  entry("es", "hospital", "/os.piˈtal/", "n.", "hospital", "醫院", "Necesito ir al hospital.", "我需要去醫院。"),
  entry("es", "médico", "/ˈme.ði.ko/", "n.", "doctor", "醫生", "Necesito ver a un médico.", "我需要看醫生。"),
  entry("es", "farmacia", "/faɾˈma.θja/", "n.", "pharmacy", "藥局", "¿Dónde hay una farmacia?", "哪裡有藥局？"),
  entry("es", "medicina", "/me.ðiˈθi.na/", "n.", "medicine", "藥", "Tome esta medicina.", "請服這個藥。"),
  entry("es", "dolor", "/doˈloɾ/", "n.", "pain or ache", "疼痛", "Tengo dolor de cabeza.", "我頭痛。"),
  entry("es", "fiebre", "/ˈfje.βɾe/", "n.", "fever", "發燒", "Tengo fiebre.", "我發燒了。"),
  entry("es", "seguro médico", "/seˈɣu.ɾo ˈme.ði.ko/", "n.", "health insurance", "醫療保險", "¿Tiene seguro médico?", "您有醫療保險嗎？"),
];
