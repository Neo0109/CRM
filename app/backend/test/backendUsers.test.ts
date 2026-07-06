import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildBackendUsers,
  validateBackendLogin,
  validateBackendSession
} from "../src/lib/backendUsers.ts";
import {
  buildConfiguredUsers,
  parseCrmUsersJsonWithDiagnostics
} from "../../../functions/_lib/crmUsers.ts";

const backendUsersSource = new URL("../src/lib/backendUsers.ts", import.meta.url);

describe("backend user helpers", () => {
  it("delegates pure user parsing to the canonical Functions user model", () => {
    const source = readFileSync(backendUsersSource, "utf8");

    assert.match(source, /functions\/_lib\/crmUsers\.js/, "backendUsers should import the canonical crmUsers module");
    for (const forbiddenHelper of [
      "function parseBackendUsersPayload",
      "function parseConcatenatedUsersPayload",
      "function topLevelJsonChunks",
      "function usersFromParsedPayload",
      "function userFromArrayItem",
      "function userFromObjectEntry",
      "function dedupeBackendUsers",
      "function displayNameForUsername",
      "function authKey",
      "function readPermissions"
    ]) {
      assert.equal(source.includes(forbiddenHelper), false, `backendUsers should not inline ${forbiddenHelper}`);
    }
  });

  it("matches canonical user parsing for shared CRM_USERS_JSON behavior", () => {
    const payload = JSON.stringify([
      { username: " Neo ", password: " token-1 ", display_name: "Neo Admin", role: "admin", permissions: "leads, export" },
      { username: "neo", password: "token-2", displayName: "Duplicate" },
      { name: "jojo", accessToken: " token-3 ", label: "Jojo BD" }
    ]);

    assert.deepEqual(
      buildBackendUsers({ rawUsers: payload }),
      buildConfiguredUsers({ rawUsers: payload })
    );

    const concatenated = "[{\"username\":\"jojo\",\"password\":\"one\"}]{\"neo\":\"two\"}";
    assert.deepEqual(
      buildBackendUsers({ rawUsers: concatenated }),
      parseCrmUsersJsonWithDiagnostics(concatenated).users
    );
  });

  it("parses array and object CRM_USERS_JSON, trims credentials, and keeps the first duplicate user", () => {
    const users = buildBackendUsers({
      rawUsers: JSON.stringify([
        { username: " Neo ", password: " token-1 ", display_name: "Neo Admin", role: "admin", permissions: "leads, export" },
        { username: "neo", password: "token-2", displayName: "Duplicate" }
      ])
    });

    assert.equal(users.length, 1);
    assert.equal(users[0].username, "Neo");
    assert.equal(users[0].password, "token-1");
    assert.equal(users[0].display_name, "Neo Admin");
    assert.equal(users[0].role, "admin");
    assert.deepEqual(users[0].permissions, ["leads", "export"]);

    const objectUsers = buildBackendUsers({
      rawUsers: JSON.stringify({
        jojo: " pass ",
        nanyuan: { token: " token ", nickname: "南鸢", permissions: ["leads", "daily"] }
      })
    });
    assert.deepEqual(objectUsers.map((user) => [user.username, user.display_name, user.role, user.permissions]), [
      ["jojo", "Jojo", "member", []],
      ["nanyuan", "南鸢", "member", ["leads", "daily"]]
    ]);
  });

  it("repairs concatenated JSON and appends legacy admin fallback credentials", () => {
    const users = buildBackendUsers({
      rawUsers: "[{\"username\":\"jojo\",\"password\":\"one\"}]{\"neo\":\"two\"}",
      legacyUsername: " admin ",
      legacyPassword: " secret "
    });

    assert.deepEqual(users.map((user) => [user.username, user.password, user.role, user.permissions]), [
      ["jojo", "one", "member", []],
      ["neo", "two", "member", []],
      ["admin", "secret", "admin", ["*"]]
    ]);
  });

  it("validates configured users before legacy fallback and rejects invalid CRM_USERS_JSON", () => {
    const configured = validateBackendLogin(
      { rawUsers: JSON.stringify([{ username: "neo", password: "token", permissions: ["*"] }]) },
      { username: " NEO ", password: " token " }
    );
    assert.equal(configured.ok, true);
    if (configured.ok) {
      assert.deepEqual(configured.user, { username: "neo", display_name: "Neo", role: "member", permissions: ["*"] });
    }

    assert.deepEqual(
      validateBackendLogin({ rawUsers: "{bad-json", legacyUsername: "neo", legacyPassword: "token" }, { username: "neo", password: "token" }),
      { ok: false }
    );

    const legacy = validateBackendLogin(
      { legacyUsername: "neo", legacyPassword: "token" },
      { username: "neo", password: "token" }
    );
    assert.equal(legacy.ok, true);
    if (legacy.ok) assert.equal(legacy.user.role, "admin");
  });

  it("accepts auth headers or cookies for protected local API requests", () => {
    const config = { rawUsers: JSON.stringify({ neo: "token" }) };

    assert.equal(validateBackendSession(config, { usernameHeader: "neo", tokenHeader: "token" }), true);
    assert.equal(
      validateBackendSession(config, { cookieHeader: "crm_username=neo; crm_access_token=token" }),
      true
    );
    assert.equal(validateBackendSession(config, { usernameHeader: "neo", tokenHeader: "wrong" }), false);
  });
});
