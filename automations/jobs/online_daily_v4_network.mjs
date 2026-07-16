import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);

export async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, {
    ...options,
    accept: options.accept ?? "application/json,text/html;q=0.9,*/*;q=0.8"
  }));
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
    if (!response.ok) throw httpStatusError(response);
    return await response.text();
  } catch (error) {
    if (isSteamUrl(url) && shouldUseCurlFallback(error)) {
      logger.warn?.(`Steam Node fetch failed for ${new URL(url).host}: ${describeNetworkError(error)}; retrying with curl fallback`);
      return await fetchTextWithCurl(url, { timeoutMs, accept, execFileImpl });
    }
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
  if (/^(403|429)\b/.test(error.message)) return false;
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
    return stdout;
  } catch (error) {
    const stderr = String(error.stderr ?? "").trim();
    const detail = stderr || error.message;
    throw new Error(`curl fallback failed: ${detail}`);
  }
}
