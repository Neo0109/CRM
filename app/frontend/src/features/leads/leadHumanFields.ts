const automationPlaceholderPatterns = [
  /^V\d+判断[:：]/i,
  /^导入日报\s+\d{4}-\d{2}-\d{2}[:：]/,
  /Sourcing\s*V\d/i,
  /前置信号\s*\+\s*(国内优先|海外PC验证|系统型玩法)/,
  /先进入未处理\s*inbox/i,
  /国内\/中文语境信号仍有首轮判断价值/,
  /人工\s*review\s*后决定提测、观察或淘汰/i,
  /先提测验证再决定商务深聊/,
  /推荐优先.*普通.*淘汰.*人工\s*review/i,
  /归档原因，避免重复讨论/,
  /先安排实机\/运营测试/
];

export function cleanHumanLeadText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  return automationPlaceholderPatterns.some((pattern) => pattern.test(text)) ? null : text;
}
