export type Bucket = "推进池" | "跟进中" | "观察池" | "淘汰池";
export type Stage = "new" | "watch" | "active" | "negotiating" | "won" | "rejected";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type RegionPriority = "国内优先" | "海外-高视觉" | "海外-强数据" | "其他";
export type Region = "中国" | "海外";
export type ReviewStatus = "未处理" | "已查看" | "跟进中" | "已淘汰";
export type ContactType = "微信/QQ" | "Email" | "电话" | "官网" | "Steam" | "Discord" | "B站" | "X/Twitter" | "其他";

export type ContactMethod = {
  type: ContactType;
  value: string;
  note?: string | null;
};

export type Lead = {
  id: string;
  project: string;
  steam_app_id: string | null;
  team: string | null;
  team_size: string | null;
  country: string;
  region: Region;
  city: string | null;
  region_priority: RegionPriority;
  bucket: Bucket;
  stage: Stage;
  priority: Priority;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  priority_reason: string | null;
  rule_fit: string | null;
  genre: string | null;
  gameplay: string | null;
  progress: string;
  release_window: string | null;
  early_access: boolean;
  narrative_heavy: boolean;
  india_team: boolean;
  publisher_status: string;
  publisher_name: string | null;
  china_capability_occupied: boolean;
  traction_summary: string | null;
  public_signals: string | null;
  contact: string | null;
  contact_methods: ContactMethod[];
  links: string[];
  exposure_trail: string | null;
  bilibili_fit: string;
  amplification: string;
  risks: string | null;
  verdict: string;
  next_action: string | null;
  owner: string | null;
  due_date: string | null;
  first_seen: string;
  notes: string | null;
};

export type ImportResult = {
  created: number;
  updated: number;
  dropped: number;
  total: number;
  report_date?: string;
  summary?: string;
};

export type RadarCategory = "行业新闻" | "发行八卦" | "AI 游戏" | "新梗热点" | "B站趋势";

export type RadarItem = {
  id: string;
  category: RadarCategory;
  title: string;
  summary: string;
  heat: "高" | "中" | "低";
  source: string;
  link: string;
  relevance: string;
  suggested_action: string;
  captured_at: string;
};

export type RadarReport = {
  report_date: string;
  summary: string;
  items: RadarItem[];
};
