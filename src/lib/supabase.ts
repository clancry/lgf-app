import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://dprhjwrsvixkmpwsxpuk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcmhqd3Jzdml4a21wd3N4cHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNTAwMTAsImV4cCI6MjA5MDkyNjAxMH0.eOhuT5SR9EX3dg85gOYECW9gA5NR7fPcYI7sxk0O1Hk';

// Secure storage adapter for Supabase auth tokens
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Auth helpers ────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}

// ─── Profile helpers ─────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { profile: data, error };
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { profile: data, error };
}

export async function createProfile(userId: string, email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, email, onboarding_done: false, wallet_balance: 0 })
    .select()
    .single();
  return { profile: data, error };
}

// ─── Recipes helpers ─────────────────────────────────────────────────────────

export async function getRecipes(filters?: {
  regime?: string;
  category?: string;
  search?: string;
}) {
  let query = supabase.from('recipes').select('*').order('likes', { ascending: false });

  if (filters?.regime) {
    query = query.eq('regime', filters.regime);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  return { recipes: data, error };
}

export async function getRecipeById(id: string) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();
  return { recipe: data, error };
}

export async function toggleRecipeLike(userId: string, recipeId: string, liked: boolean) {
  if (liked) {
    // Unlike
    const { error } = await supabase
      .from('recipe_likes')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);
    if (!error) {
      await supabase.rpc('decrement_recipe_likes', { recipe_id: recipeId });
    }
    return { error };
  } else {
    // Like
    const { error } = await supabase
      .from('recipe_likes')
      .insert({ user_id: userId, recipe_id: recipeId });
    if (!error) {
      await supabase.rpc('increment_recipe_likes', { recipe_id: recipeId });
    }
    return { error };
  }
}

export async function getUserLikes(userId: string) {
  const { data, error } = await supabase
    .from('recipe_likes')
    .select('recipe_id')
    .eq('user_id', userId);
  return { likes: data?.map((l) => l.recipe_id) ?? [], error };
}

// ─── Arena helpers ───────────────────────────────────────────────────────────

export async function getArenaFeed() {
  const { data, error } = await supabase
    .from('arena_posts')
    .select('*, profiles(first_name, regime, fitness_park)')
    .order('created_at', { ascending: false })
    .limit(50);
  return { posts: data, error };
}

export async function createArenaPost(userId: string, content: string) {
  const { data, error } = await supabase
    .from('arena_posts')
    .insert({ user_id: userId, content })
    .select()
    .single();
  return { post: data, error };
}

export async function getChallenges() {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false });
  return { challenges: data, error };
}

export async function getQuizQuestions() {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .limit(5);
  return { questions: data, error };
}

export async function updateQuizStreak(userId: string, correct: boolean) {
  const { data: existing } = await supabase
    .from('quiz_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const newStreak = correct ? (existing.current_streak ?? 0) + 1 : 0;
    const best = Math.max(newStreak, existing.best_streak ?? 0);
    const { error } = await supabase
      .from('quiz_streaks')
      .update({ current_streak: newStreak, best_streak: best, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return { error };
  } else {
    const { error } = await supabase
      .from('quiz_streaks')
      .insert({ user_id: userId, current_streak: correct ? 1 : 0, best_streak: correct ? 1 : 0 });
    return { error };
  }
}

// ─── Wallet helpers ──────────────────────────────────────────────────────────

export async function getTransactions(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { transactions: data, error };
}

export async function rechargeWallet(userId: string, amount: number) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      amount,
      type: 'recharge',
      status: 'completed',
      description: `Recharge de ${amount}€`,
    })
    .select()
    .single();

  if (!error) {
    await supabase.rpc('increment_wallet_balance', { user_id: userId, amount });
  }

  return { transaction: data, error };
}

// ─── Meal plan helpers ───────────────────────────────────────────────────────

export async function getMealPlan(userId: string, date: string) {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*, recipes(*)')
    .eq('user_id', userId)
    .eq('date', date);
  return { mealPlan: data, error };
}

export async function addToMealPlan(
  userId: string,
  recipeId: string,
  date: string,
  mealType: string
) {
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ user_id: userId, recipe_id: recipeId, date, meal_type: mealType })
    .select()
    .single();
  return { mealPlan: data, error };
}

// ─── Notifications helpers ───────────────────────────────────────────────────

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { notifications: data, error };
}
