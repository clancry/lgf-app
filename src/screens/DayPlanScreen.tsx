import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { Colors } from '../theme/colors';
import type { CoachMode } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getCoachMessage } from '../lib/coach-modes';
import MealLogModal, { type LoggedMeal } from '../components/MealLogModal';

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

function todayISO(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function currentHour(): number {
  return new Date().getHours();
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface DayPlanScreenProps {
  session: Session | null;
  coachMode?: CoachMode; // nouveau
}

// ─────────────────────────────────────────────────────────────────────────────
// EditMealSheet — bottom sheet to modify a slot
// ─────────────────────────────────────────────────────────────────────────────

interface EditMealSheetProps {
  slot: MealSlot;
  onConfirm: (updated: Partial<MealSlot>) => void;
  onClose: () => void;
}

function EditMealSheet({ slot, onConfirm, onClose }: EditMealSheetProps) {
  const [description, setDescription] = useState(slot.recipeName ?? slot.type);
  const [kcal, setKcal]               = useState(String(slot.calories));
  const [protein, setProtein]         = useState(String(slot.protein));
  const [carbs, setCarbs]             = useState(String(slot.carbs));
  const [fat, setFat]                 = useState(String(slot.fat));

  const handleConfirm = () => {
    onConfirm({
      recipeName: description.trim() || slot.type,
      calories:   parseInt(kcal,   10) || slot.calories,
      protein:    parseInt(protein, 10) || slot.protein,
      carbs:      parseInt(carbs,   10) || slot.carbs,
      fat:        parseInt(fat,     10) || slot.fat,
    });
    onClose();
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={sheetStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={sheetStyles.keyboardView}
      >
        <View style={sheetStyles.sheet}>
          {/* Handle */}
          <View style={sheetStyles.handle} />

          <Text style={sheetStyles.title}>Modifier ce repas</Text>
          <Text style={sheetStyles.subtitle}>{slot.type} · {formatDisplayTime(slot.time)}</Text>

          {/* Description */}
          <Text style={sheetStyles.fieldLabel}>Qu'as-tu mangé ?</Text>
          <TextInput
            style={sheetStyles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Ex : Poulet + riz + brocolis..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          {/* Macros row */}
          <View style={sheetStyles.macroGrid}>
            <View style={sheetStyles.macroField}>
              <Text style={[sheetStyles.fieldLabel, { color: Colors.textSecondary }]}>kcal</Text>
              <TextInput
                style={[sheetStyles.input, sheetStyles.macroInput]}
                value={kcal}
                onChangeText={setKcal}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={sheetStyles.macroField}>
              <Text style={[sheetStyles.fieldLabel, { color: Colors.proteines }]}>Prot (g)</Text>
              <TextInput
                style={[sheetStyles.input, sheetStyles.macroInput]}
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={sheetStyles.macroField}>
              <Text style={[sheetStyles.fieldLabel, { color: Colors.glucides }]}>Gluc (g)</Text>
              <TextInput
                style={[sheetStyles.input, sheetStyles.macroInput]}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={sheetStyles.macroField}>
              <Text style={[sheetStyles.fieldLabel, { color: Colors.lipides }]}>Lip (g)</Text>
              <TextInput
                style={[sheetStyles.input, sheetStyles.macroInput]}
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          {/* Buttons */}
          <View style={sheetStyles.buttonRow}>
            <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}>
              <Text style={sheetStyles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sheetStyles.confirmBtn} onPress={handleConfirm}>
              <Text style={sheetStyles.confirmBtnText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  keyboardView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  macroField: {
    flex: 1,
  },
  macroInput: {
    textAlign: 'center',
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.darkGreen,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedCheckbox
// ─────────────────────────────────────────────────────────────────────────────

interface AnimatedCheckboxProps {
  checked: boolean;
  onPress: () => void;
}

function AnimatedCheckbox({ checked, onPress }: AnimatedCheckboxProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // scale 1 → 1.2 → 1.0
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
          { transform: [{ scale }] },
        ]}
      >
        {checked && <Text style={styles.checkboxTick}>✓</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DayPlanScreen({ session, coachMode = 'sportif' }: DayPlanScreenProps) {
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

  // ── Edit sheet state ───────────────────────────────────────────────────────
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);

  // ── MealLogModal state ─────────────────────────────────────────────────────
  const [modalSlot, setModalSlot] = useState<MealSlot | null>(null);
  const [modalEatenAt, setModalEatenAt] = useState<string>('');  // heure réelle du repas

  // ── Summary shown state ────────────────────────────────────────────────────
  const [summaryDismissed, setSummaryDismissed] = useState(false);

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

  // ── Load completed slots for today from Supabase ───────────────────────────
  const loadCompletedSlotsFromDB = useCallback(
    async (builtSlots: MealSlot[]) => {
      if (!session?.user) return;
      try {
        const today = todayISO();
        const { data } = await supabase
          .from('meal_plans')
          .select('custom_slot_id')
          .eq('user_id', session.user.id)
          .eq('date', today)
          .eq('is_completed', true);

        if (data && data.length > 0) {
          // Correspondance par slot_id unique — plus de confusion entre slots du même type
          const completedSlotIds = new Set(
            data
              .map((r: { custom_slot_id: string | null }) => r.custom_slot_id)
              .filter((id): id is string => id !== null),
          );
          setCompletedIds(completedSlotIds);
        }
      } catch (_) {
        // Silently fail — don't block the UI
      }
    },
    [session],
  );

  // ── Save / unsave a slot completion to Supabase ────────────────────────────
  const saveSlotToSupabase = useCallback(
    async (slot: MealSlot, isCompleted: boolean, eatenAt?: string) => {
      if (!session?.user) return;
      try {
        const today = todayISO();
        if (isCompleted) {
          await supabase.from('meal_plans').upsert({
            user_id:         session.user.id,
            date:            today,
            meal_type:       slot.type,
            custom_slot_id:  slot.id,         // clé unique → plus de bug d'encoche
            recipe_id:       slot.recipeId ?? null,
            is_completed:    true,
            custom_time:     eatenAt ?? slot.time,  // heure réelle du repas
          });
        } else {
          await supabase
            .from('meal_plans')
            .update({ is_completed: false })
            .eq('user_id', session.user.id)
            .eq('date', today)
            .eq('custom_slot_id', slot.id);   // filtre par slot_id, pas par type
        }
      } catch (_) {
        // Silently fail
      }
    },
    [session],
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
      setSummaryDismissed(false);
      setLoadingPlan(false);

      // Restore completed slots from DB after plan is built
      await loadCompletedSlotsFromDB(built);
    },
    [profile, fetchFrigoRecipe, loadCompletedSlotsFromDB],
  );

  // ── Toggle a slot as completed ─────────────────────────────────────────────
  // If tapping a completed slot → undo directly (no modal needed)
  // If tapping an uncompleted slot → open MealLogModal first
  const toggleSlot = useCallback((slot: MealSlot) => {
    const isCompleted = completedIds.has(slot.id);
    if (isCompleted) {
      // Undo: mark as incomplete
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        saveSlotToSupabase(slot, false);
        return next;
      });
    } else {
      // Open modal for meal selection
      setModalSlot(slot);
      setModalEatenAt(currentTimeHHMM()); // pré-remplir avec l'heure actuelle
    }
  }, [completedIds, saveSlotToSupabase]);

  // ── Handle meal confirmed from MealLogModal ────────────────────────────────
  const handleMealConfirmed = useCallback(
    (meal: LoggedMeal) => {
      if (!modalSlot) return;
      const slotId = modalSlot.id;

      // Update slot avec valeurs réelles + heure choisie
      const updates: Partial<MealSlot> = {
        recipeName: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        time: modalEatenAt || modalSlot.time,  // heure réelle
        ...(meal.recipeId != null ? { recipeId: String(meal.recipeId) } : {}),
      };
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
      );

      // Mark as completed
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(slotId);
        saveSlotToSupabase({ ...modalSlot, ...updates } as MealSlot, true, modalEatenAt || modalSlot.time);
        return next;
      });

      setModalSlot(null);
    },
    [modalSlot, modalEatenAt, saveSlotToSupabase],
  );

  // ── Update a slot's macros/name (from edit sheet) ──────────────────────────
  const updateSlot = useCallback((slotId: string, updates: Partial<MealSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s)));
  }, []);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const completedSlots  = slots.filter((s) => completedIds.has(s.id));
  const totalConsumed   = completedSlots.reduce((acc, s) => acc + s.calories, 0);
  const totalProtein    = completedSlots.reduce((acc, s) => acc + s.protein,  0);
  const totalCarbs      = completedSlots.reduce((acc, s) => acc + s.carbs,    0);
  const totalFat        = completedSlots.reduce((acc, s) => acc + s.fat,      0);

  const dailyCal        = profile?.daily_calories ?? 2000;
  const calPct          = totalConsumed / Math.max(dailyCal, 1);
  const calPctClamped   = Math.min(calPct, 1);

  const regime          = (profile?.regime ?? 'equilibre') as Regime;
  const dayMacros       = calcMacros(dailyCal, regime);

  // ── Ring color based on consumption ───────────────────────────────────────
  const ringColor = calPct > 1 ? Colors.orange : calPct >= 0.8 ? Colors.lime : Colors.success;

  // ── Show summary condition ─────────────────────────────────────────────────
  const allCompleted = slots.length > 0 && completedIds.size === slots.length;
  const isLateEvening = currentHour() >= 22;
  const showSummary = !summaryDismissed && !loadingPlan && slots.length > 0 && (allCompleted || isLateEvening);

  // ── Coach message for summary ──────────────────────────────────────────────
  const coachSummaryMsg = (() => {
    if (calPct >= 0.9 && calPct <= 1.1) return getCoachMessage(coachMode, 'well_done');
    if (calPct < 0.9) return getCoachMessage(coachMode, 'miss_meal');
    return getCoachMessage(coachMode, 'well_done');
  })();

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
            <Text style={[styles.dayCardTitle, { color: Colors.textPrimary }]}>Jour de repos</Text>
            <Text style={[styles.dayCardSub, { color: Colors.textSecondary }]}>Plan récupération & maintenance</Text>
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
            <View style={[styles.calorieRing, { borderColor: ringColor }]}>
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
                <Text style={styles.macroGoalText}>{consumed}g / {goal}g</Text>
              </View>
            ))}
          </View>

          {/* Calorie bar */}
          <View style={styles.calBarTrack}>
            <View
              style={[
                styles.calBarFill,
                { width: `${Math.round(calPctClamped * 100)}%` as any, backgroundColor: ringColor },
              ]}
            />
          </View>
          <Text style={styles.calBarPct}>
            {Math.round(calPct * 100)}% de l'objectif · {completedSlots.length}/{slots.length} repas cochés
          </Text>
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
                        <AnimatedCheckbox
                          checked={isCompleted}
                          onPress={() => toggleSlot(slot)}
                        />
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

                      {/* Bottom row: Current badge + Modifier button */}
                      <View style={styles.slotFooterRow}>
                        {isCurrent && !isCompleted ? (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>⏰ Maintenant</Text>
                          </View>
                        ) : (
                          <View />
                        )}
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => setEditingSlot(slot)}
                          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                        >
                          <Text style={styles.editBtnText}>✏️ Modifier</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Day summary card ─────────────────────────────────────────────── */}
        {showSummary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Bilan du jour</Text>
              <TouchableOpacity
                onPress={() => setSummaryDismissed(true)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={styles.summaryDismiss}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Score kcal */}
            <View style={styles.summaryScoreRow}>
              {calPct >= 0.9 && calPct <= 1.1 ? (
                <View style={[styles.scoreBadge, { backgroundColor: Colors.success + '20' }]}>
                  <Text style={[styles.scoreBadgeText, { color: Colors.success }]}>
                    ✓ Objectif atteint
                  </Text>
                </View>
              ) : calPct < 0.9 ? (
                <View style={[styles.scoreBadge, { backgroundColor: Colors.warning + '20' }]}>
                  <Text style={[styles.scoreBadgeText, { color: Colors.warning }]}>
                    {dailyCal - totalConsumed} kcal manquants
                  </Text>
                </View>
              ) : (
                <View style={[styles.scoreBadge, { backgroundColor: Colors.orange + '20' }]}>
                  <Text style={[styles.scoreBadgeText, { color: Colors.orange }]}>
                    +{totalConsumed - dailyCal} kcal en excès
                  </Text>
                </View>
              )}
              <Text style={styles.summaryKcalDetail}>
                {totalConsumed} / {dailyCal} kcal
              </Text>
            </View>

            {/* Macros comparison */}
            <View style={styles.summaryMacroGrid}>
              {[
                { label: 'Protéines', consumed: totalProtein, goal: dayMacros.protein, color: Colors.proteines },
                { label: 'Glucides',  consumed: totalCarbs,   goal: dayMacros.carbs,   color: Colors.glucides  },
                { label: 'Lipides',   consumed: totalFat,     goal: dayMacros.fat,     color: Colors.lipides   },
              ].map(({ label, consumed, goal, color }) => (
                <View key={label} style={styles.summaryMacroItem}>
                  <Text style={[styles.summaryMacroLabel, { color }]}>{label}</Text>
                  <Text style={styles.summaryMacroVal}>{consumed}g</Text>
                  <Text style={styles.summaryMacroGoal}>/ {goal}g</Text>
                  <View style={styles.summaryMacroTrack}>
                    <View
                      style={[
                        styles.summaryMacroFill,
                        {
                          width: `${Math.min((consumed / Math.max(goal, 1)) * 100, 100)}%` as any,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Coach message */}
            <View style={styles.coachMsgBox}>
              <Text style={styles.coachMsgText}>💬 {coachSummaryMsg}</Text>
            </View>
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
                setSummaryDismissed(false);
              }}
            >
              <Text style={styles.modifyButtonText}>✏️ Modifier le plan</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Edit meal bottom sheet ───────────────────────────────────────── */}
      {editingSlot && (
        <EditMealSheet
          slot={editingSlot}
          onConfirm={(updates) => updateSlot(editingSlot.id, updates)}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {/* ── MealLogModal ─────────────────────────────────────────────────── */}
      {modalSlot && (
        <MealLogModal
          visible={modalSlot !== null}
          onClose={() => setModalSlot(null)}
          onConfirm={handleMealConfirmed}
          session={session}
          mealType={modalSlot.type}
          regime={profile?.regime ?? 'equilibre'}
          eatenAt={modalEatenAt}
          onEatenAtChange={setModalEatenAt}
          suggestion={
            modalSlot.recipeName
              ? {
                  name: modalSlot.recipeName,
                  calories: modalSlot.calories,
                  protein: modalSlot.protein,
                  carbs: modalSlot.carbs,
                  fat: modalSlot.fat,
                  recipeId: modalSlot.recipeId ? Number(modalSlot.recipeId) : undefined,
                }
              : undefined
          }
        />
      )}
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
    paddingBottom: 14,
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
    marginBottom: 8,
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
  calBarPct: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 5,
    textAlign: 'right',
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
    opacity: 0.9,
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
    marginBottom: 8,
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

  // Slot footer row (badge + edit button)
  slotFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Current badge
  currentBadge: {
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

  // Edit button
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── Day summary card ───────────────────────────────────────────────────────
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryDismiss: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  summaryScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  scoreBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryKcalDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  summaryMacroGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryMacroItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryMacroLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryMacroVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryMacroGoal: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  summaryMacroTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  summaryMacroFill: {
    height: '100%' as any,
    borderRadius: 2,
  },
  coachMsgBox: {
    backgroundColor: Colors.darkGreen + '0D',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.darkGreen + '20',
  },
  coachMsgText: {
    fontSize: 13,
    color: Colors.darkGreen,
    fontWeight: '600',
    lineHeight: 18,
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
