import { ArrowRight, LockKeyhole, ShieldCheck, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import bilibiliLogo from "./assets/bilibili-game-logo.png";
import "./login.css";

type LoginPageProps = {
  error: string | null;
  loading: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
};

export function LoginPage({ error, loading, onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = username.trim();
    if (!nextUsername || !password) {
      setLocalError("请输入账号和密码");
      return;
    }
    setLocalError(null);
    await onLogin(nextUsername, password);
  }

  return (
    <main className="login-page">
      <div className="matrix-noise" aria-hidden="true" />
      <section className="login-shell" aria-label="CRM 登录">
        <div className="login-brand">
          <span className="login-mark"><img src={bilibiliLogo} alt="bilibili" /></span>
          <p className="login-kicker">Neo's BD Matrix</p>
          <h1>BD 决策工作台</h1>
          <p>进入每日 sourcing、评测、跟进和发行判断的安全工作区。</p>
          <div className="login-signal" aria-hidden="true">
            <span>01001110</span>
            <span>BD_STREAM_READY</span>
            <span>NEO_MATRIX_ACCESS</span>
          </div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-head">
            <ShieldCheck size={22} />
            <div>
              <p>Secure Access</p>
              <h2>账号登录</h2>
            </div>
          </div>

          {(localError || error) && <div className="login-error">{localError || error}</div>}

          <label className="login-field">
            <span>账号</span>
            <div>
              <User size={18} />
              <input
                autoComplete="username"
                autoFocus
                disabled={loading}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="输入 Cloudflare 配置的账号"
                value={username}
              />
            </div>
          </label>

          <label className="login-field">
            <span>密码</span>
            <div>
              <LockKeyhole size={18} />
              <input
                autoComplete="current-password"
                disabled={loading}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入 CRM 访问密码"
                type="password"
                value={password}
              />
            </div>
          </label>

          <button className="login-button" disabled={loading} type="submit">
            <span>{loading ? "验证中" : "登录"}</span>
            <ArrowRight size={18} />
          </button>

          <p className="login-note">多人账号由 Cloudflare 环境变量管理，本机只保存当前登录凭证。</p>
        </form>
      </section>
    </main>
  );
}
