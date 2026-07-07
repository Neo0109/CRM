import type { Lead } from "../../types";
import { gameLinks, visibleContacts } from "./leadLinks";

export type LeadReviewChecklistItem = {
  key:
    | "missing-game-link"
    | "missing-contact"
    | "publisher-review"
    | "missing-owner"
    | "missing-next-action"
    | "missing-due-date"
    | "ready";
  label: string;
  detail: string;
};

export function buildLeadReviewChecklist(lead: Lead): LeadReviewChecklistItem[] {
  const items: LeadReviewChecklistItem[] = [];
  const hasGameLink = Boolean(lead.steam_app_id?.trim()) || gameLinks(lead.links).length > 0;
  const hasContact = Boolean(lead.contact?.trim()) || visibleContacts(lead.contact_methods).some((method) => method.value.trim());

  if (!hasGameLink) {
    items.push({
      key: "missing-game-link",
      label: "补 Steam/官网主体链接",
      detail: "先补 Steam、SteamDB 或官网主体链接，便于去重和验证游戏主体。"
    });
  }

  if (!hasContact) {
    items.push({
      key: "missing-contact",
      label: "补可触达联系方式",
      detail: "补 Email、微信/QQ、Discord、官网联系页或 Steam 社区入口。"
    });
  }

  if (/待确认发行结构|待人工复核|待确认/i.test(lead.publisher_status)) {
    items.push({
      key: "publisher-review",
      label: "复核发行结构",
      detail: "确认自研自发、已有发行商或中国发行能力是否已被占用。"
    });
  }

  if (!lead.owner?.trim()) {
    items.push({
      key: "missing-owner",
      label: "设置 Owner",
      detail: "明确这条线索由谁继续判断，避免助手导入后悬空。"
    });
  }

  if (!lead.next_action?.trim()) {
    items.push({
      key: "missing-next-action",
      label: "补下一步动作",
      detail: "写清楚补链、评测、联系或观察的下一步。"
    });
  }

  if (!lead.due_date?.trim()) {
    items.push({
      key: "missing-due-date",
      label: "设置 Due Date",
      detail: "给下一次复核或联系留一个日期，避免漏跟进。"
    });
  }

  return items.length ? items : [{
    key: "ready",
    label: "可进入常规优先级复核",
    detail: "基础链接、联系方式和跟进字段相对完整，重点判断优先级和是否推进。"
  }];
}
