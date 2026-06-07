export type Bucket = "未处理" | "推进池" | "待评测" | "测试中" | "跟进中" | "观察池" | "淘汰池";
export type Stage = "new" | "watch" | "active" | "negotiating" | "won" | "rejected";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type RegionPriority = "国内优先" | "海外-高视觉" | "海外-强数据" | "其他";
export type Region = "中国" | "海外";
export type ReviewStatus = "未处理" | "已查看" | "跟进中" | "已淘汰";
export type ContactType = "微信/QQ" | "Email" | "电话" | "官网" | "Steam" | "Discord" | "B站" | "X/Twitter" | "其他";
export type EvaluationGrade = "S" | "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-";

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
  evaluation_grade: EvaluationGrade | null;
  evaluation_result: string | null;
  evaluated_at: string | null;
  next_action: string | null;
  owner: string | null;
  due_date: string | null;
  calendar_enabled: boolean;
  follow_up_interval: string | null;
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

export type LeadAssistantAttachment = {
  name?: string;
  type?: string;
  size?: number;
  source?: "paste" | "upload" | "camera";
  data_url?: string;
};

export type LeadAssistantPayload = {
  text?: string;
  keywords?: string[];
  attachments?: LeadAssistantAttachment[];
};

export type LeadAssistantResult = ImportResult & {
  message: string;
  skipped: string[];
  leads: Partial<Lead>[];
};

export type CrmSettings = {
  bound_email: string | null;
  has_excel_export_password: boolean;
  has_login_password: boolean;
  updated_at: string | null;
};

export type SettingsPatch = {
  bound_email?: string | null;
  excel_export_password?: string | null;
  login_password?: string | null;
  verification_code?: string | null;
};

export type SettingsVerification = {
  email: string;
  sent: boolean;
  delivery: "sent" | "not_configured";
  expires_at: string | null;
};

export type RadarCategory = "行业新闻" | "发行八卦" | "AI 游戏" | "新梗热点" | "B站趋势";

export type RadarItem = {
  id: string;
  category: RadarCategory | string;
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
  available_dates?: string[];
  is_fallback?: boolean;
  report_date: string;
  requested_date?: string;
  summary: string;
  items: RadarItem[];
  source?: string;
};

export type SteamTrendItem = {
  id: string;
  title: string;
  steam_app_id: string | null;
  rank_bucket: string | null;
  signal: string;
  source: string;
  links: string[];
  bilibili_fit: string;
  reason: string | null;
  auto_import: boolean;
  captured_at: string;
};

export type SteamMarketInsight = {
  id: string;
  title: string;
  summary: string;
  signal_level: "高" | "中" | "低";
  source: string;
  link: string;
  suggested_action: string;
  captured_at: string;
};

export type SteamGenreSignal = {
  id: string;
  genre: string;
  signal: string;
  why_it_matters: string;
  bd_action: string;
  links: string[];
};

export type SteamTrendReport = {
  available_dates?: string[];
  report_date: string;
  requested_date?: string;
  summary: string;
  is_fallback?: boolean;
  market_insights?: SteamMarketInsight[];
  genre_signals?: SteamGenreSignal[];
  items: SteamTrendItem[];
  crm_candidates?: Partial<Lead>[];
  sync_result?: ImportResult | null;
  source?: string;
};

export type WeeklyLeadSummary = {
  id: string;
  project: string;
  bucket: Bucket;
  priority: Priority;
  review_status: ReviewStatus;
  region: Region;
  country: string;
  city: string | null;
  team: string | null;
  genre: string | null;
  gameplay: string | null;
  progress: string;
  release_window: string | null;
  publisher_status: string;
  bilibili_fit: string;
  priority_reason: string | null;
  rule_fit: string | null;
  verdict: string;
  evaluation_grade: EvaluationGrade | null;
  evaluation_result: string | null;
  evaluated_at: string | null;
  first_seen: string;
  reviewed_at: string | null;
  steam_store_url: string | null;
  steamdb_url: string | null;
  links: string[];
  basic_summary: string;
  recommendation_summary: string;
  follow_summary: string;
};

export type WeeklyReport = {
  week_start: string;
  week_end: string;
  generated_at: string;
  source: "crm_leads";
  method: string;
  summary: string;
  stats: {
    sourced: number;
    submitted_for_test: number;
    test_queue: number;
    testing_pool: number;
    entered_follow_up: number;
    active_following: number;
    push_pool: number;
    follow_pool: number;
    watch_pool: number;
    dropped: number;
    pending_review: number;
    missing_steam_links: number;
  };
  follow_up_leads: WeeklyLeadSummary[];
  dropped_leads: WeeklyLeadSummary[];
  sourced_leads: WeeklyLeadSummary[];
};

export type AutomationDiagnosticsStatus = "healthy" | "warning" | "failed" | "missing";
export type AutomationBusinessAcceptanceStatus = "pass" | "needs_attention" | "fail";
export type AutomationBusinessMetricStatus = "pass" | "warn" | "fail" | "unknown";
export type AutomationBusinessRootCauseCategory = "files" | "sync" | "source_pool" | "filter_pressure" | "import_quality" | "content_board";
export type AutomationBusinessRootCauseSeverity = "critical" | "warning" | "info";

export type AutomationFileHealth = {
  exists: boolean;
  path: string;
  source: string;
  status?: number;
};

export type AutomationReceiptSummary = {
  attempts: number | null;
  captured_at: string | null;
  event_name: string | null;
  event_schedule: string | null;
  generated_changed: boolean | null;
  name: string;
  report_date: string | null;
  run_number: string | null;
  run_url: string | null;
  slot: string | null;
  status: string;
  sync: {
    synced?: boolean;
    created?: number;
    updated?: number;
    dropped?: number;
    total?: number;
    import_stats?: Record<string, unknown>;
    report_date?: string;
    summary?: string;
    source?: string;
    reason?: string;
  } | null;
};

export type AutomationBusinessAcceptance = {
  status: AutomationBusinessAcceptanceStatus;
  verdict: string;
  primary_issue: string | null;
  metrics: {
    key: string;
    label: string;
    status: AutomationBusinessMetricStatus;
    actual: number | string | null;
    expected: string;
    detail: string;
  }[];
  root_causes: {
    category: AutomationBusinessRootCauseCategory;
    severity: AutomationBusinessRootCauseSeverity;
    title: string;
    evidence: string;
    action: string;
  }[];
  recommended_actions: string[];
};

export type AutomationDiagnostics = {
  available_dates: string[];
  business_acceptance?: AutomationBusinessAcceptance;
  counts: {
    drop_candidates: number;
    final_candidates: number;
    push_candidates: number;
    radar_categories: Record<string, number>;
    radar_items: number;
    review_candidates: number;
    steam_crm_candidates: number;
    steam_genre_signals: number;
    steam_items: number;
    steam_market_insights: number;
    watch_candidates: number;
  };
  files: {
    report: AutomationFileHealth;
    radar: AutomationFileHealth;
    steam_trends: AutomationFileHealth;
  };
  generated_at: string;
  import_stats: Record<string, unknown> | null;
  latest_receipt: AutomationReceiptSummary | null;
  latest_synced_receipt: AutomationReceiptSummary | null;
  next_actions: string[];
  receipts: AutomationReceiptSummary[];
  report_date: string;
  requested_date: string;
  rule_version: string | null;
  source_breakdown: {
    final_candidates: number | null;
    media_bilibili_leads: number | null;
    official_source_hits: number | null;
    raw_summary: string | null;
    steam_enriched: number | null;
    steam_scanned: number | null;
  };
  status: AutomationDiagnosticsStatus;
  summary: string;
  thresholds: {
    min_review_candidates: number;
    min_media_bilibili_candidates: number;
    min_radar_items: number;
    min_steam_market_insights: number;
    min_steam_genre_signals: number;
  };
  warnings: string[];
};
