import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';
import { CoachMode, COACH_MODES } from '../lib/coach-modes';
import MealLogModal, { LoggedMeal } from '../components/MealLogModal';
import BreakfastCard from '../components/BreakfastCard';
import { PremiumBadge, PremiumPaywall } from '../components/PremiumGate';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardScreenProps {
  session: Session | null;
  onCheatMeal?: () => void;
  onCoachMode?: () => void;
  onProfile?: () => void;
}

interface Profile {
  first_name?: string;
  regime?: string;
  daily_calories?: number;
  meals_per_day?: number;
  training_time?: string;
  coach_mode?: string;
  wallet_balance?: number;
}

interface MealEntry {
  id: string;
  created_at: string;
  custom_name?: string;
  custom_calories?: number;
  custom_protein?: number;
  custom_carbs?: number;
  custom_fat?: number;
  source?: string;
  meal_type?: string;
}

interface Consumed {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface TimelineSlot {
  label: string;
  time: string;
  completed: boolean;
  isCurrent: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGIME_LABELS: Record<string, string> = {
  masse: '💪 Masse',
  seche: '🔥 Sèche',
  equilibre: '⚖️ Équilibre',
};

const REGIME_COLORS: Record<string, string> = {
  masse: Colors.orange,
  seche: Colors.info,
  equilibre: Colors.success,
};

const DEFAULT_GOALS: Record<string, { kcal: number; protein: number; carbs: number; fat: number }> = {
  masse:    { kcal: 3000, protein: 180, carbs: 320, fat: 80 },
  seche:    { kcal: 1800, protein: 160, carbs: 120, fat: 60 },
  equilibre:{ kcal: 2200, protein: 130, carbs: 250, fat: 70 },
};

const SOURCE_ICONS: Record<string, string> = {
  lgf: '🧊',
  manual: '🏠',
  scan: '📷',
  user_recipe: '📖',
};


// ─── Helpers semaine ──────────────────────────────────────────────────────────

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function getWeekDates(): string[] {
  // Retourne les 7 ISO dates de la semaine courante (lundi → dimanche)
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // lundi = 0
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWeek + i);
    return d.toISOString().split('T')[0] as string;
  });
}

function isoToFR(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

interface DayData {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;  // nb de repas
}

function formatDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

function buildTimeline(
  mealsPerDay: number,
  trainingTime: string | undefined,
  mealEntries: MealEntry[],
): TimelineSlot[] {
  const slots: Array<{ label: string; time: string }> = [];
  const n = Math.max(3, Math.min(mealsPerDay, 6));

  if (n <= 3) {
    slots.push({ label: 'Petit-déj', time: '07:00' });
    slots.push({ label: 'Déjeuner', time: '12:30' });
    slots.push({ label: 'Dîner', time: '19:30' });
  } else if (n === 4) {
    slots.push({ label: 'Petit-déj', time: '07:00' });
    slots.push({ label: 'Collation', time: '10:30' });
    slots.push({ label: 'Déjeuner', time: '13:00' });
    slots.push({ label: 'Dîner', time: '19:30' });
  } else if (n === 5) {
    slots.push({ label: 'Petit-déj', time: '07:00' });
    slots.push({ label: 'Collation', time: '10:30' });
    slots.push({ label: 'Déjeuner', time: '13:00' });
    slots.push({ label: 'Goûter', time: '16:30' });
    slots.push({ label: 'Dîner', time: '20:00' });
  } else {
    slots.push({ label: 'Réveil', time: '06:30' });
    slots.push({ label: 'Petit-déj', time: '07:30' });
    slots.push({ label: 'Collation', time: '10:30' });
    slots.push({ label: 'Déjeuner', time: '13:00' });
    slots.push({ label: 'Goûter', time: '16:30' });
    slots.push({ label: 'Dîner', time: '20:00' });
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  let currentIdx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (currentMinutes >= toMinutes(slots[i]!.time)) {
      currentIdx = i;
      break;
    }
  }

  // Mark completed slots based on number of meals logged
  const completedCount = mealEntries.length;

  return slots.map((slot, idx) => ({
    label: slot.label,
    time: slot.time,
    completed: idx < completedCount,
    isCurrent: idx === currentIdx,
  }));
}

// ─── CalorieRing ──────────────────────────────────────────────────────────────

function CalorieRing({
  consumed,
  goal,
}: {
  consumed: number;
  goal: number;
}) {
  const ratio = goal > 0 ? consumed / goal : 0;
  const isOver = ratio > 1;
  const isNear = ratio >= 0.8 && ratio <= 1;
  const ringColor = isOver ? Colors.orange : isNear ? Colors.lime : Colors.success;
  const remaining = goal - consumed;

  return (
    <View style={ringStyles.wrapper}>
      <View style={[ringStyles.ring, { borderColor: ringColor }]}>
        <Text style={ringStyles.kcalValue}>{consumed}</Text>
        <Text style={ringStyles.kcalUnit}>kcal</Text>
        <Text style={ringStyles.kcalGoal}>/ {goal}</Text>
      </View>
      <Text style={[ringStyles.label, { color: isOver ? Colors.orange : Colors.success }]}>
        {isOver
          ? `+${Math.abs(remaining)} kcal en excès`
          : `${Math.max(0, remaining)} kcal restants`}
      </Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 8 },
  ring: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  kcalValue: { fontSize: 36, fontWeight: '900', color: Colors.textPrimary },
  kcalUnit: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  kcalGoal: { fontSize: 11, color: Colors.textMuted },
  label: { fontSize: 13, fontWeight: '700' },
});

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <View style={macroStyles.row}>
      <Text style={macroStyles.label}>{label}</Text>
      <View style={macroStyles.track}>
        <View style={[macroStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={macroStyles.value}>
        {value}g <Text style={macroStyles.goal}>/ {goal}g</Text>
      </Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { width: 18, fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  value: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary, minWidth: 68, textAlign: 'right' },
  goal: { fontWeight: '400', color: Colors.textMuted },
});

// ─── TimelineSlotCard ─────────────────────────────────────────────────────────

function TimelineSlotCard({
  slot,
  onPress,
}: {
  slot: TimelineSlot;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        tlStyles.card,
        slot.completed && tlStyles.cardDone,
        slot.isCurrent && tlStyles.cardCurrent,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[tlStyles.time, slot.isCurrent && tlStyles.timeCurrent]}>
        {slot.time}
      </Text>
      <Text style={[tlStyles.label, slot.isCurrent && tlStyles.labelCurrent]} numberOfLines={2}>
        {slot.label}
      </Text>
      {slot.completed && <Text style={tlStyles.check}>✓</Text>}
    </TouchableOpacity>
  );
}

const tlStyles = StyleSheet.create({
  card: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 2,
  },
  cardDone: { backgroundColor: Colors.success + '25', borderWidth: 1.5, borderColor: Colors.success },
  cardCurrent: { borderWidth: 2, borderColor: Colors.lime, backgroundColor: Colors.lime + '15' },
  time: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  timeCurrent: { color: Colors.darkGreen },
  label: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  labelCurrent: { color: Colors.darkGreen, fontWeight: '800' },
  check: { fontSize: 14, color: Colors.success, fontWeight: '800' },
});

// ─── MealRow ─────────────────────────────────────────────────────────────────

function MealRow({
  meal,
  onDelete,
}: {
  meal: MealEntry;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={mealStyles.row}>
      <Text style={mealStyles.icon}>
        {SOURCE_ICONS[meal.source ?? 'manual'] ?? '🍽️'}
      </Text>
      <View style={mealStyles.info}>
        <Text style={mealStyles.name} numberOfLines={1}>
          {meal.custom_name ?? 'Repas'}
        </Text>
        <Text style={mealStyles.time}>{formatTime(meal.created_at)}</Text>
      </View>
      <Text style={mealStyles.kcal}>{meal.custom_calories ?? 0} kcal</Text>
      <TouchableOpacity
        style={mealStyles.delBtn}
        onPress={() => onDelete(meal.id)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Text style={mealStyles.delIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
}

const mealStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  kcal: { fontSize: 13, fontWeight: '700', color: Colors.darkGreen },
  delBtn: { padding: 4 },
  delIcon: { fontSize: 16 },
});

// ─── DashboardScreen ─────────────────────────────────────────────────────────

export default function DashboardScreen({
  session,
  onCheatMeal,
  onCoachMode,
  onProfile,
}: DashboardScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [consumed, setConsumed] = useState<Consumed>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSlotType, setModalSlotType] = useState('custom');
  const [streak, setStreak] = useState(0);
  const [fitPoints, setFitPoints] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [weekData, setWeekData] = useState<Record<string, DayData>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);  // ISO date sélectionnée

  // Floating +kcal animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const [floatKcal, setFloatKcal] = useState(0);

  const goals = DEFAULT_GOALS[profile?.regime ?? 'equilibre'] ?? DEFAULT_GOALS.equilibre!;
  const kcalGoal = profile?.daily_calories ?? goals.kcal;
  const macroGoals = { protein: goals.protein, carbs: goals.carbs, fat: goals.fat };

  // ─── Load profile & today's meals ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    try {
      const weekDates = getWeekDates();
      const [profileRes, mealsRes, streakRes, weekRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, regime, daily_calories, meals_per_day, training_time, coach_mode, wallet_balance')
          .eq('id', session.user.id)
          .single(),
        supabase
          .from('meal_plans')
          .select('id, created_at, custom_name, custom_calories, custom_protein, custom_carbs, custom_fat, source, meal_type')
          .eq('user_id', session.user.id)
          .eq('date', getTodayISO())
          .order('created_at'),
        supabase
          .from('quiz_streaks')
          .select('current_streak')
          .eq('user_id', session.user.id)
          .single(),
        supabase
          .from('meal_plans')
          .select('date, custom_calories, custom_protein, custom_carbs, custom_fat')
          .eq('user_id', session.user.id)
          .eq('is_completed', true)
          .gte('date', weekDates[0]!)
          .lte('date', weekDates[6]!),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);

      // Agréger les données par jour
      const wData: Record<string, DayData> = {};
      weekDates.forEach(d => { wData[d] = { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }; });
      ((weekRes.data ?? []) as any[]).forEach((row) => {
        const d = row.date as string;
        if (wData[d]) {
          wData[d].kcal    += row.custom_calories ?? 0;
          wData[d].protein += row.custom_protein  ?? 0;
          wData[d].carbs   += row.custom_carbs    ?? 0;
          wData[d].fat     += row.custom_fat      ?? 0;
          wData[d].count   += 1;
        }
      });
      setWeekData(wData);
      if (streakRes.data) {
        const s = streakRes.data.current_streak ?? 0;
        setStreak(s);
        setFitPoints(s * 15); // 15 pts par jour de streak
      }

      const mealData = (mealsRes.data ?? []) as MealEntry[];
      setMeals(mealData);
      recalcConsumed(mealData);
    } catch (err) {
      if (Platform.OS === 'web') console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Recalculate consumed totals ────────────────────────────────────────────

  function recalcConsumed(mealList: MealEntry[]) {
    const totals = mealList.reduce(
      (acc, m) => ({
        kcal: acc.kcal + (m.custom_calories ?? 0),
        protein: acc.protein + (m.custom_protein ?? 0),
        carbs: acc.carbs + (m.custom_carbs ?? 0),
        fat: acc.fat + (m.custom_fat ?? 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    setConsumed(totals);
  }

  // ─── Floating +kcal animation ───────────────────────────────────────────────

  function triggerFloatAnim(kcal: number) {
    setFloatKcal(kcal);
    floatAnim.setValue(0);
    floatOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(floatAnim, { toValue: -60, duration: 1200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(floatOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }

  // ─── Handle meal confirmation ───────────────────────────────────────────────

  const handleMealConfirm = async (meal: LoggedMeal) => {
    if (!session?.user) return;

    try {
      const { data, error } = await supabase.from('meal_plans').insert({
        user_id: session.user.id,
        date: getTodayISO(),
        meal_type: 'custom',
        is_completed: true,
        custom_name: meal.name,
        custom_calories: meal.calories,
        custom_protein: meal.protein,
        custom_carbs: meal.carbs,
        custom_fat: meal.fat,
        source: meal.source,
      }).select().single();

      // Qu'il y ait une erreur ou non, faire une mise à jour optimiste immédiate
      const newEntry: MealEntry = {
        id: data?.id ?? String(Date.now()),
        created_at: data?.created_at ?? new Date().toISOString(),
        custom_name: meal.name,
        custom_calories: meal.calories ?? 0,
        custom_protein: meal.protein ?? 0,
        custom_carbs: meal.carbs ?? 0,
        custom_fat: meal.fat ?? 0,
        source: meal.source,
        meal_type: 'custom',
      };
      const updated = [...meals, newEntry];
      setMeals(updated);
      recalcConsumed(updated);
      triggerFloatAnim(meal.calories);
    } catch (err) {
      if (Platform.OS === 'web') console.error('Insert meal error:', err);
      // Optimistic update even if insert fails
      const optimistic: MealEntry = {
        id: String(Date.now()),
        created_at: new Date().toISOString(),
        custom_name: meal.name,
        custom_calories: meal.calories,
        custom_protein: meal.protein,
        custom_carbs: meal.carbs,
        custom_fat: meal.fat,
        source: meal.source,
        meal_type: 'custom',
      };
      const updated = [...meals, optimistic];
      setMeals(updated);
      recalcConsumed(updated);
      triggerFloatAnim(meal.calories);
    }
  };

  // ─── Delete meal ────────────────────────────────────────────────────────────

  const handleDeleteMeal = async (id: string) => {
    const updated = meals.filter((m) => m.id !== id);
    setMeals(updated);
    recalcConsumed(updated);
    try {
      await supabase.from('meal_plans').delete().eq('id', id);
    } catch (err) {
      if (Platform.OS === 'web') console.error('Delete meal error:', err);
    }
  };

  // ─── Derived values ─────────────────────────────────────────────────────────

  const regime = profile?.regime ?? 'equilibre';
  const firstName = profile?.first_name ?? '';
  const coachMode = (profile?.coach_mode as CoachMode) ?? 'soft';
  const coachConfig = COACH_MODES.find((c) => c.id === coachMode);
  const mealsPerDay = profile?.meals_per_day ?? (regime === 'masse' ? 6 : regime === 'seche' ? 5 : 4);
  const timeline = buildTimeline(mealsPerDay, profile?.training_time, meals);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.lime}
          />
        }
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {/* Avatar cliquable → Profil */}
            <TouchableOpacity onPress={() => onProfile?.()} style={styles.avatarRow} activeOpacity={0.8}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {firstName ? firstName.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              <View>
                <Text style={styles.greeting}>
                  Salut {firstName ? `${firstName} ` : ''}👋
                </Text>
                <Text style={styles.date}>{formatDate()}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.headerBadges}>
              <View style={styles.fitPointsBadge}>
                <Text style={styles.fitPointsText}>⚡ {fitPoints} pts</Text>
              </View>
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {streak}j</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerChips}>
            {/* Regime badge */}
            <View style={[styles.chip, { backgroundColor: (REGIME_COLORS[regime] ?? Colors.success) + '30', borderColor: REGIME_COLORS[regime] ?? Colors.success }]}>
              <Text style={[styles.chipText, { color: REGIME_COLORS[regime] ?? Colors.success }]}>
                {REGIME_LABELS[regime] ?? regime}
              </Text>
            </View>
            {/* Coach mode badge */}
            <View style={[styles.chip, { backgroundColor: (coachConfig?.color ?? Colors.darkGreen) + '25', borderColor: coachConfig?.color ?? Colors.darkGreen }]}>
              <Text style={[styles.chipText, { color: coachConfig?.color ?? Colors.darkGreen }]}>
                {coachConfig?.emoji} {coachConfig?.name ?? 'Soft'}
              </Text>
            </View>
          {/* Badge Premium si pas abonné */}
            {!profile?.is_premium && (
              <TouchableOpacity
                onPress={() => setShowPaywall(true)}
                style={styles.premiumChip}
                activeOpacity={0.85}
              >
                <Text style={styles.premiumChipText}>👑 1 mois gratuit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── ANNEAU CALORIES ── */}
        <View style={styles.ringSection}>
          <CalorieRing consumed={consumed.kcal} goal={kcalGoal} />

          {/* Floating +kcal */}
          <Animated.View
            style={[
              styles.floatKcal,
              { transform: [{ translateY: floatAnim }], opacity: floatOpacity },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.floatKcalText}>+{floatKcal} kcal</Text>
          </Animated.View>

          {/* Macro bars */}
          <View style={styles.macroBarsContainer}>
            <MacroBar label="P" value={Math.round(consumed.protein)} goal={macroGoals.protein} color={Colors.proteines} />
            <MacroBar label="G" value={Math.round(consumed.carbs)} goal={macroGoals.carbs} color={Colors.glucides} />
            <MacroBar label="L" value={Math.round(consumed.fat)} goal={macroGoals.fat} color={Colors.lipides} />
          </View>
        </View>

        {/* ── BOUTON J'AI MANGÉ ── */}
        <View style={styles.px20}>
          <TouchableOpacity
            style={styles.logBtn}
            onPress={() => { setModalSlotType('custom'); setModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.logBtnText}>+ J'ai mangé quelque chose</Text>
          </TouchableOpacity>
        </View>

        {/* ── WIDGET SEMAINE ── */}
        <View style={styles.section}>
          <View style={styles.weekHeader}>
            <Text style={styles.sectionTitle}>Ma semaine</Text>
            <Text style={styles.weekPct}>
              {(() => {
                const weekDates = getWeekDates();
                const total = weekDates.reduce((s, d) => s + (weekData[d]?.kcal ?? 0), 0);
                const goal  = kcalGoal * 7;
                return `${Math.round((total / goal) * 100)}% objectif`;
              })()}
            </Text>
          </View>

          {/* Barres L→D */}
          <View style={styles.weekGrid}>
            {getWeekDates().map((date, idx) => {
              const day    = weekData[date];
              const pct    = day ? Math.min((day.kcal / kcalGoal) * 100, 100) : 0;
              const isToday   = date === getTodayISO();
              const isSelected = date === selectedDay;
              const color = pct >= 90 ? Colors.lime : pct >= 60 ? Colors.success : Colors.border;
              return (
                <TouchableOpacity
                  key={date}
                  style={styles.weekDayCol}
                  onPress={() => setSelectedDay(isSelected ? null : date)}
                  activeOpacity={0.75}
                >
                  {/* Barre */}
                  <View style={styles.weekBarTrack}>
                    <View style={[
                      styles.weekBarFill,
                      { height: `${Math.max(pct, 4)}%` as any, backgroundColor: color },
                    ]} />
                  </View>
                  {/* % */}
                  <Text style={[styles.weekPctLabel, isToday && styles.weekPctLabelToday]}>
                    {pct > 0 ? `${Math.round(pct)}%` : '–'}
                  </Text>
                  {/* Jour */}
                  <View style={[
                    styles.weekDayBadge,
                    isToday && styles.weekDayBadgeToday,
                    isSelected && styles.weekDayBadgeSelected,
                  ]}>
                    <Text style={[
                      styles.weekDayText,
                      isToday && styles.weekDayTextToday,
                      isSelected && styles.weekDayTextSelected,
                    ]}>
                      {JOURS_COURTS[idx]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Détail du jour sélectionné */}
          {selectedDay && weekData[selectedDay] && (
            <View style={styles.weekDetail}>
              <View style={styles.weekDetailHeader}>
                <Text style={styles.weekDetailDate}>{isoToFR(selectedDay)}</Text>
                <TouchableOpacity onPress={() => setSelectedDay(null)}>
                  <Text style={styles.weekDetailClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {weekData[selectedDay]!.count === 0 ? (
                <Text style={styles.weekDetailEmpty}>Aucun repas enregistré ce jour.</Text>
              ) : (
                <>
                  <View style={styles.weekDetailRow}>
                    <Text style={styles.weekDetailKcal}>
                      {Math.round(weekData[selectedDay]!.kcal)} kcal
                    </Text>
                    <Text style={styles.weekDetailGoal}>/ {kcalGoal} objectif</Text>
                  </View>
                  <View style={styles.weekDetailMacros}>
                    {[
                      { l: 'P', v: weekData[selectedDay]!.protein, c: Colors.proteines },
                      { l: 'G', v: weekData[selectedDay]!.carbs,   c: Colors.glucides },
                      { l: 'L', v: weekData[selectedDay]!.fat,     c: Colors.lipides },
                    ].map(({ l, v, c }) => (
                      <View key={l} style={[styles.weekMacroPill, { borderColor: c + '50', backgroundColor: c + '15' }]}>
                        <Text style={[styles.weekMacroPillText, { color: c }]}>{l} {Math.round(v)}g</Text>
                      </View>
                    ))}
                    <View style={styles.weekMealsCount}>
                      <Text style={styles.weekMealsCountText}>
                        {weekData[selectedDay]!.count} repas
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* ── REPAS DU JOUR ── */}
        {meals.length > 0 && (
          <View style={[styles.section, styles.card]}>
            <Text style={styles.sectionTitle}>Repas enregistrés</Text>
            {meals.map((meal) => (
              <MealRow key={meal.id} meal={meal} onDelete={handleDeleteMeal} />
            ))}
          </View>
        )}

        {/* ── PETIT-DÉJEUNER (compact) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Petit-déjeuner du jour</Text>
          <View style={styles.breakfastCompact}>
            <BreakfastCard regime={regime} />
          </View>
        </View>

        {/* ── ACTIONS RAPIDES ── */}
        <View style={[styles.section, styles.actionsRow]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDark]}
            onPress={() => onCheatMeal?.()}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnIcon}>🚨</Text>
            <Text style={styles.actionBtnLabel}>STOP Cheat Meal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: (coachConfig?.color ?? Colors.darkGreen) + '20', borderColor: coachConfig?.color ?? Colors.darkGreen, borderWidth: 1.5 }]}
            onPress={() => onCoachMode?.()}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnIcon}>{coachConfig?.emoji ?? '🌱'}</Text>
            <Text style={[styles.actionBtnLabel, { color: coachConfig?.color ?? Colors.darkGreen }]}>
              Mode Coach
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── PREMIUM PAYWALL ── */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribe={async () => { setShowPaywall(false); }}
      />

      {/* ── MODAL ── */}
      <MealLogModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleMealConfirm}
        session={session}
        mealType={modalSlotType}
        regime={regime}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Header
  header: {
    backgroundColor: Colors.darkGreen,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lime, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.darkGreen },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.white },
  date: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2, textTransform: 'capitalize' },
  headerBadges: { alignItems: 'flex-end', gap: 6 },
  fitPointsBadge: {
    backgroundColor: Colors.lime + '25',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.lime + '60',
  },
  fitPointsText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.lime,
  },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  streakText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  headerChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  premiumChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#F59E0B', borderWidth: 0,
  },
  premiumChipText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Ring section
  ringSection: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  macroBarsContainer: { width: '100%', gap: 0 },

  // Float anim
  floatKcal: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: Colors.success,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  floatKcalText: { color: Colors.white, fontWeight: '800', fontSize: 16 },

  // Log button
  px20: { paddingHorizontal: 20, marginTop: 16 },
  logBtn: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },

  // Timeline
  timeline: { gap: 8, paddingRight: 20 },

  // Meals card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginHorizontal: 20,
    marginTop: 20,
  },


  // Semaine
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  weekPct: { fontSize: 12, fontWeight: '700', color: Colors.lime },
  weekGrid: { flexDirection: 'row', gap: 6, height: 140, alignItems: 'flex-end' },
  weekDayCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  weekBarTrack: {
    flex: 1, width: '100%', backgroundColor: Colors.border,
    borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end',
  },
  weekBarFill: { width: '100%', borderRadius: 6, minHeight: 4 },
  weekPctLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
  weekPctLabelToday: { color: Colors.darkGreen, fontWeight: '800' },
  weekDayBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  weekDayBadgeToday: { backgroundColor: Colors.darkGreen },
  weekDayBadgeSelected: { backgroundColor: Colors.lime },
  weekDayText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  weekDayTextToday: { color: Colors.white },
  weekDayTextSelected: { color: Colors.darkGreen },
  weekDetail: {
    marginTop: 14, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  weekDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  weekDetailDate: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  weekDetailClose: { fontSize: 14, color: Colors.textMuted, paddingHorizontal: 4 },
  weekDetailRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 },
  weekDetailKcal: { fontSize: 28, fontWeight: '800', color: Colors.darkGreen },
  weekDetailGoal: { fontSize: 13, color: Colors.textMuted },
  weekDetailEmpty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  weekDetailMacros: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  weekMacroPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  weekMacroPillText: { fontSize: 12, fontWeight: '700' },
  weekMealsCount: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.background },
  weekMealsCountText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  // Breakfast compact (scale down via outer container)
  breakfastCompact: {},

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  actionBtnDark: { backgroundColor: '#1A1A1A' },
  actionBtnIcon: { fontSize: 24 },
  actionBtnLabel: { fontSize: 13, fontWeight: '700', color: Colors.white, textAlign: 'center' },
});
