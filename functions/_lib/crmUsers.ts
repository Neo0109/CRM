export type CrmUser = {
  username: string;
  display_name: string;
  password: string;
  role: string;
  permissions: string[];
};

export type AccessUser = Pick<CrmUser, "username" | "display_name" | "role" | "permissions">;

export type CrmUsersParseStatus = "empty" | "valid" | "repaired" | "invalid";

export type CrmUsersParseResult = {
  users: CrmUser[];
  status: CrmUsersParseStatus;
  error?: string;
};

export type ConfiguredUsersInput = {
  rawUsers?: string | null;
  legacyUsername?: string | null;
  legacyPassword?: string | null;
  settingsPassword?: string | null;
};

export function buildConfiguredUsers(input: ConfiguredUsersInput) {
  const users = parseCrmUsersJson(input.rawUsers);
  const legacyUsername = cleanAuthValue(input.legacyUsername);
  const legacyPassword = cleanAuthValue(input.legacyPassword) || cleanAuthValue(input.settingsPassword);

  if (legacyUsername && legacyPassword) {
    users.push({ username: legacyUsername, display_name: displayNameForUsername(legacyUsername), password: legacyPassword, role: "admin", permissions: ["*"] });
  }

  return dedupeCrmUsers(users);
}

export function parseCrmUsersJson(rawValue: string | null | undefined): CrmUser[] {
  return parseCrmUsersJsonWithDiagnostics(rawValue).users;
}

export function parseCrmUsersJsonWithDiagnostics(rawValue: string | null | undefined): CrmUsersParseResult {
  const raw = cleanAuthValue(rawValue);
  if (!raw) return { users: [], status: "empty" };

  const direct = parseCrmUsersPayloadInput(raw);
  if (direct.ok) return { users: direct.users, status: "valid" };

  const repairedRaw = repairCrmUsersJson(raw);
  if (repairedRaw !== raw) {
    const repaired = parseCrmUsersPayloadInput(repairedRaw);
    if (repaired.ok) return { users: repaired.users, status: "repaired", error: direct.error };
  }

  return { users: [], status: "invalid", error: direct.error };
}

export function parseCrmUsersPayloadInput(raw: string): { ok: true; users: CrmUser[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { ok: true, users: parsed.map(userFromArrayItem).filter(isCrmUser) };
    if (parsed && typeof parsed === "object") return { ok: true, users: Object.entries(parsed).map(userFromObjectEntry).filter(isCrmUser) };
    return { ok: true, users: [] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid JSON" };
  }
}

export function repairCrmUsersJson(raw: string) {
  return raw
    .replace(/}\s*(?=\{)/g, "},")
    .replace(/]\s*(?=\{)/g, "]},");
}

function userFromArrayItem(item: unknown): CrmUser | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const username = cleanAuthValue(readString(record.username) ?? readString(record.name));
  const password = cleanAuthValue(readString(record.password) ?? readString(record.token) ?? readString(record.accessToken));
  if (!username || !password) return null;
  const displayName = cleanAuthValue(readString(record.display_name) ?? readString(record.displayName) ?? readString(record.nickname) ?? readString(record.label));
  return {
    username,
    display_name: displayName || displayNameForUsername(username),
    password,
    role: cleanAuthValue(readString(record.role)) || "member",
    permissions: readPermissions(record.permissions)
  };
}

function userFromObjectEntry([username, value]: [string, unknown]): CrmUser | null {
  const cleanUsername = cleanAuthValue(username);
  if (!cleanUsername) return null;

  if (typeof value === "string") {
    const password = cleanAuthValue(value);
    return password ? { username: cleanUsername, display_name: displayNameForUsername(cleanUsername), password, role: "member", permissions: [] } : null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const password = cleanAuthValue(readString(record.password) ?? readString(record.token) ?? readString(record.accessToken));
  if (!password) return null;
  const displayName = cleanAuthValue(readString(record.display_name) ?? readString(record.displayName) ?? readString(record.nickname) ?? readString(record.label));
  return {
    username: cleanUsername,
    display_name: displayName || displayNameForUsername(cleanUsername),
    password,
    role: cleanAuthValue(readString(record.role)) || "member",
    permissions: readPermissions(record.permissions)
  };
}

function isCrmUser(user: CrmUser | null): user is CrmUser {
  return Boolean(user?.username && user.password);
}

export function displayNameForUsername(username: string | null | undefined) {
  const cleanUsername = cleanAuthValue(username);
  const configuredNames: Record<string, string> = {
    neo: "Neo",
    neo0109: "Neo",
    jojo: "Jojo",
    nanyuan: "南鸢",
    yuyang: "于老板"
  };
  return configuredNames[cleanUsername.toLowerCase()] ?? cleanUsername;
}

export function authKey(value: string | null | undefined) {
  return cleanAuthValue(value).toLowerCase();
}

export function dedupeCrmUsers(users: CrmUser[]) {
  const byUsername = new Map<string, CrmUser>();
  for (const user of users) {
    if (!byUsername.has(user.username)) byUsername.set(user.username, user);
  }
  return [...byUsername.values()];
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readPermissions(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map(cleanAuthValue).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(cleanAuthValue).filter(Boolean);
  return [];
}

export function cleanAuthValue(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
}
