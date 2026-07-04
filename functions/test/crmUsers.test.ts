import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConfiguredUsers,
  dedupeCrmUsers,
  parseCrmUsersJson,
  parseCrmUsersJsonWithDiagnostics,
  parseCrmUsersPayloadInput,
  repairCrmUsersJson
} from "../_lib/crmUsers.ts";

describe("crm user parsing helpers", () => {
  it("parses array and object CRM_USERS_JSON payloads with defaults", () => {
    assert.deepEqual(parseCrmUsersJson(JSON.stringify([
      {
        username: " neo ",
        password: "  secret  ",
        displayName: "Neo Prime",
        role: "admin",
        permissions: "leads, settings"
      },
      { name: "jojo", token: "token-2" }
    ])), [
      {
        username: "neo",
        display_name: "Neo Prime",
        password: "secret",
        role: "admin",
        permissions: ["leads", "settings"]
      },
      {
        username: "jojo",
        display_name: "Jojo",
        password: "token-2",
        role: "member",
        permissions: []
      }
    ]);

    assert.deepEqual(parseCrmUsersJson(JSON.stringify({
      nanyuan: { password: "pw-1", nickname: "南鸢", permissions: ["reports", "", "settings"] },
      yuyang: "pw-2"
    })), [
      {
        username: "nanyuan",
        display_name: "南鸢",
        password: "pw-1",
        role: "member",
        permissions: ["reports", "settings"]
      },
      {
        username: "yuyang",
        display_name: "于老板",
        password: "pw-2",
        role: "member",
        permissions: []
      }
    ]);
  });

  it("repairs adjacent JSON user objects and reports diagnostics", () => {
    const broken = `[{"username":"neo","password":"one"} {"username":"jojo","token":"two"}]`;
    assert.equal(repairCrmUsersJson(broken), `[{"username":"neo","password":"one"},{"username":"jojo","token":"two"}]`);

    const result = parseCrmUsersJsonWithDiagnostics(broken);
    assert.equal(result.status, "repaired");
    assert.equal(result.users.length, 2);
    assert.equal(result.users[1].username, "jojo");
    assert.equal(typeof result.error, "string");
  });

  it("dedupes users and appends legacy username/password fallback", () => {
    const parsed = parseCrmUsersPayloadInput(JSON.stringify({
      neo: "first",
      jojo: { password: "second", role: "editor" }
    }));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.ok ? parsed.users.length : 0, 2);

    assert.deepEqual(dedupeCrmUsers([
      { username: "neo", display_name: "Neo", password: "first", role: "admin", permissions: ["*"] },
      { username: "neo", display_name: "Neo 2", password: "second", role: "member", permissions: [] }
    ]), [
      { username: "neo", display_name: "Neo", password: "first", role: "admin", permissions: ["*"] }
    ]);

    assert.deepEqual(buildConfiguredUsers({
      rawUsers: JSON.stringify({ jojo: "team-token" }),
      legacyUsername: "neo",
      legacyPassword: "legacy-token"
    }).map((user) => [user.username, user.password, user.role, user.permissions]), [
      ["jojo", "team-token", "member", []],
      ["neo", "legacy-token", "admin", ["*"]]
    ]);
  });
});
