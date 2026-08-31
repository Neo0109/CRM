import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, {
    ...options,
    accept: options.accept ?? "application/json,text/html;q=0.9,*/*;q=0.8"
  });
  try {
    return JSON.parse(text);
  } catch (error) {
    throw parseMismatchError(`JSON response structure mismatch: ${error.message}`);
  }
}

export async function fetchText(url, options = {}) {
  const {
    timeoutMs = 12000,
    accept,
    fetchImpl = globalThis.fetch,
    execFileImpl = defaultExecFile,
    logger = console
  } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = defaultHeaders(accept);
    if (/\.bilibili\.com/i.test(url)) {
      headers.Referer = "https://search.bilibili.com/";
      headers.Origin = "https://search.bilibili.com";
    }
    const response = await fetchImpl(url, { signal: controller.signal, headers });
    const text = typeof response?.text === "function" ? await response.text() : "";
    const classification = classifyHttpResponse(response, text);
    if (classification.outcome !== "ok") {
      const error = response?.ok
        ? new Error(classification.outcome === "challenge" ? "Cloudflare challenge response" : "HTTP response rejected")
        : httpStatusError(response);
      error.name = classification.outcome === "challenge" ? "SourceChallengeError" : error.name;
      error.sourceOutcome = classification.outcome;
      error.provider = classification.provider;
      if (Number.isFinite(Number(response?.status))) error.status = Number(response.status);
      throw error;
    }
    return text;
  } catch (error) {
    if (isSteamUrl(url) && shouldUseCurlFallback(error)) {
      logger.warn?.(`Steam Node fetch failed for ${new URL(url).host}: ${describeNetworkError(error)}; retrying with curl fallback`);
      return await fetchTextWithCurl(url, { timeoutMs, accept, execFileImpl });
    }
    if (!error.sourceOutcome) error.sourceOutcome = classifySourceError(error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function httpStatusError(response, nowMs = Date.now()) {
  const status = Number(response?.status);
  const statusText = String(response?.statusText ?? "").trim();
  const message = [Number.isFinite(status) ? status : null, statusText].filter(Boolean).join(" ") || "HTTP request failed";
  const error = new Error(message);
  error.name = "HttpStatusError";
  if (Number.isFinite(status)) error.status = status;
  error.sourceOutcome = sourceOutcomeForHttpStatus(status);
  error.provider = providerForResponse(response);
  const retryAfterMs = parseRetryAfter(response?.headers?.get?.("retry-after"), nowMs);
  if (retryAfterMs !== null) error.retryAfterMs = retryAfterMs;
  return error;
}

export function parseRetryAfter(value, nowMs = Date.now()) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Number(nowMs)) : null;
}

export function defaultHeaders(accept) {
  return { "User-Agent": "Mozilla/5.0 SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)", Accept: accept ?? "*/*" };
}

export function isSteamUrl(url) {
  try {
    const host = new URL(url).host;
    return /(^|\.)steampowered\.com$/i.test(host);
  } catch {
    return false;
  }
}

export function describeNetworkError(error) {
  return [error.name, error.message, error.cause?.code, error.cause?.message].filter(Boolean).join(" / ");
}

export function shouldUseCurlFallback(error) {
  if (error?.sourceOutcome && error.sourceOutcome !== "network_error") return false;
  if (/^(402|403|412|429)\b/.test(error.message)) return false;
  return /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|aborted|timeout/i.test(describeNetworkError(error));
}

export async function fetchTextWithCurl(url, options = {}) {
  const {
    timeoutMs = 12000,
    accept,
    execFileImpl = defaultExecFile
  } = options;
  const headers = defaultHeaders(accept);
  const maxSeconds = String(Math.max(8, Math.ceil(timeoutMs / 1000)));
  try {
    const { stdout } = await execFileImpl("curl", [
      "--location",
      "--silent",
      "--show-error",
      "--fail",
      "--retry",
      "2",
      "--retry-delay",
      "1",
      "--connect-timeout",
      "8",
      "--max-time",
      maxSeconds,
      "--user-agent",
      headers["User-Agent"],
      "--header",
      `Accept: ${headers.Accept}`,
      url
    ], { maxBuffer: 8 * 1024 * 1024 });
    if (isCloudflareChallengeResponse(null, stdout)) {
      const error = new Error("Cloudflare challenge response from curl fallback");
      error.name = "SourceChallengeError";
      error.sourceOutcome = "challenge";
      error.provider = "cloudflare";
      throw error;
    }
    return stdout;
  } catch (error) {
    if (error?.sourceOutcome) throw error;
    const stderr = String(error.stderr ?? "").trim();
    const detail = stderr || error.message;
    const wrapped = new Error(`curl fallback failed: ${detail}`);
    wrapped.sourceOutcome = "network_error";
    throw wrapped;
  }
}

export function sourceOutcomeForHttpStatus(status) {
  const value = Number(status);
  if (value === 402) return "payment_required";
  if (value === 403) return "forbidden";
  if (value === 412 || value === 429) return "rate_limited";
  if (value >= 500) return "upstream_error";
  if (value >= 400) return "upstream_error";
  return "ok";
}

export function classifySourceError(error) {
  if (error?.sourceOutcome) return error.sourceOutcome;
  if (Number.isFinite(Number(error?.status))) return sourceOutcomeForHttpStatus(error.status);
  const message = String(error?.message ?? error ?? "");
  const statusMatch = message.match(/(?:^|\b)(402|403|412|429|5\d\d)(?:\b|$)/);
  if (statusMatch) return sourceOutcomeForHttpStatus(Number(statusMatch[1]));
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|aborted|timeout|network/i.test(describeNetworkError(error))) {
    return "network_error";
  }
  return "upstream_error";
}

export function classifyHttpResponse(response, text = "") {
  if (isCloudflareChallengeResponse(response, text)) return { outcome: "challenge", provider: "cloudflare" };
  return {
    outcome: sourceOutcomeForHttpStatus(response?.status),
    provider: providerForResponse(response)
  };
}

export function isCloudflareChallengeResponse(response, text = "") {
  const mitigated = headerValue(response, "cf-mitigated").toLowerCase();
  if (mitigated === "challenge") return true;
  const contentType = headerValue(response, "content-type").toLowerCase();
  const body = String(text ?? "");
  const looksHtml = contentType.includes("text/html") || /^\s*(?:<!doctype\s+html|<html\b)/i.test(body);
  return looksHtml && /\/cdn-cgi\/challenge-platform|\bcf-chl-|<title>\s*just a moment|attention required[^<]*cloudflare/i.test(body);
}

export function parseMismatchError(message = "Response structure mismatch") {
  const error = new Error(message);
  error.name = "SourceParseMismatchError";
  error.sourceOutcome = "parse_mismatch";
  error.provider = null;
  return error;
}

function providerForResponse(response) {
  return headerValue(response, "cf-ray") || headerValue(response, "cf-mitigated") ? "cloudflare" : null;
}

function headerValue(response, name) {
  return String(response?.headers?.get?.(name) ?? "").trim();
}
