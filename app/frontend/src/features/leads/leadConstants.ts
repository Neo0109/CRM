import type { Bucket, ContactType, EvaluationGrade, Priority, Region, RegionPriority, Stage } from "../../types";

export const bucketOptions: ("全部" | Bucket)[] = ["全部", "未处理", "待评测", "测试中", "观察池", "跟进中", "推进池", "淘汰池"];
export const bucketValues: Bucket[] = ["未处理", "待评测", "测试中", "观察池", "跟进中", "推进池", "淘汰池"];
export const stageOptions: ("全部" | Stage)[] = ["全部", "new", "watch", "active", "negotiating", "won", "rejected"];
export const stageValues: Stage[] = ["new", "watch", "active", "negotiating", "won", "rejected"];
export const stageLabels: Record<Stage, string> = {
  new: "New",
  watch: "Watch",
  active: "Active",
  negotiating: "Negotiating",
  won: "Won",
  rejected: "Rejected"
};
export const priorityValues: Priority[] = ["P0", "P1", "P2", "P3"];
export const evaluationGradeOptions: ("未评级" | EvaluationGrade)[] = ["未评级", "S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];
export const regionValues: Region[] = ["中国", "海外"];
export const regionOptions: ("全部" | Region)[] = ["全部", ...regionValues];
export const regionPriorityValues: RegionPriority[] = ["国内优先", "海外-高视觉", "海外-强数据", "其他"];
export const contactTypes: ContactType[] = ["微信/QQ", "Email", "电话", "官网", "Steam", "Discord", "B站", "X/Twitter", "其他"];
export const dropReasonOptions = ["未选择", "已上线", "已有中国合作伙伴", "画面不符合中国", "画面差", "玩法粗糙", "题材/合规风险", "商业化空间弱", "B站适配弱", "数据/热度不足", "团队/发行结构不清晰", "重复项目", "联系不到/缺触达", "窗口不合适", "其他"] as const;

export function stageLabel(stage: "全部" | Stage) {
  if (stage === "全部") return "全部";
  return stageLabels[stage];
}

export function bucketClass(bucket: Bucket) {
  if (bucket === "未处理") return "unread";
  if (bucket === "推进池") return "push";
  if (bucket === "待评测") return "evaluate";
  if (bucket === "测试中") return "testing";
  if (bucket === "跟进中") return "follow";
  if (bucket === "淘汰池") return "drop";
  return "watch";
}

export function priorityTone(priority: Priority) {
  if (priority === "P0" || priority === "P1") return "high";
  if (priority === "P2") return "medium";
  return "low";
}

export function priorityLabel(priority: Priority) {
  if (priority === "P0" || priority === "P1") return `${priority} 高`;
  if (priority === "P2") return `${priority} 中`;
  return `${priority} 低`;
}
