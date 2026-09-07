import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Sprout, Users, Gift, MessageCircle, User, Plus, Check, X,
  Flame, Star, Send, ArrowLeft, Trash2, Pencil, UserPlus, Lock,
  ChevronUp, ChevronDown, PartyPopper, LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import AuthPage from "./AuthPage";
import * as api from "./lib/api";

/* ---------------------------------------------------------------------- */
/*  DESIGN TOKENS  (same visual system as the prototype)                   */
/* ---------------------------------------------------------------------- */
const FONT_DISPLAY = "'Baloo 2', system-ui, sans-serif";
const FONT_BODY = "'Nunito', system-ui, sans-serif";
const THEME = { bg: "#FBF7F2", card: "#FFFFFF", ink: "#5B4A4E", inkSoft: "#8B7A7D", ring: "#F1E4DC" };
const APP_BG = "radial-gradient(circle at 15% -10%, #FDEEDF 0%, #FBF7F2 40%, #FBF7F2 100%)";
const HUES = {
  sky: { soft: "#E3F1FB", mid: "#AFDCF5", strong: "#6FB6E0", text: "#2E6E8E" },
  purple: { soft: "#EFE6FB", mid: "#D2BBF0", strong: "#A97FDE", text: "#6B47A6" },
  amber: { soft: "#FBF0D8", mid: "#F4D98C", strong: "#E7B84A", text: "#8C6A16" },
  indigo: { soft: "#E6E9FB", mid: "#C1C8F2", strong: "#8A93DE", text: "#4750A6" },
  rose: { soft: "#FBE6EC", mid: "#F4B9CB", strong: "#E77FA0", text: "#A6335A" },
  mint: { soft: "#E1F6EC", mid: "#A9E7C6", strong: "#5FCB93", text: "#1F7A50" },
  peach: { soft: "#FCE9DB", mid: "#F5C299", strong: "#EA9B54", text: "#9A5A18" },
  lavender: { soft: "#F1E9FB", mid: "#DCC9F5", strong: "#B98EE0", text: "#6B3FA0" },
  coral: { soft: "#FDE8E4", mid: "#F7C0B6", strong: "#EE9482", text: "#A34A36" },
  teal: { soft: "#E1F5F2", mid: "#A8E4DB", strong: "#5FC2B3", text: "#1D7A6C" },
  butter: { soft: "#FCF6DC", mid: "#F6E9A0", strong: "#E9D35C", text: "#8C7A12" },
  sage: { soft: "#EAF2E4", mid: "#C9DFB8", strong: "#9CC47F", text: "#4C7A2E" },
  blush: { soft: "#FDEAF0", mid: "#F7C7D8", strong: "#EE93B2", text: "#A33566" },
};
const hue = (c) => HUES[c] || HUES.sky;
const ACCENTS = Object.keys(HUES);
const accentFor = (id) => ACCENTS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const COMPANION_STAGES = ["🥚", "🐣", "🐥", "🐦"];
const PRESET_MESSAGES = ["You're doing great! 🌷", "Keep going! ✨", "I believe in you! 💪", "I'm watching that streak 👀", "Let's get this done together! 🫶"];
const ICON_CHOICES = ["💧", "🧘", "📖", "🌙", "🧺", "🏃", "🥗", "✍️", "🎨", "🧑‍🍳", "🚭", "😴"];
const COLOR_CHOICES = Object.keys(HUES);

// --- fuzzy task-name matching, so buddy pairing doesn't require identical wording ---
const STOPWORDS = new Set(["a", "an", "the", "my", "your", "our", "their", "to", "for", "of", "in", "on", "at", "daily", "every", "each", "day", "days", "week", "time", "times", "do", "doing", "get", "getting", "more", "less", "and", "with"]);
function significantWords(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}
function fuzzyScore(a, b) {
  const setA = new Set(significantWords(a));
  return significantWords(b).reduce((score, w) => score + (setA.has(w) ? 1 : 0), 0);
}
function bestFuzzyMatch(targetName, candidates) {
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const s = fuzzyScore(targetName, c.name);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return best;
}

/* ---------------------------------------------------------------------- */
/*  UI PRIMITIVES                                                          */
/* ---------------------------------------------------------------------- */
function Card({ children, className = "", style = {}, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-3xl bg-white shadow-sm ${className}`} style={{ boxShadow: "0 2px 14px rgba(150,120,110,0.08)", ...style }}>
      {children}
    </div>
  );
}

function PillButton({ children, onClick, variant = "primary", className = "", disabled, style = {} }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:active:scale-100";
  const variants = {
    primary: { background: "linear-gradient(135deg,#F5B7C6,#F0A3B8)", color: "#7A2E42" },
    soft: { background: THEME.ring, color: THEME.ink },
    ghost: { background: "transparent", color: THEME.inkSoft, boxShadow: "inset 0 0 0 1.5px #EEE0D8" },
    dark: { background: "#5B4A4E", color: "#FFF5EF" },
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`${base} px-4 py-2 text-sm ${className}`} style={{ ...variants[variant], fontFamily: FONT_BODY, ...style }}>
      {children}
    </button>
  );
}

function ProgressBar({ value, colorFrom = "#F6C9D3", colorTo = "#F0A3B8", height = 10 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: "#F1E4DC", height }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, value)}%`, background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})` }} />
    </div>
  );
}

function Avatar({ emoji, accent = "sky", size = 44 }) {
  const h = hue(accent);
  return (
    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: size, height: size, background: `linear-gradient(160deg, ${h.soft}, ${h.mid})`, fontSize: size * 0.5 }}>
      {emoji}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-extrabold" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}>{children}</h2>
      {right}
    </div>
  );
}

function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 items-end" style={{ maxWidth: 320 }}>
      {toasts.map((t) => (
        <div key={t.id} className="px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold animate-[fadein_0.2s_ease]" style={{ background: "#5B4A4E", color: "#FFF5EF", fontFamily: FONT_BODY }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const CONFETTI_EMOJI = ["🌸", "✨", "🌟", "🎉", "💫", "🌷"];
function Confetti() {
  const pieces = React.useMemo(
    () => Array.from({ length: 20 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      duration: 1.1 + Math.random() * 0.7,
      emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
      size: 16 + Math.random() * 12,
    })),
    []
  );
  return (
    <div className="fixed inset-0 pointer-events-none z-[95] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute", left: `${p.left}%`, top: "-8%", fontSize: p.size,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function Modal({ onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(91,74,78,0.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`bg-[#FFFBF6] rounded-t-3xl sm:rounded-3xl w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} p-6 max-h-[88vh] overflow-y-auto`} style={{ fontFamily: FONT_BODY }}>
        {children}
      </div>
    </div>
  );
}

function Companion({ stage, size = 46, bounce }) {
  return (
    <div className={`flex items-center justify-center rounded-full ${bounce ? "animate-bounce" : ""}`} style={{ width: size, height: size, background: "linear-gradient(160deg,#FBF0D8,#F4D98C)", fontSize: size * 0.55 }}>
      {COMPANION_STAGES[stage] || COMPANION_STAGES[0]}
    </div>
  );
}

function HabitRow({ habit, onToggle, onEdit, compact }) {
  const h = hue(habit.color);
  return (
    <Card className="p-3.5 flex items-center gap-3">
      <button onClick={() => onToggle(habit)} className="shrink-0 rounded-2xl flex items-center justify-center transition-transform active:scale-90" style={{ width: 46, height: 46, background: habit.completedToday ? `linear-gradient(160deg, ${h.mid}, ${h.strong})` : h.soft }}>
        {habit.completedToday ? <Check size={20} color="white" strokeWidth={3} /> : <span style={{ fontSize: 20 }}>{habit.icon}</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold truncate" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink, fontSize: 15 }}>{habit.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-bold flex items-center gap-0.5" style={{ color: h.text }}><Flame size={12} /> {habit.streak}d</span>
          <span className="text-xs" style={{ color: THEME.inkSoft }}>· {frequencyLabel(habit.frequency)}</span>
        </div>
        {!compact && (
          <div className="flex gap-1 mt-2">
            {habit.week.map((d, i) => <div key={i} title={DAY_LABELS[i]} className="w-4 h-4 rounded-md" style={{ background: d ? h.strong : "#F1E4DC" }} />)}
          </div>
        )}
      </div>
      {onEdit && <button onClick={() => onEdit(habit)} className="shrink-0 p-2 rounded-full hover:bg-[#FBF7F2]"><Pencil size={15} color={THEME.inkSoft} /></button>}
    </Card>
  );
}

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function frequencyToFlags(freq) {
  if (!freq || freq === "Daily") return Array(7).fill(true);
  const tokens = freq.split(",").map((s) => s.trim());
  const flags = DAY_KEYS.map((d) => tokens.includes(d));
  return flags.some(Boolean) ? flags : Array(7).fill(true);
}

function flagsToFrequency(flags) {
  if (flags.every(Boolean)) return "Daily";
  const chosen = DAY_KEYS.filter((_, i) => flags[i]);
  return chosen.length ? chosen.join(",") : "Daily";
}

function frequencyLabel(freq) {
  if (!freq || freq === "Daily") return "Daily";
  const tokens = freq.split(",").map((s) => s.trim()).filter((t) => DAY_KEYS.includes(t));
  if (tokens.length === 0) return freq; // legacy/custom text — show as-is
  if (tokens.length === 1) return `Every ${tokens[0]}`;
  return tokens.join(" · ");
}

function HabitModal({ initial, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [icon, setIcon] = useState(initial?.icon || ICON_CHOICES[0]);
  const [color, setColor] = useState(initial?.color || "sky");
  const [dayFlags, setDayFlags] = useState(frequencyToFlags(initial?.frequency));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const toggleDay = (i) => setDayFlags((f) => f.map((v, idx) => (idx === i ? !v : v)));

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-extrabold" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}>{initial ? "Edit task" : "New task"}</h3>
        <button onClick={onClose}><X size={20} color={THEME.inkSoft} /></button>
      </div>
      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: THEME.inkSoft }}>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Walk for 15 minutes" className="w-full mt-1 mb-4 px-4 py-2.5 rounded-2xl outline-none text-sm font-semibold" style={{ background: "#FBF7F2", color: THEME.ink }} />

      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: THEME.inkSoft }}>Icon</label>
      <div className="flex items-center gap-2 mt-2 mb-2">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: hue(color).soft }}>{icon}</div>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value || icon)}
          placeholder="Tap here, then open your emoji keyboard"
          className="flex-1 px-4 py-2.5 rounded-2xl outline-none text-sm font-semibold"
          style={{ background: "#FBF7F2", color: THEME.ink }}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-1">
        {ICON_CHOICES.map((i) => <button key={i} onClick={() => setIcon(i)} className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: icon === i ? hue(color).mid : "#FBF7F2" }}>{i}</button>)}
      </div>
      <p className="text-[11px] mb-4" style={{ color: THEME.inkSoft }}>Any emoji works — use your phone's 😀 or 🌐 emoji keyboard for the full set.</p>

      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: THEME.inkSoft }}>Color</label>
      <div className="flex flex-wrap gap-2 mt-2 mb-4">
        {COLOR_CHOICES.map((c) => <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full" style={{ background: hue(c).strong, boxShadow: color === c ? "0 0 0 3px white, 0 0 0 5px " + hue(c).strong : "none" }} />)}
      </div>

      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: THEME.inkSoft }}>Frequency</label>
      <div className="flex flex-wrap gap-2 mt-2 mb-2">
        {[
          { label: "Every day", flags: [true, true, true, true, true, true, true] },
          { label: "Weekdays", flags: [true, true, true, true, true, false, false] },
          { label: "Weekends", flags: [false, false, false, false, false, true, true] },
        ].map((preset) => {
          const isActive = JSON.stringify(dayFlags) === JSON.stringify(preset.flags);
          return (
            <button
              key={preset.label}
              onClick={() => setDayFlags(preset.flags)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              style={{ background: isActive ? hue(color).strong : "#FBF7F2", color: isActive ? "white" : THEME.inkSoft }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 mb-1">
        {DAY_KEYS.map((d, i) => (
          <button
            key={d}
            onClick={() => toggleDay(i)}
            className="w-9 h-9 rounded-full text-xs font-extrabold flex items-center justify-center"
            style={{ background: dayFlags[i] ? hue(color).strong : "#FBF7F2", color: dayFlags[i] ? "white" : THEME.inkSoft }}
          >
            {d[0]}
          </button>
        ))}
      </div>
      <p className="text-xs font-bold mb-6" style={{ color: hue(color).text }}>{frequencyLabel(flagsToFrequency(dayFlags))}</p>

      {confirmingDelete ? (
        <div className="p-3 rounded-2xl mb-2" style={{ background: "#FBE6EC" }}>
          <p className="text-xs font-bold mb-2" style={{ color: "#A6335A" }}>Delete this task? This can't be undone.</p>
          <div className="flex gap-2">
            <PillButton variant="dark" className="flex-1" onClick={() => onDelete(initial.id)}>Delete forever</PillButton>
            <PillButton variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancel</PillButton>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <PillButton
            variant="primary"
            className="flex-1 py-3"
            disabled={!name.trim()}
            onClick={() => name.trim() && onSave({ name: name.trim(), icon, color, frequency: flagsToFrequency(dayFlags) })}
          >
            {initial ? "Save changes" : "Create task"}
          </PillButton>
          {initial && <button onClick={() => setConfirmingDelete(true)} className="p-3 rounded-2xl" style={{ background: "#FBE6EC" }}><Trash2 size={17} color="#A6335A" /></button>}
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  NAVIGATION                                                             */
/* ---------------------------------------------------------------------- */
const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "habits", label: "Tasks", icon: Sprout },
  { id: "friends", label: "Friends", icon: Users },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: User },
];

function SideNav({ tab, setTab, unreadCount, requestCount, onSignOut }) {
  return (
    <div className="hidden md:flex flex-col w-56 shrink-0 py-6 px-3 gap-1 border-r" style={{ borderColor: THEME.ring }}>
      <div className="px-3 mb-6 flex items-center gap-2">
        <span className="text-2xl">🌷</span>
        <span className="text-xl font-extrabold" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}>Habit Garden</span>
      </div>
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = tab === n.id;
        const badge = n.id === "messages" ? unreadCount : n.id === "friends" ? requestCount : 0;
        return (
          <button key={n.id} onClick={() => setTab(n.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-colors relative" style={{ fontFamily: FONT_BODY, background: active ? "#FBE6EC" : "transparent", color: active ? "#A6335A" : THEME.inkSoft }}>
            <Icon size={19} strokeWidth={2.3} />
            {n.label}
            {badge > 0 && <span className="ml-auto text-[10px] font-extrabold rounded-full px-1.5 py-0.5" style={{ background: "#E77FA0", color: "white" }}>{badge}</span>}
          </button>
        );
      })}
      <button onClick={onSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold mt-auto" style={{ fontFamily: FONT_BODY, color: THEME.inkSoft }}>
        <LogOut size={17} /> Sign out
      </button>
    </div>
  );
}

function BottomNav({ tab, setTab, unreadCount, requestCount }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center bg-white border-t px-1 py-2" style={{ borderColor: THEME.ring }}>
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = tab === n.id;
        const badge = n.id === "messages" ? unreadCount : n.id === "friends" ? requestCount : 0;
        return (
          <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-col items-center gap-0.5 px-2 py-1 relative">
            <Icon size={20} strokeWidth={2.4} color={active ? "#E77FA0" : "#B9A9AC"} />
            <span className="text-[10px] font-bold" style={{ fontFamily: FONT_BODY, color: active ? "#A6335A" : "#B9A9AC" }}>{n.label}</span>
            {badge > 0 && <span className="absolute top-0 right-1 w-2 h-2 rounded-full" style={{ background: "#E77FA0" }} />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  HOME VIEW                                                              */
/* ---------------------------------------------------------------------- */
function HomeView({ habits, onToggle, stars, dailyQuest, onClaimQuest, buddies, companionStage, companionBounce, name, openHabitModal, cozyProgress }) {
  const active = habits.filter((h) => !h.archived);
  const done = active.filter((h) => h.completedToday).length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const hourNow = new Date().getHours();
  const greeting = hourNow < 12 ? "Good morning" : hourNow < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}>{greeting}, {name} 🌷</h1>
          <p className="text-sm mt-0.5" style={{ color: THEME.inkSoft }}>Let's make today a good one.</p>
        </div>
        <Companion stage={companionStage} bounce={companionBounce} />
      </div>

      <Card className="p-5" style={{ background: "linear-gradient(135deg,#FDEEE3,#FBE6EC)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-extrabold" style={{ color: THEME.ink }}>Today's progress</span>
          <span className="text-sm font-extrabold" style={{ color: THEME.ink }}>{done} of {active.length}</span>
        </div>
        <ProgressBar value={pct} height={12} />
        {pct === 100 && active.length > 0 && <p className="text-xs font-bold mt-2 flex items-center gap-1" style={{ color: "#A6335A" }}><PartyPopper size={13} /> All done for today — amazing.</p>}
      </Card>

      <div>
        <SectionTitle right={<PillButton variant="soft" onClick={() => openHabitModal(null)}><Plus size={14} /> Add</PillButton>}>Today's tasks</SectionTitle>
        <div className="space-y-2.5">
          {active.length === 0 && <Card className="p-6 text-center text-sm" style={{ color: THEME.inkSoft }}>No tasks yet — add your first one 🌱</Card>}
          {active.map((h) => <HabitRow key={h.id} habit={h} onToggle={onToggle} compact />)}
        </div>
      </div>

      {buddies.length > 0 && (
        <div>
          <SectionTitle>🫶 Accountability</SectionTitle>
          <div className="space-y-2.5">
            {buddies.map((b) => {
              const myHabit = habits.find((h) => h.id === b.myHabitId);
              const myWeekCount = (myHabit?.week || []).filter(Boolean).length;
              const theirWeekCount = (b.theirWeek || []).filter(Boolean).length;
              const c = hue(myHabit?.color);
              return (
                <Card key={b.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar emoji={b.friend.avatar_emoji} accent={accentFor(b.friend.id)} size={36} />
                    <div>
                      <p className="text-sm font-extrabold" style={{ color: THEME.ink }}>{b.habitName}</p>
                      <p className="text-xs" style={{ color: THEME.inkSoft }}>with {b.friend.display_name}</p>
                    </div>
                    <span className="ml-auto text-xs font-extrabold flex items-center gap-1" style={{ color: "#A6335A" }}>🫶 {b.buddyStreak}d</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{ color: THEME.inkSoft }}>You · {myWeekCount}/7 <Flame size={10} color={c.text} /> {myHabit?.streak ?? 0}d</p>
                      <div className="flex gap-1">{(myHabit?.week || Array(7).fill(false)).map((d, i) => <div key={i} className="w-4 h-4 rounded-md" style={{ background: d ? c.strong : "#F1E4DC" }} />)}</div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{ color: THEME.inkSoft }}>{b.friend.display_name} · {theirWeekCount}/7 <Flame size={10} color="#A6335A" /> {b.theirStreak}d</p>
                      <div className="flex gap-1">{(b.theirWeek || Array(7).fill(false)).map((d, i) => <div key={i} className="w-4 h-4 rounded-md" style={{ background: d ? "#E77FA0" : "#F1E4DC" }} />)}</div>
                    </div>
                  </div>
                  {!b.theirCompletedToday ? (
                    <p className="text-xs" style={{ color: THEME.inkSoft }}>🌱 You're done! {b.friend.display_name} still has this goal left today.</p>
                  ) : (
                    <p className="text-xs" style={{ color: THEME.inkSoft }}>{b.friend.display_name} is done too — buddy streak stays alive today ✨</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {dailyQuest && (
        <div>
          <SectionTitle>✨ Today's bonus</SectionTitle>
          <Card className="p-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#FBF0D8,#FDEEE3)" }}>
            <div className="text-2xl">{dailyQuest.icon}</div>
            <div className="flex-1">
              <p className="text-sm font-extrabold" style={{ color: THEME.ink }}>{dailyQuest.title}</p>
              <p className="text-xs" style={{ color: THEME.inkSoft }}>{dailyQuest.desc}</p>
            </div>
            {dailyQuest.completed ? (
              <span className="text-xs font-extrabold" style={{ color: "#1F7A50" }}>+{dailyQuest.reward} ✦ earned</span>
            ) : (
              <PillButton variant="dark" onClick={onClaimQuest} disabled={!dailyQuest.ready}>+{dailyQuest.reward} ✦</PillButton>
            )}
          </Card>
        </div>
      )}

      <div>
        <SectionTitle>🎁 Reward progress</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold flex items-center gap-1" style={{ color: THEME.ink }}><Star size={14} fill="#F5D76E" color="#F5D76E" /> {stars} Stars</span>
            <span className="text-xs" style={{ color: THEME.inkSoft }}>{cozyProgress.have}/{cozyProgress.total} world items unlocked</span>
          </div>
          <ProgressBar value={(cozyProgress.have / Math.max(1, cozyProgress.total)) * 100} colorFrom="#F4D98C" colorTo="#E7B84A" />
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  HABITS VIEW                                                            */
/* ---------------------------------------------------------------------- */
function HabitsView({ habits, onToggle, openHabitModal, reorder }) {
  const active = habits.filter((h) => !h.archived);
  return (
    <div className="space-y-4 pb-6">
      <SectionTitle right={<PillButton variant="primary" onClick={() => openHabitModal(null)}><Plus size={14} /> New task</PillButton>}>My tasks</SectionTitle>
      <div className="space-y-2.5">
        {active.map((h, i) => (
          <div key={h.id} className="flex items-center gap-2">
            <div className="flex flex-col shrink-0">
              <button disabled={i === 0} onClick={() => reorder(h.id, -1)} className="disabled:opacity-20"><ChevronUp size={15} color={THEME.inkSoft} /></button>
              <button disabled={i === active.length - 1} onClick={() => reorder(h.id, 1)} className="disabled:opacity-20"><ChevronDown size={15} color={THEME.inkSoft} /></button>
            </div>
            <div className="flex-1"><HabitRow habit={h} onToggle={onToggle} onEdit={openHabitModal} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  FRIENDS VIEW                                                           */
/* ---------------------------------------------------------------------- */
function FriendsView({ friends, requests, buddyProposals, onAccept, onDecline, onSearch, searchResults, onSendRequest, onProposeBuddy, onAcceptBuddy, myHabits }) {
  const [query, setQuery] = useState("");
  const [proposingFor, setProposingFor] = useState(null); // friend id
  const [chosenHabitId, setChosenHabitId] = useState("");
  const [respondingTo, setRespondingTo] = useState(null); // proposal id
  const [respondHabitId, setRespondHabitId] = useState("");

  return (
    <div className="space-y-6 pb-6">
      <SectionTitle>Add a friend</SectionTitle>
      <Card className="p-3 flex items-center gap-2">
        <input value={query} onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); }} placeholder="Search by username" className="flex-1 outline-none text-sm font-semibold px-2" style={{ color: THEME.ink }} />
      </Card>
      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <Avatar emoji={p.avatar_emoji} accent={accentFor(p.id)} size={34} />
              <p className="text-sm font-bold flex-1" style={{ color: THEME.ink }}>{p.display_name} <span style={{ color: THEME.inkSoft }}>@{p.username}</span></p>
              <PillButton variant="soft" onClick={() => { onSendRequest(p.id); setQuery(""); }}><UserPlus size={13} /> Request</PillButton>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs flex items-center gap-1 -mt-3" style={{ color: THEME.inkSoft }}><Lock size={11} /> Friend lists stay private — no one can browse who you're connected with.</p>

      {requests.length > 0 && (
        <div>
          <SectionTitle>Requests</SectionTitle>
          <div className="space-y-2.5">
            {requests.map((r) => (
              <Card key={r.id} className="p-3.5 flex items-center gap-3">
                <Avatar emoji={r.sender.avatar_emoji} accent={accentFor(r.sender.id)} />
                <p className="font-extrabold flex-1 text-sm" style={{ color: THEME.ink }}>{r.sender.display_name}</p>
                <PillButton variant="primary" onClick={() => onAccept(r.id)}>Accept</PillButton>
                <button onClick={() => onDecline(r.id)} className="p-2"><X size={16} color={THEME.inkSoft} /></button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {buddyProposals.length > 0 && (
        <div>
          <SectionTitle>🫶 Buddy invitations</SectionTitle>
          <div className="space-y-2.5">
            {buddyProposals.map((p) => {
              const suggestion = bestFuzzyMatch(p.habit_a_name, myHabits);
              return (
                <Card key={p.id} className="p-4">
                  <p className="text-sm font-bold" style={{ color: THEME.ink }}>{p.proposer.display_name} wants to be accountability buddies</p>
                  <p className="text-xs mt-0.5" style={{ color: THEME.inkSoft }}>on "{p.habit_a_name}" — it doesn't need to be worded the same as yours</p>
                  {respondingTo === p.id ? (
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <select value={respondHabitId} onChange={(e) => setRespondHabitId(e.target.value)} className="flex-1 text-xs font-bold px-3 py-2 rounded-full" style={{ background: "#FBF7F2", color: THEME.ink }}>
                          <option value="">Pick your matching task…</option>
                          {myHabits.map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}
                        </select>
                        <PillButton variant="dark" disabled={!respondHabitId} onClick={() => { onAcceptBuddy(p.id, respondHabitId); setRespondingTo(null); }}>Confirm</PillButton>
                      </div>
                      {suggestion && respondHabitId === suggestion.id && (
                        <p className="text-[11px] font-bold mt-1.5" style={{ color: "#1F7A50" }}>✨ Looks like a match — pre-selected for you</p>
                      )}
                    </div>
                  ) : (
                    <PillButton variant="soft" className="mt-3" onClick={() => { setRespondingTo(p.id); setRespondHabitId(suggestion ? suggestion.id : ""); }}>Match a task</PillButton>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <SectionTitle>Your friends</SectionTitle>
        <div className="space-y-2.5">
          {friends.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar emoji={f.avatar_emoji} accent={accentFor(f.id)} />
                <div className="flex-1">
                  <p className="font-extrabold text-sm" style={{ color: THEME.ink }}>{f.display_name}</p>
                  <p className="text-xs" style={{ color: THEME.inkSoft }}>@{f.username}</p>
                </div>
              </div>
              {proposingFor === f.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <select value={chosenHabitId} onChange={(e) => setChosenHabitId(e.target.value)} className="flex-1 text-xs font-bold px-3 py-2 rounded-full" style={{ background: "#FBF7F2", color: THEME.ink }}>
                    <option value="">Pick a task to share…</option>
                    {myHabits.map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}
                  </select>
                  <PillButton variant="dark" disabled={!chosenHabitId} onClick={() => { onProposeBuddy(f.id, chosenHabitId); setProposingFor(null); setChosenHabitId(""); }}>Send</PillButton>
                </div>
              ) : (
                <PillButton variant="soft" className="mt-3" onClick={() => setProposingFor(f.id)}>🫶 Suggest accountability</PillButton>
              )}
            </Card>
          ))}
          {friends.length === 0 && <Card className="p-6 text-center text-sm" style={{ color: THEME.inkSoft }}>No friends yet — search for a username above.</Card>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  REWARDS VIEW                                                           */
/* ---------------------------------------------------------------------- */
const COZY_CATALOG_ICON = {}; // filled at runtime from the fetched catalog

function RewardsView({ stars, catalog, unlocked, achievements, streaks, buddyStreak, onOpenMystery, mysteryAvailable }) {
  return (
    <div className="space-y-6 pb-6">
      <Card className="p-5 text-center" style={{ background: "linear-gradient(135deg,#FBF0D8,#FDEEE3)" }}>
        <p className="text-3xl font-extrabold flex items-center justify-center gap-2" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}><Star size={26} fill="#F5D76E" color="#F5D76E" /> {stars}</p>
        <p className="text-xs mt-1" style={{ color: THEME.inkSoft }}>Stars earned from habits, streaks & quests</p>
        {mysteryAvailable && <PillButton variant="dark" className="mt-4" onClick={onOpenMystery}><Gift size={14} /> Open mystery reward</PillButton>}
      </Card>

      <div>
        <SectionTitle>Cozy world</SectionTitle>
        <Card className="p-5">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {catalog.map((item) => {
              const have = unlocked.includes(item.id);
              return (
                <div key={item.id} className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1" style={{ background: have ? "linear-gradient(160deg,#E1F6EC,#A9E7C6)" : "#F1E4DC", opacity: have ? 1 : 0.5 }}>
                  <span style={{ fontSize: 22, filter: have ? "none" : "grayscale(1)" }}>{item.icon}</span>
                  {!have && <Lock size={10} color={THEME.inkSoft} />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-center" style={{ color: THEME.inkSoft }}>{unlocked.length}/{catalog.length} items unlocked · keep your streaks going to earn more</p>
        </Card>
      </div>

      <div>
        <SectionTitle>Achievements</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a) => {
            const current = a.metric === "best_streak" ? streaks.best : a.metric === "buddy_streak" ? buddyStreak : streaks.perfectDays;
            const isUnlocked = current >= a.goal;
            return (
              <Card key={a.id} className="p-4 text-center" style={{ opacity: isUnlocked ? 1 : 0.55 }}>
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className="text-xs font-extrabold" style={{ color: THEME.ink }}>{a.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: THEME.inkSoft }}>{a.description}</p>
                {!isUnlocked && <p className="text-[10px] font-bold mt-1.5" style={{ color: "#E7B84A" }}>{Math.min(current, a.goal)}/{a.goal}</p>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MysteryRewardModal({ reward, onClose }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Modal onClose={onClose}>
      <div className="text-center py-4">
        <p className="text-lg font-extrabold mb-6" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}>🎁 Mystery reward!</p>
        <button onClick={() => setRevealed(true)} className="mx-auto w-32 h-32 rounded-3xl flex items-center justify-center text-5xl transition-transform duration-300" style={{ background: revealed ? "linear-gradient(160deg,#FBF0D8,#F4D98C)" : "linear-gradient(160deg,#EFE6FB,#D2BBF0)", transform: revealed ? "scale(1.05) rotate(0deg)" : "scale(1) rotate(-4deg)" }}>
          {revealed ? reward.icon : "❓"}
        </button>
        {!revealed ? <p className="text-sm mt-5 font-bold" style={{ color: THEME.inkSoft }}>Tap to open</p> : (
          <>
            <p className="text-base font-extrabold mt-5" style={{ color: THEME.ink }}>{reward.name}</p>
            <p className="text-xs mt-1" style={{ color: THEME.inkSoft }}>Added to your cozy world 🌱</p>
            <PillButton variant="primary" className="mt-5" onClick={onClose}>Nice!</PillButton>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  MESSAGES VIEW                                                          */
/* ---------------------------------------------------------------------- */
function MessagesView({ friends, unreadMap, onOpenConversation, activeFriendId, conversation, onSend, onBack }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [conversation]);

  const active = friends.find((f) => f.id === activeFriendId);

  if (!active) {
    return (
      <div className="space-y-4 pb-6">
        <SectionTitle>Messages</SectionTitle>
        <div className="space-y-2.5">
          {friends.map((f) => {
            const unread = unreadMap[f.id] || 0;
            return (
              <Card key={f.id} className="p-3.5 flex items-center gap-3" onClick={() => onOpenConversation(f.id)} style={{ cursor: "pointer" }}>
                <Avatar emoji={f.avatar_emoji} accent={accentFor(f.id)} />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm" style={{ color: THEME.ink }}>{f.display_name}</p>
                  <p className="text-xs truncate" style={{ color: THEME.inkSoft }}>Tap to open conversation</p>
                </div>
                {unread > 0 && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#E77FA0" }} />}
              </Card>
            );
          })}
          {friends.length === 0 && <Card className="p-6 text-center text-sm" style={{ color: THEME.inkSoft }}>Add a friend to start chatting.</Card>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-4">
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onBack}><ArrowLeft size={19} color={THEME.inkSoft} /></button>
        <Avatar emoji={active.avatar_emoji} accent={accentFor(active.id)} size={34} />
        <p className="font-extrabold text-sm" style={{ color: THEME.ink }}>{active.display_name}</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-1" style={{ maxHeight: 380 }}>
        {conversation.length === 0 && <p className="text-xs text-center mt-8" style={{ color: THEME.inkSoft }}>No messages yet — send some encouragement 🌷</p>}
        {conversation.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className="px-3.5 py-2 rounded-2xl text-sm max-w-[75%] font-semibold" style={{ background: m.mine ? "linear-gradient(135deg,#F5B7C6,#F0A3B8)" : "#F1E4DC", color: m.mine ? "#7A2E42" : THEME.ink }}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto py-3 -mx-1 px-1">
        {PRESET_MESSAGES.map((p) => <button key={p} onClick={() => onSend(p, true)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: "#FBF0D8", color: "#8C6A16" }}>{p}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { onSend(draft.trim(), false); setDraft(""); } }} placeholder="Send a message..." className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold outline-none" style={{ background: "#FBF7F2", color: THEME.ink }} />
        <button onClick={() => { if (draft.trim()) { onSend(draft.trim(), false); setDraft(""); } }} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#F5B7C6,#F0A3B8)" }}>
          <Send size={15} color="#7A2E42" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  PROFILE VIEW                                                           */
/* ---------------------------------------------------------------------- */
function ProfileView({ name, bio, stars, streaks, achievements, companionStage, settings, onToggleSetting }) {
  const unlockedCount = achievements.filter((a) => (a.metric === "best_streak" ? streaks.best : a.metric === "buddy_streak" ? streaks.buddyBest : streaks.perfectDays) >= a.goal).length;
  return (
    <div className="space-y-6 pb-6">
      <Card className="p-6 text-center" style={{ background: "linear-gradient(135deg,#EFE6FB,#FBE6EC)" }}>
        <div className="mx-auto mb-3" style={{ width: 72, height: 72 }}><Companion stage={companionStage} size={72} /></div>
        <p className="text-lg font-extrabold" style={{ fontFamily: FONT_DISPLAY, color: THEME.ink }}>{name}</p>
        <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: THEME.inkSoft }}>{bio}</p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div><p className="text-base font-extrabold" style={{ color: THEME.ink }}>{streaks.best}d</p><p className="text-[10px]" style={{ color: THEME.inkSoft }}>Best streak</p></div>
          <div><p className="text-base font-extrabold" style={{ color: THEME.ink }}>{stars}</p><p className="text-[10px]" style={{ color: THEME.inkSoft }}>Stars</p></div>
          <div><p className="text-base font-extrabold" style={{ color: THEME.ink }}>{unlockedCount}</p><p className="text-[10px]" style={{ color: THEME.inkSoft }}>Badges</p></div>
        </div>
      </Card>

      <div>
        <SectionTitle>Badges</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          {achievements.map((a) => {
            const current = a.metric === "best_streak" ? streaks.best : a.metric === "buddy_streak" ? streaks.buddyBest : streaks.perfectDays;
            const isUnlocked = current >= a.goal;
            return <div key={a.id} className="aspect-square rounded-2xl flex items-center justify-center text-2xl" style={{ background: isUnlocked ? "#FBF0D8" : "#F1E4DC", opacity: isUnlocked ? 1 : 0.4 }}>{a.icon}</div>;
          })}
        </div>
      </div>

      <div>
        <SectionTitle>Settings</SectionTitle>
        <Card className="divide-y" style={{ borderColor: THEME.ring }}>
          {[
            { key: "allow_friend_requests", label: "Allow friend requests" },
            { key: "allow_buddy_suggestions", label: "Suggest accountability buddies" },
            { key: "allow_messages", label: "Allow messages from friends" },
            { key: "notifications_enabled", label: "Push notifications" },
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm font-semibold" style={{ color: THEME.ink }}>{s.label}</span>
              <button onClick={() => onToggleSetting(s.key)} className="w-11 h-6 rounded-full relative transition-colors" style={{ background: settings[s.key] ? "#E77FA0" : "#E4D7D0" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: settings[s.key] ? 22 : 2 }} />
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  GARDEN  (the authenticated app shell — owns all data loading)          */
/* ---------------------------------------------------------------------- */
function Garden({ session }) {
  const userId = session.user.id;
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [habits, setHabits] = useState([]);
  const [logsByHabit, setLogsByHabit] = useState({}); // habitId -> Set(dates)
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [buddyProposals, setBuddyProposals] = useState([]);
  const [buddyLinks, setBuddyLinks] = useState([]); // active links, enriched
  const [searchResults, setSearchResults] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [activeFriendId, setActiveFriendId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [cozyCatalog, setCozyCatalog] = useState([]);
  const [cozyUnlocked, setCozyUnlocked] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState([]);
  const [modalHabit, setModalHabit] = useState(undefined);
  const [mysteryReward, setMysteryReward] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [companionBounce, setCompanionBounce] = useState(false);
  const prevCompanionStageRef = useRef(undefined);
  const [toasts, setToasts] = useState([]);

  const pushToast = (text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  /* --------------------- buddy link enrichment (reusable) ---------------------- */
  const enrichBuddyLinks = useCallback(async (links) => {
    const activeLinks = links.filter((l) => l.status === "active");
    return Promise.all(
      activeLinks.map(async (l) => {
        const isA = l.user_a === userId;
        const friendId = isA ? l.user_b : l.user_a;
        const myHabitId = isA ? l.habit_a_id : l.habit_b_id;
        const theirHabitId = isA ? l.habit_b_id : l.habit_a_id;
        const since = api.lastNDays(7)[0];
        const [{ data: friendProfile }, { data: theirHabit }, { data: theirLogsWeek }] = await Promise.all([
          supabase.from("profiles").select("id, username, display_name, avatar_emoji").eq("id", friendId).single(),
          supabase.from("habits").select("id, name").eq("id", theirHabitId).single(),
          supabase.from("habit_logs").select("completed_on").eq("habit_id", theirHabitId).gte("completed_on", since),
        ]);
        const theirDates = new Set((theirLogsWeek || []).map((r) => r.completed_on));
        return {
          id: l.id,
          friend: friendProfile,
          habitName: theirHabit?.name || l.habit_a_name,
          myHabitId,
          theirHabitId,
          buddyStreak: l.buddy_streak,
          theirCompletedToday: theirDates.has(api.todayStr()),
          theirWeek: api.lastNDays(7).map((d) => theirDates.has(d)),
          theirStreak: api.computeStreak(theirDates),
          lastBuddyDate: l.last_buddy_date,
        };
      })
    );
  }, [userId]);

  const refreshBuddyLinks = useCallback(async () => {
    try {
      const links = await api.listMyBuddyLinks();
      setBuddyLinks(await enrichBuddyLinks(links));
    } catch { /* non-critical background refresh */ }
  }, [enrichBuddyLinks]);

  /* ---------------------------- initial load ---------------------------- */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        prof, habitRows, friendRows, incoming, proposals, links,
        catalog, unlocked, achCatalog, achUnlocked, unread,
      ] = await Promise.all([
        api.getMyProfile(),
        api.listHabits(),
        api.listFriends(),
        api.listIncomingRequests(),
        api.listIncomingBuddyProposals(),
        api.listMyBuddyLinks(),
        api.listCozyCatalog(),
        api.listMyCozyUnlocks(),
        api.listAchievementsCatalog(),
        api.listMyUnlockedAchievements(),
        api.listUnreadCounts(),
      ]);

      const logs = await api.listHabitLogs(habitRows.map((h) => h.id), 30);
      const byHabit = {};
      for (const h of habitRows) byHabit[h.id] = new Set();
      for (const l of logs) byHabit[l.habit_id]?.add(l.completed_on);

      const enriched = await enrichBuddyLinks(links);

      setProfile(prof);
      setHabits(habitRows);
      setLogsByHabit(byHabit);
      setFriends(friendRows);
      setRequests(incoming);
      setBuddyProposals(proposals);
      setBuddyLinks(enriched);
      setCozyCatalog(catalog);
      setCozyUnlocked(unlocked);
      setAchievements(achCatalog);
      setUnlockedAchievementIds(achUnlocked);
      setUnreadMap(unread);
    } catch (err) {
      pushToast(err.message || "Something went wrong loading your garden");
    } finally {
      setLoading(false);
    }
  }, [userId, enrichBuddyLinks]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // bounce the companion whenever it grows a stage
  useEffect(() => {
    if (!profile) return;
    if (prevCompanionStageRef.current !== undefined && profile.companion_stage > prevCompanionStageRef.current) {
      setCompanionBounce(true);
      setTimeout(() => setCompanionBounce(false), 900);
    }
    prevCompanionStageRef.current = profile.companion_stage;
  }, [profile?.companion_stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the "who's done today" comparison fresh whenever Home is opened
  useEffect(() => { if (tab === "home" && !loading) refreshBuddyLinks(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // realtime: new incoming messages bump the unread badge live
  useEffect(() => {
    const unsub = api.subscribeToMessages(userId, (msg) => {
      setUnreadMap((m) => ({ ...m, [msg.sender_id]: (m[msg.sender_id] || 0) + 1 }));
      if (activeFriendId === msg.sender_id) {
        setConversation((c) => [...c, { ...msg, mine: false }]);
        api.markConversationRead(msg.sender_id);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeFriendId]);

  /* --------------------------- derived habits ---------------------------- */
  const derivedHabits = habits.map((h) => {
    const dates = logsByHabit[h.id] || new Set();
    const week = api.lastNDays(7).map((d) => dates.has(d));
    return { ...h, completedToday: dates.has(api.todayStr()), streak: api.computeStreak(dates), week };
  });
  const bestStreak = Math.max(0, ...derivedHabits.map((h) => h.streak));
  const buddyBest = Math.max(0, ...buddyLinks.map((b) => b.buddyStreak));

  /* -------------------------- achievement sync --------------------------- */
  useEffect(() => {
    if (!profile) return;
    const current = { best_streak: bestStreak, buddy_streak: buddyBest, perfect_days: profile.perfect_days };
    achievements.forEach(async (a) => {
      if (unlockedAchievementIds.includes(a.id)) return;
      if (current[a.metric] >= a.goal) {
        try {
          await api.unlockAchievement(a.id);
          setUnlockedAchievementIds((ids) => [...ids, a.id]);
          pushToast(`🏅 Badge unlocked: ${a.title}`);
        } catch {
          /* already unlocked elsewhere — ignore */
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestStreak, buddyBest, profile?.perfect_days, achievements]);

  /* ------------------------------ handlers -------------------------------- */
  const toggleHabit = async (habit) => {
    const completing = !habit.completedToday;
    // optimistic local update
    setLogsByHabit((prev) => {
      const set = new Set(prev[habit.id]);
      if (completing) set.add(api.todayStr()); else set.delete(api.todayStr());
      return { ...prev, [habit.id]: set };
    });
    try {
      if (completing) await api.completeHabit(habit.id); else await api.uncompleteHabit(habit.id);
    } catch (err) {
      pushToast("Couldn't save that — try again");
      return;
    }

    if (completing) {
      const newStars = (profile.stars || 0) + 5;
      let patch = { stars: newStars };
      pushToast("+5 ✦");

      const stillTodo = derivedHabits.filter((h) => !h.archived && h.id !== habit.id && !h.completedToday);
      const allDone = stillTodo.length === 0;
      if (allDone) {
        patch.stars = newStars + 30;
        patch.perfect_days = (profile.perfect_days || 0) + 1;
        patch.companion_stage = Math.min(COMPANION_STAGES.length - 1, (profile.companion_stage || 0) + 1);
        pushToast("✨ All done for today! +30 ✦");
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1600);
        if (profile.mystery_available) {
          patch.mystery_available = false;
          const locked = cozyCatalog.filter((c) => !cozyUnlocked.includes(c.id));
          const pool = locked.length ? locked : cozyCatalog;
          if (pool.length) setTimeout(() => setMysteryReward(pool[Math.floor(Math.random() * pool.length)]), 600);
        }
      }
      const updated = await api.updateProfile(patch);
      setProfile(updated);

      // buddy streak bump: if this habit is part of an active link and both sides are done today
      const link = buddyLinks.find((b) => b.myHabitId === habit.id);
      if (link) {
        const theirDone = link.theirCompletedToday;
        if (theirDone && link.lastBuddyDate !== api.todayStr()) {
          const next = link.buddyStreak + 1;
          await api.bumpBuddyStreak(link.id, next);
          setBuddyLinks((prev) => prev.map((b) => (b.id === link.id ? { ...b, buddyStreak: next, lastBuddyDate: api.todayStr() } : b)));
        }
      }
    } else {
      const newStars = Math.max(0, (profile.stars || 0) - 5);
      const updated = await api.updateProfile({ stars: newStars });
      setProfile(updated);
    }
  };

  const claimMystery = async () => {
    if (mysteryReward) {
      try {
        await api.unlockCozyItem(mysteryReward.id);
        setCozyUnlocked((u) => [...u, mysteryReward.id]);
      } catch { /* already have it */ }
    }
    setMysteryReward(null);
  };

  const openHabitModal = (h) => setModalHabit(h ?? null);

  const saveHabit = async (data) => {
    try {
      if (modalHabit && modalHabit.id) {
        const updated = await api.updateHabit(modalHabit.id, data);
        setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        pushToast("Task updated");
      } else {
        const created = await api.createHabit(data);
        setHabits((prev) => [...prev, created]);
        setLogsByHabit((prev) => ({ ...prev, [created.id]: new Set() }));
        pushToast("Task created 🌱");
      }
      setModalHabit(undefined);
    } catch (err) {
      pushToast(err.message || "Couldn't save task");
    }
  };

  const deleteHabit = async (id) => {
    await api.deleteHabitForever(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogsByHabit((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setModalHabit(undefined);
    pushToast("Task deleted");
  };

  const reorderHabit = async (id, dir) => {
    const active = derivedHabits.filter((h) => !h.archived);
    const idx = active.findIndex((h) => h.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= active.length) return;
    const copy = [...active];
    [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
    setHabits((prev) => {
      const order = copy.map((h) => h.id);
      return [...prev].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    });
    await api.reorderHabits(copy.map((h) => h.id));
  };

  const searchFriends = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try { setSearchResults(await api.searchProfilesByUsername(q.trim())); } catch { /* ignore */ }
  };

  const sendFriendReq = async (id) => {
    try { await api.sendFriendRequest(id); pushToast("Friend request sent"); setSearchResults([]); }
    catch (err) { pushToast(err.message || "Couldn't send request"); }
  };

  const acceptRequest = async (id) => {
    await api.respondToRequest(id, true);
    setRequests((rs) => rs.filter((r) => r.id !== id));
    const fresh = await api.listFriends();
    setFriends(fresh);
    pushToast("You're now friends 🫶");
  };
  const declineRequest = async (id) => {
    await api.respondToRequest(id, false);
    setRequests((rs) => rs.filter((r) => r.id !== id));
  };

  const proposeBuddy = async (friendId, myHabitId) => {
    const habit = habits.find((h) => h.id === myHabitId);
    try {
      await api.proposeBuddyLink({ myHabitId, myHabitName: habit.name, friendId });
      pushToast("Buddy invitation sent 🫶");
    } catch (err) {
      pushToast(err.message || "Couldn't send invitation");
    }
  };

  const acceptBuddy = async (proposalId, myHabitId) => {
    await api.acceptBuddyProposal(proposalId, myHabitId);
    setBuddyProposals((ps) => ps.filter((p) => p.id !== proposalId));
    pushToast("You're accountability buddies now 🫶");
    loadAll();
  };

  const openConversation = async (friendId) => {
    setActiveFriendId(friendId);
    const rows = await api.listConversation(friendId);
    setConversation(rows.map((m) => ({ ...m, mine: m.sender_id === userId })));
    await api.markConversationRead(friendId);
    setUnreadMap((m) => ({ ...m, [friendId]: 0 }));
  };

  const sendChatMessage = async (body, isPreset) => {
    const saved = await api.sendMessage(activeFriendId, body, isPreset);
    setConversation((c) => [...c, { ...saved, mine: true }]);
    if (!dailyQuestCompleted) {
      const updated = await api.updateProfile({ stars: (profile.stars || 0) + 10 });
      setProfile(updated);
      setDailyQuestCompleted(true);
      pushToast("Friend quest complete! +10 ✦");
    }
  };

  const [dailyQuestCompleted, setDailyQuestCompleted] = useState(false);
  const dailyQuest = {
    icon: "💌", title: "Friend quest", desc: "Send an encouraging message to an accountability buddy.",
    reward: 10, completed: dailyQuestCompleted, ready: buddyLinks.length > 0,
  };

  const toggleSetting = async (key) => {
    const updated = await api.updateProfile({ [key]: !profile[key] });
    setProfile(updated);
  };

  if (loading || !profile) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ background: THEME.bg, fontFamily: FONT_BODY }}>
        <p className="text-sm font-bold animate-pulse" style={{ color: THEME.inkSoft }}>🌱 Growing your garden…</p>
      </div>
    );
  }

  const unreadCount = Object.values(unreadMap).reduce((a, b) => a + b, 0);
  const cozyProgress = { have: cozyUnlocked.length, total: cozyCatalog.length };
  const streaks = { best: bestStreak, perfectDays: profile.perfect_days, buddyBest };

  return (
    <div className="w-full h-full min-h-screen flex" style={{ background: APP_BG, fontFamily: FONT_BODY, color: THEME.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
        @keyframes fadein { from { opacity:0; transform: translateY(-6px);} to {opacity:1; transform:translateY(0);} }
        @keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg); opacity:1; } 100% { transform: translateY(115vh) rotate(360deg); opacity:0; } }
        * { box-sizing: border-box; }
      `}</style>

      <SideNav tab={tab} setTab={setTab} unreadCount={unreadCount} requestCount={requests.length} onSignOut={() => api.signOut()} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-24 md:pb-8 max-w-2xl w-full mx-auto">
          {tab === "home" && (
            <HomeView habits={derivedHabits} onToggle={toggleHabit} stars={profile.stars} dailyQuest={dailyQuest}
              onClaimQuest={() => {}} buddies={buddyLinks} companionStage={profile.companion_stage} companionBounce={companionBounce}
              name={profile.display_name} openHabitModal={openHabitModal} cozyProgress={cozyProgress} />
          )}
          {tab === "habits" && (
            <HabitsView habits={derivedHabits} onToggle={toggleHabit} openHabitModal={openHabitModal} reorder={reorderHabit} />
          )}
          {tab === "friends" && (
            <FriendsView friends={friends} requests={requests} buddyProposals={buddyProposals}
              onAccept={acceptRequest} onDecline={declineRequest} onSearch={searchFriends}
              searchResults={searchResults} onSendRequest={sendFriendReq}
              onProposeBuddy={proposeBuddy} onAcceptBuddy={acceptBuddy}
              myHabits={derivedHabits.filter((h) => !h.archived)} />
          )}
          {tab === "rewards" && (
            <RewardsView stars={profile.stars} catalog={cozyCatalog} unlocked={cozyUnlocked}
              achievements={achievements} streaks={streaks} buddyStreak={buddyBest}
              onOpenMystery={() => { const locked = cozyCatalog.filter((c) => !cozyUnlocked.includes(c.id)); const pool = locked.length ? locked : cozyCatalog; if (pool.length) setMysteryReward(pool[Math.floor(Math.random() * pool.length)]); }}
              mysteryAvailable={profile.mystery_available} />
          )}
          {tab === "messages" && (
            <MessagesView friends={friends} unreadMap={unreadMap} activeFriendId={activeFriendId}
              conversation={conversation} onOpenConversation={openConversation}
              onSend={sendChatMessage} onBack={() => setActiveFriendId(null)} />
          )}
          {tab === "profile" && (
            <ProfileView name={profile.display_name} bio={profile.bio} stars={profile.stars} streaks={streaks}
              achievements={achievements} companionStage={profile.companion_stage} settings={profile}
              onToggleSetting={toggleSetting} />
          )}
        </div>
      </div>

      <BottomNav tab={tab} setTab={setTab} unreadCount={unreadCount} requestCount={requests.length} />

      {modalHabit !== undefined && <HabitModal initial={modalHabit} onSave={saveHabit} onDelete={deleteHabit} onClose={() => setModalHabit(undefined)} />}
      {mysteryReward && <MysteryRewardModal reward={mysteryReward} onClose={claimMystery} />}
      {celebrate && <Confetti />}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ROOT: auth gate                                                        */
/* ---------------------------------------------------------------------- */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    api.getSession().then(setSession).catch(() => setSession(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ background: "#FBF7F2" }}>
        <p className="text-sm font-bold animate-pulse" style={{ color: "#8B7A7D", fontFamily: FONT_BODY }}>🌱 Loading…</p>
      </div>
    );
  }
  if (!session) return <AuthPage onAuthed={() => {}} />;
  return <Garden key={session.user.id} session={session} />;
}
