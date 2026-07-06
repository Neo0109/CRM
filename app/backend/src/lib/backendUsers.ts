import {
  authKey as canonicalAuthKey,
  buildConfiguredUsers,
  cleanAuthValue,
  displayNameForUsername,
  parseCrmUsersJsonWithDiagnostics,
  type AccessUser,
  type CrmUser
} from "../../../../functions/_lib/crmUsers.js";

export type BackendCrmUser = CrmUser;
export type BackendAccessUser = AccessUser;

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

export function buildBackendUsers(input: BackendUsersInput) {
  return buildConfiguredUsers({
    rawUsers: input.rawUsers,
    legacyUsername: input.legacyUsername,
    legacyPassword: input.legacyPassword
  }) as BackendCrmUser[];
}

export function validateBackendLogin(
  input: BackendUsersInput,
  credentials: BackendLoginCredentials
): { ok: true; user: BackendAccessUser } | { ok: false } {
  const parseResult = parseCrmUsersJsonWithDiagnostics(input.rawUsers);
  if (cleanBackendAuthValue(input.rawUsers) && parseResult.status === "invalid") {
    return { ok: false };
  }

  const users = buildBackendUsers(input);
  const submittedUsername = cleanBackendAuthValue(credentials.username);
  const submittedPassword = cleanBackendAuthValue(credentials.password);

  if (users.length) {
    const user = users.find((item) => canonicalAuthKey(item.username) === canonicalAuthKey(submittedUsername));
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

export const cleanBackendAuthValue = cleanAuthValue;

function accessUser(user: BackendCrmUser): BackendAccessUser {
  return {
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    permissions: user.permissions
  };
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function firstHeaderValue(value: string | string[] | null | undefined) {
  return cleanBackendAuthValue(Array.isArray(value) ? value[0] : value);
}
