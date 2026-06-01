const philosophyQuotes = [
  { author: "苏格拉底", text: "未经审视的人生不值得过。" },
  { author: "柏拉图", text: "知识是灵魂对真理的回忆。" },
  { author: "亚里士多德", text: "卓越不是一次行动，而是一种习惯。" },
  { author: "孔子", text: "知之者不如好之者，好之者不如乐之者。" },
  { author: "老子", text: "知人者智，自知者明。" },
  { author: "庄子", text: "天地与我并生，万物与我为一。" },
  { author: "王阳明", text: "知是行之始，行是知之成。" },
  { author: "笛卡尔", text: "我思，故我在。" },
  { author: "斯宾诺莎", text: "不要哭，不要笑，要理解。" },
  { author: "康德", text: "有两样东西使我敬畏：星空与道德律。" },
  { author: "尼采", text: "成为你自己。" },
  { author: "维特根斯坦", text: "语言的界限，就是世界的界限。" },
  { author: "孟子", text: "尽信书，则不如无书。" },
  { author: "荀子", text: "不积跬步，无以至千里。" },
  { author: "叔本华", text: "人能做他所意愿的，却不能要他所意愿的。" },
  { author: "汉娜·阿伦特", text: "思考使人远离平庸的恶。" }
];

function shanghaiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).format(date);
}

function shanghaiHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date));
}

function dayIndex(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getDailyPhilosophyQuote(date = new Date()) {
  const hour = shanghaiHour(date);
  const dayPart = hour < 12 ? 0 : hour < 18 ? 1 : 2;
  const quote = philosophyQuotes[(dayIndex(shanghaiDateKey(date)) * 3 + dayPart) % philosophyQuotes.length];
  return `${quote.text} -- ${quote.author}`;
}
