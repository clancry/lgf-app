import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { Colors } from '../theme/colors';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Regime = 'masse' | 'seche' | 'equilibre';
type DayType = 'training' | 'rest' | null;
type SlotSource = 'diy' | 'frigo';

interface Profile {
  id: string;
  first_name?: string;
  regime?: Regime;
  daily_calories?: number;
  meals_per_day?: number;
  training_time?: string;
  weight?: number;
}

interface MealSlot {
  id: string;
  time: string; // "HH:MM"
  type: string;
  label: string;
  source: SlotSource;
  recipeName?: string;
  recipeId?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  completed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TRAINING_TIMES = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '14:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const DIY_SUGGESTIONS: Record<string, string[]> = {
  'Petit-déjeuner':    ['Œufs brouillés + patate douce + avocat', 'Oatmeal banane + beurre de cacahuète', 'Pain complet + 3 œufs + fromage blanc'],
  'Pre-workout':       ['Banane + poignée d\'amandes', 'Toast complet + confiture + yaourt', 'Riz blanc + 2 œufs + sirop d\'érable'],
  'Pre-workout léger': ['Banane + 5 amandes', 'Yaourt nature + miel', 'Fruit + quelques noix de cajou'],
  'Dîner':             ['Salade + 2 œufs durs + riz', 'Poulet grillé + légumes vapeur + quinoa', 'Thon + patate douce + haricots verts'],
  'Dîner léger':       ['Omelette 3 œufs + légumes + fromage blanc', 'Soupe lentilles + pain complet', 'Salade composée + saumon'],
};

function getDIYSuggestion(type: string): string {
  const list = DIY_SUGGESTIONS[type] ?? [`${type} maison`];
  const today = new Date().getDate();
  return list[today % list.length];
}

// Macro ratios by regime
const MACRO_RATIOS: Record<Regime, { protein: number; carbs: number; fat: number }> = {
  masse:     { protein: 0.30, carbs: 0.50, fat: 0.20 },
  seche:     { protein: 0.40, carbs: 0.30, fat: 0.30 },
  equilibre: { protein: 0.30, carbs: 0.40, fat: 0.30 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Slot generation logic
// ─────────────────────────────────────────────────────────────────────────────

interface SlotDef {
  id: string;
  time: string;
  type: string;
  source: SlotSource;
  pct: number; // percentage of total daily calories
  supabaseCategory?: string; // 'repas' | 'snack'
}

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function addMinutes(hhmm: string, minutes: number): string {
  const { h, m } = parseHHMM(hhmm);
  const total = h * 60 + m + minutes;
  const nh = Math.max(0, Math.min(23, Math.floor(total / 60)));
  const nm = ((total % 60) + 60) % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function buildSlotDefs(regime: Regime, dayType: 'training' | 'rest', trainingTime: string): SlotDef[] {
  if (regime === 'masse') {
    if (dayType === 'training') {
      return [
        { id: 'petit_dej',   time: '07:00', type: 'Petit-déjeuner',  source: 'diy',   pct: 0.20 },
        { id: 'collation',   time: '10:00', type: 'Collation matin', source: 'frigo', pct: 0.10, supabaseCategory: 'snack' },
        { id: 'dejeuner',    time: '12:30', type: 'Déjeuner',        source: 'frigo', pct: 0.25, supabaseCategory: 'repas' },
        { id: 'pre_workout', time: addMinutes(trainingTime, -90), type: 'Pre-workout',  source: 'diy',   pct: 0.10 },
        { id: 'post_workout',time: addMinutes(trainingTime, 30),  type: 'Post-workout', source: 'frigo', pct: 0.20, supabaseCategory: 'repas' },
        { id: 'diner',       time: '21:00', type: 'Dîner léger',     source: 'diy',   pct: 0.15 },
      ];
    } else {
      return [
        { id: 'petit_dej',  time: '08:00', type: 'Petit-déjeuner', source: 'diy',   pct: 0.22 },
        { id: 'collation',  time: '10:30', type: 'Collation',      source: 'frigo', pct: 0.12, supabaseCategory: 'snack' },
        { id: 'dejeuner',   time: '13:00', type: 'Déjeuner',       source: 'frigo', pct: 0.28, supabaseCategory: 'repas' },
        { id: 'gouter',     time: '16:30', type: 'Goûter',         source: 'frigo', pct: 0.13, supabaseCategory: 'snack' },
        { id: 'diner',      time: '20:00', type: 'Dîner',          source: 'diy',   pct: 0.25 },
      ];
    }
  }

  if (regime === 'seche') {
    if (dayType === 'training') {
      return [
        { id: 'petit_dej',   time: '07:00', type: 'Petit-déjeuner',  source: 'diy',   pct: 0.20 },
        { id: 'dejeuner',    time: '12:00', type: 'Déjeuner',        source: 'frigo', pct: 0.30, supabaseCategory: 'repas' },
        { id: 'pre_workout', time: addMinutes(trainingTime, -60), type: 'Pre-workout',  source: 'diy',   pct: 0.10 },
        { id: 'post_workout',time: addMinutes(trainingTime, 30),  type: 'Post-workout', source: 'frigo', pct: 0.25, supabaseCategory: 'repas' },
        { id: 'diner',       time: '20:30', type: 'Dîner léger',     source: 'diy',   pct: 0.15 },
      ];
    } else {
      return [
        { id: 'petit_dej', time: '08:00', type: 'Petit-déjeuner', source: 'diy',   pct: 0.25 },
        { id: 'dejeuner',  time: '12:30', type: 'Déjeuner',       source: 'frigo', pct: 0.30, supabaseCategory: 'repas' },
        { id: 'collation', time: '16:00', type: 'Collation',      source: 'frigo', pct: 0.15, supabaseCategory: 'snack' },
        { id: 'diner',     time: '19:30', type: 'Dîner',          source: 'diy',   pct: 0.30 },
      ];
    }
  }

  // equilibre (default)
  if (dayType === 'training') {
    return [
      { id: 'petit_dej',   time: '07:30', type: 'Petit-déjeuner',    source: 'diy',   pct: 0.22 },
      { id: 'dejeuner',    time: '12:00', type: 'Déjeuner',          source: 'frigo', pct: 0.28, supabaseCategory: 'repas' },
      { id: 'pre_workout', time: addMinutes(trainingTime, -60), type: 'Pre-workout léger', source: 'diy',   pct: 0.08 },
      { id: 'post_workout',time: addMinutes(trainingTime, 30),  type: 'Post-workout',      source: 'frigo', pct: 0.22, supabaseCategory: 'repas' },
      { id: 'diner',       time: '20:00', type: 'Dîner',             source: 'diy',   pct: 0.20 },
    ];
  } else {
    return [
      { id: 'petit_dej', time: '08:00', type: 'Petit-déjeuner', source: 'diy',   pct: 0.25 },
      { id: 'dejeuner',  time: '12:30', type: 'Déjeuner',       source: 'frigo', pct: 0.30, supabaseCategory: 'repas' },
      { id: 'gouter',    time: '16:30', type: 'Goûter',         source: 'frigo', pct: 0.15, supabaseCategory: 'snack' },
      { id: 'diner',     time: '20:00', type: 'Dîner',          source: 'diy',   pct: 0.30 },
    ];
  }
}

function calcMacros(calories: number, regime: Regime) {
  const r = MACRO_RATIOS[regime];
  return {
    protein: Math.round((calories * r.protein) / 4),
    carbs:   Math.round((calories * r.carbs)   / 4),
    fat:     Math.round((calories * r.fat)      / 9),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isSlotPast(slotTime: string): boolean {
  return slotTime < currentTimeHHMM();
}

function isSlotCurrent(slotTime: string, slots: MealSlot[], idx: number): boolean {
  const current = currentTimeHHMM();
  if (slotTime > current) return false;
  const next = slots[idx + 1];
  if (!next) return slotTime <= current;
  return slotTime <= current && next.time > current;
}

function formatDisplayTime(hhmm: string): string {
  const { h, m } = parseHHMM(hhmm);
  return m === 0 ? `${h}h00` : `${h}h${String(m).padStart(2, '0')}`;
}

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface DayPlanScreenProps {
  session: Session | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DayPlanScreen({ session }: DayPlanScreenProps) {
  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── Flow state ─────────────────────────────────────────────────────────────
  const [dayType, setDayType]               = useState<DayType>(null);
  const [trainingTime, setTrainingTime]     = useState<string>('18:00');
  const [showTimePicker, setShowTimePicker] = useState(false);

  // ── Plan state ─────────────────────────────────────────────────────────────
  const [slots, setSlots]               = useState<MealSlot[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loadingPlan, setLoadingPlan]   = useState(false);

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) { setLoadingProfile(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, regime, daily_calories, meals_per_day, training_time, weight')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data as Profile);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [session]);

  // ── Load recipe from Supabase for a frigo slot ─────────────────────────────
  const fetchFrigoRecipe = useCallback(
    async (category: string, regime: Regime): Promise<{ name: string; id: string; calories: number; protein: number; carbs: number; fat: number } | null> => {
      const { data } = await supabase
        .from('recipes')
        .select('id, name, calories, protein, carbs, fat')
        .eq('regime', regime)
        .eq('category', category)
        .order('likes', { ascending: false })
        .limit(1);
      if (data && data.length > 0) return data[0];
      return null;
    },
    [],
  );

  // ── Build plan ─────────────────────────────────────────────────────────────
  const buildPlan = useCallback(
    async (type: 'training' | 'rest', time: string) => {
      if (!profile) return;
      setLoadingPlan(true);

      const regime      = (profile.regime ?? 'equilibre') as Regime;
      const totalCal    = profile.daily_calories ?? 2000;
      const slotDefs    = buildSlotDefs(regime, type, time);

      const built: MealSlot[] = await Promise.all(
        slotDefs.map(async (def) => {
          const slotCal = Math.round(totalCal * def.pct);
          const macros  = calcMacros(slotCal, regime);

          let recipeName: string | undefined;
          let recipeId: string | undefined;
          let calories = slotCal;
          let protein  = macros.protein;
          let carbs    = macros.carbs;
          let fat      = macros.fat;

          if (def.source === 'frigo' && def.supabaseCategory) {
            const recipe = await fetchFrigoRecipe(def.supabaseCategory, regime);
            if (recipe) {
              recipeName = recipe.name;
              recipeId   = recipe.id;
              // Use recipe's actual macros if available, else calculated
              calories = recipe.calories ?? slotCal;
              protein  = recipe.protein  ?? macros.protein;
              carbs    = recipe.carbs    ?? macros.carbs;
              fat      = recipe.fat      ?? macros.fat;
            }
          } else {
            recipeName = getDIYSuggestion(def.type);
          }

          return {
            id:          def.id,
            time:        def.time,
            type:        def.type,
            label:       def.source === 'frigo' ? '🧊 Frigo La Gamelle' : '🏠 Maison',
            source:      def.source,
            recipeName,
            recipeId,
            calories,
            protein,
            carbs,
            fat,
            completed:   false,
          };
        }),
      );

      // Sort by time ascending
      built.sort((a, b) => (a.time < b.time ? -1 : 1));
      setSlots(built);
      setCompletedIds(new Set());
      setLoadingPlan(false);
    },
    [profile, fetchFrigoRecipe],
  );

  // ── Toggle a slot as completed ─────────────────────────────────────────────
  const toggleSlot = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const completedSlots  = slots.filter((s) => completedIds.has(s.id));
  const totalConsumed   = completedSlots.reduce((acc, s) => acc + s.calories, 0);
  const totalProtein    = completedSlots.reduce((acc, s) => acc + s.protein,  0);
  const totalCarbs      = completedSlots.reduce((acc, s) => acc + s.carbs,    0);
  const totalFat        = completedSlots.reduce((acc, s) => acc + s.fat,      0);

  const dailyCal        = profile?.daily_calories ?? 2000;
  const calPct          = Math.min(totalConsumed / dailyCal, 1);

  const regime          = (profile?.regime ?? 'equilibre') as Regime;
  const dayMacros       = calcMacros(dailyCal, regime);

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Connecte-toi pour voir ton plan du jour.</Text>
      </View>
    );
  }

  // ── Phase 1: Questionnaire ─────────────────────────────────────────────────
  if (dayType === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.questionnaireScroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.qHeader}>
            <Text style={styles.qGreeting}>
              Bonjour <Text style={styles.qName}>{profile?.first_name ?? 'toi'} 👋</Text>
            </Text>
            <Text style={styles.qDate}>{todayFR()}</Text>
          </View>

          <Text style={styles.qTitle}>C'est quoi le programme aujourd'hui ?</Text>

          {/* Training card */}
          <TouchableOpacity
            style={[styles.dayCard, styles.dayCardTraining]}
            activeOpacity={0.85}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dayCardEmoji}>🏋️</Text>
            <Text style={styles.dayCardTitle}>Jour d'entraînement</Text>
            <Text style={styles.dayCardSub}>Choisis l'heure de ta séance</Text>
          </TouchableOpacity>

          {/* Time picker */}
          {showTimePicker && (
            <View style={styles.timePickerContainer}>
              <Text style={styles.timePickerLabel}>Heure d'entraînement</Text>
              <View style={styles.timeGrid}>
                {TRAINING_TIMES.map((t) => {
                  const selected = t === trainingTime;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeChip, selected && styles.timeChipSelected]}
                      onPress={() => setTrainingTime(t)}
                    >
                      <Text style={[styles.timeChipText, selected && styles.timeChipTextSelected]}>
                        {formatDisplayTime(t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  setDayType('training');
                  setShowTimePicker(false);
                  buildPlan('training', trainingTime);
                }}
              >
                <Text style={styles.confirmButtonText}>Confirmer — {formatDisplayTime(trainingTime)}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Rest card */}
          <TouchableOpacity
            style={[styles.dayCard, styles.dayCardRest]}
            activeOpacity={0.85}
            onPress={() => {
              setDayType('rest');
              buildPlan('rest', trainingTime);
            }}
          >
            <Text style={styles.dayCardEmoji}>🛋️</Text>
            <Text style={styles.dayCardTitle}>Jour de repos</Text>
            <Text style={styles.dayCardSub}>Plan récupération & maintenance</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phase 2 + 3: Plan + progression ───────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>

        {/* ── Sticky header: progression ──────────────────────────────────── */}
        <View style={styles.progressHeader}>
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.progressTitle}>Plan du jour</Text>
              <Text style={styles.progressSub}>
                {dayType === 'training'
                  ? `🏋️ Entraînement à ${formatDisplayTime(trainingTime)}`
                  : '🛋️ Jour de repos'}
              </Text>
            </View>

            {/* Calorie ring */}
            <View style={styles.calorieRing}>
              <View style={styles.calorieRingInner}>
                <Text style={styles.calorieRingVal}>{totalConsumed}</Text>
                <Text style={styles.calorieRingGoal}>/ {dailyCal} kcal</Text>
              </View>
            </View>
          </View>

          {/* Macro bars */}
          <View style={styles.macroRow}>
            {[
              { label: 'P', consumed: totalProtein, goal: dayMacros.protein, color: Colors.proteines },
              { label: 'G', consumed: totalCarbs,   goal: dayMacros.carbs,   color: Colors.glucides  },
              { label: 'L', consumed: totalFat,     goal: dayMacros.fat,     color: Colors.lipides   },
            ].map(({ label, consumed, goal, color }) => (
              <View key={label} style={styles.macroItem}>
                <View style={styles.macroItemHeader}>
                  <Text style={[styles.macroItemLabel, { color }]}>{label}</Text>
                  <Text style={styles.macroItemVal}>{consumed}g</Text>
                </View>
                <View style={styles.macroTrack}>
                  <View
                    style={[
                      styles.macroFill,
                      { width: `${Math.min((consumed / Math.max(goal, 1)) * 100, 100)}%` as any, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.macroGoalText}>/ {goal}g</Text>
              </View>
            ))}
          </View>

          {/* Calorie bar */}
          <View style={styles.calBarTrack}>
            <View style={[styles.calBarFill, { width: `${Math.round(calPct * 100)}%` as any }]} />
          </View>
        </View>

        {/* ── Loading plan ────────────────────────────────────────────────── */}
        {loadingPlan ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.darkGreen} />
            <Text style={styles.loadingText}>Génération de ton plan...</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {slots.map((slot, idx) => {
              const isCompleted = completedIds.has(slot.id);
              const isPast      = isSlotPast(slot.time);
              const isCurrent   = isSlotCurrent(slot.time, slots, idx);
              const isLast      = idx === slots.length - 1;

              return (
                <View key={slot.id} style={styles.slotRow}>
                  {/* Timeline line + dot */}
                  <View style={styles.timelineColumn}>
                    <View
                      style={[
                        styles.timelineDot,
                        isCompleted && styles.timelineDotCompleted,
                        isCurrent   && styles.timelineDotCurrent,
                      ]}
                    />
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  {/* Slot card */}
                  <View style={styles.slotCardWrapper}>
                    <View
                      style={[
                        styles.slotCard,
                        isCompleted && styles.slotCardCompleted,
                        isCurrent   && styles.slotCardCurrent,
                      ]}
                    >
                      {/* Time + type + checkbox */}
                      <View style={styles.slotCardHeader}>
                        <View style={styles.slotCardHeaderLeft}>
                          <Text style={[styles.slotTime, isCompleted && styles.slotTimeCompleted]}>
                            {formatDisplayTime(slot.time)}
                          </Text>
                          <Text style={[styles.slotType, isCompleted && styles.slotTypeCompleted]}>
                            {slot.type}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
                          onPress={() => toggleSlot(slot.id)}
                          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        >
                          {isCompleted && <Text style={styles.checkboxTick}>✓</Text>}
                        </TouchableOpacity>
                      </View>

                      {/* Recipe / suggestion */}
                      <View style={styles.slotRecipeRow}>
                        <Text style={styles.slotSourceLabel}>{slot.label}</Text>
                        <Text
                          style={[styles.slotRecipeName, isCompleted && styles.slotRecipeNameCompleted]}
                          numberOfLines={2}
                        >
                          {slot.recipeName ?? slot.type}
                        </Text>
                      </View>

                      {/* Macros */}
                      <View style={styles.slotMacros}>
                        <MacroPill label="P" value={slot.protein} color={Colors.proteines} strikethrough={isCompleted} />
                        <MacroPill label="G" value={slot.carbs}   color={Colors.glucides}  strikethrough={isCompleted} />
                        <MacroPill label="L" value={slot.fat}     color={Colors.lipides}   strikethrough={isCompleted} />
                        <View style={styles.calPill}>
                          <Text style={[styles.calPillText, isCompleted && styles.calPillTextCompleted]}>
                            {slot.calories} kcal
                          </Text>
                        </View>
                      </View>

                      {/* Current badge */}
                      {isCurrent && !isCompleted && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>⏰ Maintenant</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Footer: Modifier le plan ─────────────────────────────────────── */}
        {!loadingPlan && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.modifyButton}
              onPress={() => {
                setDayType(null);
                setSlots([]);
                setCompletedIds(new Set());
                setShowTimePicker(false);
              }}
            >
              <Text style={styles.modifyButtonText}>✏️ Modifier le plan</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface MacroPillProps {
  label: string;
  value: number;
  color: string;
  strikethrough?: boolean;
}

function MacroPill({ label, value, color, strikethrough }: MacroPillProps) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Text style={[pillStyles.label, { color }, strikethrough && pillStyles.strikethrough]}>
        {label} {value}g
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // ── Questionnaire ─────────────────────────────────────────────────────────
  questionnaireScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  qHeader: {
    marginBottom: 28,
    marginTop: 8,
  },
  qGreeting: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  qName: {
    color: Colors.darkGreen,
    fontWeight: '800',
  },
  qDate: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  qTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 20,
    letterSpacing: 0.2,
  },

  // Day cards
  dayCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  dayCardTraining: {
    backgroundColor: Colors.darkGreen,
  },
  dayCardRest: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dayCardEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  dayCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  dayCardSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },

  // When rest card (white bg), override text colors
  // (We use inline styles via children rather than overriding here)

  // Time picker
  timePickerContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  timeChipSelected: {
    backgroundColor: Colors.darkGreen,
    borderColor: Colors.darkGreen,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  timeChipTextSelected: {
    color: Colors.white,
  },
  confirmButton: {
    backgroundColor: Colors.lime,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.darkGreen,
  },

  // ── Sticky progress header ─────────────────────────────────────────────────
  progressHeader: {
    backgroundColor: Colors.darkGreen,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  progressSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Calorie ring
  calorieRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: Colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calorieRingInner: {
    alignItems: 'center',
  },
  calorieRingVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  calorieRingGoal: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },

  // Macro bars in header
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  macroItem: {
    flex: 1,
  },
  macroItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  macroItemLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  macroItemVal: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
  },
  macroTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%' as any,
    borderRadius: 3,
  },
  macroGoalText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // Calorie bar
  calBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  calBarFill: {
    height: '100%' as any,
    backgroundColor: Colors.lime,
    borderRadius: 2,
  },

  // ── Timeline ───────────────────────────────────────────────────────────────
  timeline: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },

  // Left column: dot + line
  timelineColumn: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.white,
    marginTop: 18,
    zIndex: 1,
  },
  timelineDotCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  timelineDotCurrent: {
    backgroundColor: Colors.lime,
    borderColor: Colors.darkGreen,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
    alignSelf: 'center',
    minHeight: 16,
  },

  // Slot card
  slotCardWrapper: {
    flex: 1,
    paddingBottom: 14,
  },
  slotCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  slotCardCompleted: {
    backgroundColor: '#F0FBF4',
    opacity: 0.85,
  },
  slotCardCurrent: {
    borderWidth: 2,
    borderColor: Colors.lime,
    shadowColor: Colors.lime,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  // Header row of slot
  slotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  slotCardHeaderLeft: {
    flex: 1,
  },
  slotTime: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.darkGreen,
  },
  slotTimeCompleted: {
    color: Colors.success,
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  slotType: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotTypeCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },

  // Checkbox
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkboxTick: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // Recipe
  slotRecipeRow: {
    marginBottom: 10,
  },
  slotSourceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  slotRecipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  slotRecipeNameCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },

  // Macros in slot
  slotMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  calPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  calPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  calPillTextCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },

  // Current badge
  currentBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: Colors.lime + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.darkGreen,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  modifyButton: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  modifyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
