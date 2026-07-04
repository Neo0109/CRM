export type BackendCrmUser = {
  username: string;
  display_name: string;
  password: string;
  role: string;
  permissions: string[];
};

export type BackendAccessUser = Pick<BackendCrmUser, "username" | "display_name" | "role" | "permissions">;

export type BackendUsersInput = {
  rawUsers?: string | null;
  legacyUsername?: string | null;
  legacyPassword?: string | null;
};

export type BackendLoginCredentials = {
  username?: string | null;
  password?: string | null;
};

export type BackendSessionCredentials = {
  usernameHeader?: string | string[] | null;
  tokenHeader?: string | string[] | null;
  cookieHeader?: string | null;
};

type ParseResult = {
  users: BackendCrmUser[];
  status: "empty" | "valid" | "repaired" | "invalid";
};

export function buildBackendUsers(input: BackendUsersInput) {
  const users = parseBackendUsersJson(input.rawUsers);
  const legacyUsername = cleanBackendAuthValue(input.legacyUsername);
  const legacyPassword = cleanBackendAuthValue(input.legacyPassword);

  if (legacyUsername && legacyPassword) {
    users.push({
      username: legacyUsername,
      display_name: displayNameForUsername(legacyUsername),
      password: legacyPassword,
      role: "admin",
      permissions: ["*"]
    });
  }

  return dedupeBackendUsers(users);
}

export function validateBackendLogin(
  input: BackendUsersInput,
  credentials: BackendLoginCredentials
): { ok: true; user: BackendAccessUser } | { ok: false } {
  const parseResult = parseBackendUsersJsonWithStatus(input.rawUsers);
  if (cleanBackendAuthValue(input.rawUsers) && parseResult.status === "invalid") {
    return { ok: false };
  }

  const users = buildBackendUsers(input);
  const submittedUsername = cleanBackendAuthValue(credentials.username);
  const submittedPassword = cleanBackendAuthValue(credentials.password);

  if (users.length) {
    const user = users.find((item) => authKey(item.username) === authKey(submittedUsername));
    return user && submittedPassword === user.password
      ? { ok: true, user: accessUser(user) }
      : { ok: false };
  }

  const legacyUsername = cleanBackendAuthValue(input.legacyUsername);
  const legacyPassword = cleanBackendAuthValue(input.legacyPassword);
  const validUsername = legacyUsername ? submittedUsername === legacyUsername : Boolean(submittedUsername);
  const validPassword = legacyPassword ? submittedPassword === legacyPassword : Boolean(submittedPassword);
  if (!validUsername || !validPassword) return { ok: false };

  return {
    ok: true,
    user: {
      username: legacyUsername || submittedUsername,
      display_name: displayNameForUsername(legacyUsername || submittedUsername),
      role: "admin",
      permissions: ["*"]
    }
  };
}

export function validateBackendSession(input: BackendUsersInput, credentials: BackendSessionCredentials) {
  const username = firstHeaderValue(credentials.usernameHeader) || readCookie(credentials.cookieHeader ?? undefined, "crm_username") || "";
  const token = firstHeaderValue(credentials.tokenHeader) || readCookie(credentials.cookieHeader ?? undefined, "crm_access_token") || "";
  return validateBackendLogin(input, { username, password: token }).ok;
}

export function cleanBackendAuthValue(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
}

function parseBackendUsersJson(rawValue: string | null | undefined): BackendCrmUser[] {
  return parseBackendUsersJsonWithStatus(rawValue).users;
}

function parseBackendUsersJsonWithStatus(rawValue: string | null | undefined): ParseResult {
  const raw = cleanBackendAuthValue(rawValue);
  if (!raw) return { users: [], status: "empty" };

  const direct = parseBackendUsersPayload(raw);
  if (direct.ok) return { users: direct.users, status: "valid" };

  const repaired = parseConcatenatedUsersPayload(raw);
  if (repaired.ok) return { users: repaired.users, status: "repaired" };

  return { users: [], status: "invalid" };
}

function parseBackendUsersPayload(raw: string): { ok: true; users: BackendCrmUser[] } | { ok: false } {
  try {
    return { ok: true, users: usersFromParsedPayload(JSON.parse(raw) as unknown) };
  } catch {
    return { ok: false };
  }
}

function parseConcatenatedUsersPayload(raw: string): { ok: true; users: BackendCrmUser[] } | { ok: false } {
  const chunks = topLevelJsonChunks(raw);
  if (chunks.length < 2) return { ok: false };

  const users: BackendCrmUser[] = [];
  for (const chunk of chunks) {
    const parsed = parseBackendUsersPayload(chunk);
    if (!parsed.ok) return { ok: false };
    users.push(...parsed.users);
  }

  return { ok: true, users };
}

function topLevelJsonChunks(raw: string) {
  const chunks: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        chunks.push(raw.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return depth === 0 ? chunks : [];
}

function usersFromParsedPayload(parsed: unknown) {
  if (Array.isArray(parsed)) return parsed.map(userFromArrayItem).filter(isCrmUser);
  if (parsed && typeof parsed === "object") return Object.entries(parsed).map(userFromObjectEntry).filter(isCrmUser);
  return [];
}

function userFromArrayItem(item: unknown): BackendCrmUser | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const username = cleanBackendAuthValue(readString(record.username) ?? readString(record.name));
  const password = cleanBackendAuthValue(readString(record.password) ?? readString(record.token) ?? readString(record.accessToken));
  if (!username || !password) return null;
  const displayName = cleanBackendAuthValue(readString(record.display_name) ?? readString(record.displayName) ?? readString(record.nickname) ?? readString(record.label));
  return {
    username,
    display_name: displayName || displayNameForUsername(username),
    password,
    role: cleanBackendAuthValue(readString(record.role)) || "member",
    permissions: readPermissions(record.permissions)
  };
}

function userFromObjectEntry([username, value]: [string, unknown]): BackendCrmUser | null {
  const cleanUsername = cleanBackendAuthValue(username);
  if (!cleanUsername) return null;

  if (typeof value === "string") {
    const password = cleanBackendAuthValue(value);
    return password
      ? { username: cleanUsername, display_name: displayNameForUsername(cleanUsername), password, role: "member", permissions: [] }
      : null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const password = cleanBackendAuthValue(readString(record.password) ?? readString(record.token) ?? readString(record.accessToken));
  if (!password) return null;
  const displayName = cleanBackendAuthValue(readString(record.display_name) ?? readString(record.displayName) ?? readString(record.nickname) ?? readString(record.label));
  return {
    username: cleanUsername,
    display_name: displayName || displayNameForUsername(cleanUsername),
    password,
    role: cleanBackendAuthValue(readString(record.role)) || "member",
    permissions: readPermissions(record.permissions)
  };
}

function dedupeBackendUsers(users: BackendCrmUser[]) {
  const byUsername = new Map<string, BackendCrmUser>();
  for (const user of users) {
    const key = authKey(user.username);
    if (!byUsername.has(key)) byUsername.set(key, user);
  }
  return [...byUsername.values()];
}

function isCrmUser(user: BackendCrmUser | null): user is BackendCrmUser {
  return Boolean(user?.username && user.password);
}

function accessUser(user: BackendCrmUser): BackendAccessUser {
  return {
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    permissions: user.permissions
  };
}

function displayNameForUsername(username: string | null | undefined) {
  const cleanUsername = cleanBackendAuthValue(username);
  const configuredNames: Record<string, string> = {
    neo: "Neo",
    neo0109: "Neo",
    jojo: "Jojo",
    nanyuan: "南鸢",
    yuyang: "于老板"
  };
  return configuredNames[cleanUsername.toLowerCase()] ?? cleanUsername;
}

function authKey(value: string | null | undefined) {
  return cleanBackendAuthValue(value).toLowerCase();
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readPermissions(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map(cleanBackendAuthValue).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(cleanBackendAuthValue).filter(Boolean);
  return [];
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function firstHeaderValue(value: string | string[] | null | undefined) {
  return cleanBackendAuthValue(Array.isArray(value) ? value[0] : value);
}
