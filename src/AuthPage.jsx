import React, { useState } from "react";
import { signInWithUsername, signUp } from "./lib/api";

const FONT_DISPLAY = "'Baloo 2', system-ui, sans-serif";
const FONT_BODY = "'Nunito', system-ui, sans-serif";
const INK = "#5B4A4E";
const INK_SOFT = "#8B7A7D";

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await signUp({ email, password, username, displayName: username });
        // If email confirmation is required, there will be no session yet.
        if (!res.session) {
          setConfirmNotice(true);
        } else {
          onAuthed();
        }
      } else {
        await signInWithUsername({ username, password });
        onAuthed();
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(circle at 15% -10%, #FDEEDF 0%, #FBF7F2 40%, #FBF7F2 100%)", fontFamily: FONT_BODY }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
      `}</style>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌷</div>
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Habit Garden</h1>
          <p className="text-sm mt-1" style={{ color: INK_SOFT }}>Grow better habits, together.</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ boxShadow: "0 2px 14px rgba(150,120,110,0.08)" }}>
          {confirmNotice ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">📬</p>
              <p className="text-sm font-bold" style={{ color: INK }}>Check your inbox</p>
              <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
                We sent a confirmation link to {email}. Confirm your email, then sign in with your username.
              </p>
              <button
                onClick={() => { setConfirmNotice(false); setMode("signin"); }}
                className="mt-5 text-xs font-bold underline"
                style={{ color: "#A6335A" }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="flex rounded-2xl p-1 mb-5" style={{ background: "#FBF7F2" }}>
                {["signin", "signup"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors"
                    style={{ background: mode === m ? "white" : "transparent", color: mode === m ? INK : INK_SOFT }}
                  >
                    {m === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Username</label>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.trim())}
                    placeholder="cozy_karina"
                    className="w-full mt-1 px-4 py-2.5 rounded-2xl outline-none text-sm font-semibold"
                    style={{ background: "#FBF7F2", color: INK }}
                  />
                </div>

                {mode === "signup" && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Email</label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full mt-1 px-4 py-2.5 rounded-2xl outline-none text-sm font-semibold"
                      style={{ background: "#FBF7F2", color: INK }}
                    />
                    <p className="text-[11px] mt-1" style={{ color: INK_SOFT }}>Only used for account recovery — you'll sign in with your username.</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Password</label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full mt-1 px-4 py-2.5 rounded-2xl outline-none text-sm font-semibold"
                    style={{ background: "#FBF7F2", color: INK }}
                  />
                </div>

                {error && <p className="text-xs font-bold" style={{ color: "#A6335A" }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-full font-bold text-sm mt-2 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#F5B7C6,#F0A3B8)", color: "#7A2E42", fontFamily: FONT_BODY }}
                >
                  {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
