import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------- */
/*  DATE HELPERS                                                           */
/* ---------------------------------------------------------------------- */
export const todayStr = () => new Date().toISOString().slice(0, 10);

export function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Consecutive-day streak counting back from today (or yesterday, so a streak
// isn't broken until a full day has passed without a log).
export function computeStreak(completedDates) {
  const set = new Set(completedDates);
  let streak = 0;
  let cursor = new Date();
  if (!set.has(todayStr())) cursor.setDate(cursor.getDate() - 1);
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------------------------------------------------------------------- */
/*  AUTH + PROFILE                                                         */
/* ---------------------------------------------------------------------- */
export async function signUp({ email, password, username, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName || username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Looks up the email behind a username (via the get_email_for_username
// function), then signs in normally. Throws the same generic "invalid
// credentials" style error whether the username doesn't exist or the
// password is wrong, so login can't be used to enumerate usernames.
export async function signInWithUsername({ username, password }) {
  const { data: email, error: lookupError } = await supabase.rpc("get_email_for_username", { uname: username });
  if (lookupError) throw lookupError;
  if (!email) throw new Error("Invalid login credentials");
  return signIn({ email, password });
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", user.id).select().single();
  if (error) throw error;
  return data;
}

/* ---------------------------------------------------------------------- */
/*  HABITS                                                                 */
/* ---------------------------------------------------------------------- */
export async function listHabits() {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listHabitLogs(habitIds, days = 30) {
  if (!habitIds.length) return [];
  const since = lastNDays(days)[0];
  const { data, error } = await supabase
    .from("habit_logs")
    .select("habit_id, completed_on")
    .in("habit_id", habitIds)
    .gte("completed_on", since);
  if (error) throw error;
  return data;
}

export async function createHabit({ name, icon, color, frequency }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, name, icon, color, frequency, sort_order: Date.now() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHabit(id, patch) {
  const { data, error } = await supabase.from("habits").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveHabit(id) {
  const { error } = await supabase.from("habits").update({ archived: true }).eq("id", id);
  if (error) throw error;
}

// Permanently removes a task and everything tied to it (completion history,
// any accountability-buddy pairing on it) via the schema's cascade rules.
export async function deleteHabitForever(id) {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
}

// Permanently deletes a task and all of its logged completions (the DB's
// on-delete-cascade on habit_logs handles the log rows automatically).
export async function deleteHabit(id) {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderHabits(orderedIds) {
  // write fresh sort_order values in one batch
  const updates = orderedIds.map((id, i) => supabase.from("habits").update({ sort_order: i }).eq("id", id));
  await Promise.all(updates);
}

export async function completeHabit(habitId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("habit_logs")
    .insert({ habit_id: habitId, user_id: user.id, completed_on: todayStr() });
  if (error) throw error;
}

export async function uncompleteHabit(habitId) {
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("completed_on", todayStr());
  if (error) throw error;
}

/* ---------------------------------------------------------------------- */
/*  FRIENDS                                                                 */
/* ---------------------------------------------------------------------- */
export async function searchProfilesByUsername(query) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_emoji")
    .ilike("username", `%${query}%`)
    .neq("id", user.id)
    .limit(8);
  if (error) throw error;
  return data;
}

export async function sendFriendRequest(receiverId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("friend_requests")
    .insert({ sender_id: user.id, receiver_id: receiverId, status: "pending" });
  if (error) throw error;
}

export async function listIncomingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, created_at, sender:profiles!friend_requests_sender_id_fkey(id, username, display_name, avatar_emoji)")
    .eq("receiver_id", user.id)
    .eq("status", "pending");
  if (error) throw error;
  return data;
}

export async function respondToRequest(requestId, accept) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: req, error: reqErr } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", requestId)
    .select()
    .single();
  if (reqErr) throw reqErr;

  if (accept) {
    const a = req.sender_id < req.receiver_id ? req.sender_id : req.receiver_id;
    const b = req.sender_id < req.receiver_id ? req.receiver_id : req.sender_id;
    const { error } = await supabase.from("friendships").insert({ user_a: a, user_b: b });
    if (error) throw error;
  }
}

export async function listFriends() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("friendships")
    .select(`
      id,
      user_a, user_b,
      profile_a:profiles!friendships_user_a_fkey(id, username, display_name, avatar_emoji),
      profile_b:profiles!friendships_user_b_fkey(id, username, display_name, avatar_emoji)
    `)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
  if (error) throw error;
  return data.map((row) => (row.user_a === user.id ? row.profile_b : row.profile_a));
}

/* ---------------------------------------------------------------------- */
/*  ACCOUNTABILITY BUDDIES                                                 */
/* ---------------------------------------------------------------------- */
export async function listMyBuddyLinks() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accountability_buddies")
    .select("*")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
  if (error) throw error;
  return data;
}

// Step 1: propose pairing on one of MY habits. Only my own habit_id is ever
// sent — the friend's private habit rows are never referenced.
export async function proposeBuddyLink({ myHabitId, myHabitName, friendId }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accountability_buddies")
    .insert({ user_a: user.id, habit_a_id: myHabitId, habit_a_name: myHabitName, user_b: friendId, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Proposals sent TO me, still pending my response.
export async function listIncomingBuddyProposals() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accountability_buddies")
    .select("id, habit_a_name, user_a, proposer:profiles!accountability_buddies_user_a_fkey(id, username, display_name, avatar_emoji)")
    .eq("user_b", user.id)
    .eq("status", "pending");
  if (error) throw error;
  return data;
}

// Step 2: I accept by attaching one of my own habits — flips status to active.
export async function acceptBuddyProposal(linkId, myHabitId) {
  const { data, error } = await supabase
    .from("accountability_buddies")
    .update({ habit_b_id: myHabitId, status: "active", last_buddy_date: null })
    .eq("id", linkId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function bumpBuddyStreak(linkId, newStreak) {
  const { error } = await supabase
    .from("accountability_buddies")
    .update({ buddy_streak: newStreak, last_buddy_date: todayStr() })
    .eq("id", linkId);
  if (error) throw error;
}

/* ---------------------------------------------------------------------- */
/*  MESSAGES                                                               */
/* ---------------------------------------------------------------------- */
export async function listConversation(friendId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendMessage(receiverId, body, isPreset = false) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, receiver_id: receiverId, body, is_preset: isPreset })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(friendId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("sender_id", friendId)
    .eq("receiver_id", user.id)
    .eq("read", false);
  if (error) throw error;
}

export async function listUnreadCounts() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("receiver_id", user.id)
    .eq("read", false);
  if (error) throw error;
  return data.reduce((acc, m) => ({ ...acc, [m.sender_id]: (acc[m.sender_id] || 0) + 1 }), {});
}

// Subscribe to new messages in real time. Returns an unsubscribe function.
export function subscribeToMessages(userId, onInsert) {
  const channel = supabase
    .channel("messages-" + userId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ---------------------------------------------------------------------- */
/*  REWARDS: COZY WORLD + ACHIEVEMENTS                                     */
/* ---------------------------------------------------------------------- */
export async function listCozyCatalog() {
  const { data, error } = await supabase.from("cozy_items").select("*");
  if (error) throw error;
  return data;
}

export async function listMyCozyUnlocks() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("user_cozy_items").select("item_id").eq("user_id", user.id);
  if (error) throw error;
  return data.map((r) => r.item_id);
}

export async function unlockCozyItem(itemId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("user_cozy_items").insert({ user_id: user.id, item_id: itemId });
  if (error) throw error;
}

export async function listAchievementsCatalog() {
  const { data, error } = await supabase.from("achievements").select("*");
  if (error) throw error;
  return data;
}

export async function listMyUnlockedAchievements() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id);
  if (error) throw error;
  return data.map((r) => r.achievement_id);
}

export async function unlockAchievement(achievementId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("user_achievements").insert({ user_id: user.id, achievement_id: achievementId });
  if (error) throw error;
}
