import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, Platform, ActivityIndicator, Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { PremiumGate, PremiumPaywall, PremiumBadge } from '../components/PremiumGate';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type StatsTab = 'macros' | 'poids' | 'perfs' | 'points' | 'scan';
type Period = '7j' | '30j' | '3m';

interface DayStat {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
}

interface WeightEntry {
  id: number;
  date: string;
  weight: number;
  body_fat?: number;
  waist?: number;
}

interface PerfRecord {
  id: number;
  exercise: string;
  value: number;
  unit: string;
  date: string;
}

interface QuizStreak {
  current_streak: number;
  best_streak: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string { return new Date().toISOString().split('T')[0]!; }

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]!;
}

function periodToDays(p: Period): number {
  return p === '7j' ? 7 : p === '30j' ? 30 : 90;
}

function shortDay(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const EXERCICES = [
  'Squat', 'Soulevé de terre', 'Développé couché',
  'Tractions', 'Développé militaire', 'Rowing barre',
  'Curl biceps', 'Dips', 'Leg press', 'Course 5km',
];

// ─── Mini bar chart (pas de dépendance externe) ──────────────────────────────

function MiniBarChart({ data, maxVal, color, labelKey }: {
  data: { label: string; value: number }[];
  maxVal: number;
  color: string;
  labelKey?: string;
}) {
  const barW = Math.max(12, (width - 80) / data.length - 4);
  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.bars}>
        {data.map((d, i) => {
          const h = maxVal > 0 ? Math.max(4, (d.value / maxVal) * 100) : 4;
          return (
            <View key={i} style={[chartStyles.barCol, { width: barW }]}>  
              <View style={chartStyles.barTrack}>
                <View style={[chartStyles.barFill, { height: `${h}%` as any, backgroundColor: color }]} />
              </View>
              <Text style={chartStyles.barLabel}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginTop: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, gap: 2 },
  barCol: { alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, width: '80%', backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 8, color: Colors.textMuted, marginTop: 3, fontWeight: '600' },
});

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={kpiStyles.card}>
      <Text style={kpiStyles.label}>{label}</Text>
      <Text style={[kpiStyles.value, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={kpiStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  label: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 24, fontWeight: '800', color: Colors.darkGreen },
  sub: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatsScreenProps {
  session: Session | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StatsScreen({ session }: StatsScreenProps) {
  const [activeTab, setActiveTab] = useState<StatsTab>('macros');
  const [period, setPeriod] = useState<Period>('7j');
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Data
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightEntry[]>([]);
  const [perfRecords, setPerfRecords] = useState<PerfRecord[]>([]);
  const [streak, setStreak] = useState<QuizStreak>({ current_streak: 0, best_streak: 0 });
  const [fitPoints, setFitPoints] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2200);

  // Modals
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [newWaist, setNewWaist] = useState('');
  const [newExercise, setNewExercise] = useState('Squat');
  const [newPerfValue, setNewPerfValue] = useState('');
  const [newPerfUnit, setNewPerfUnit] = useState('kg');

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const days = periodToDays(period);
    const fromDate = daysAgoISO(days);

    try {
      const [mealsRes, weightsRes, perfsRes, streakRes, profileRes] = await Promise.all([
        supabase
          .from('meal_plans')
          .select('date, custom_calories, custom_protein, custom_carbs, custom_fat')
          .eq('user_id', session.user.id)
          .eq('is_completed', true)
          .gte('date', fromDate)
          .order('date'),
        supabase
          .from('weight_logs')
          .select('id, date, weight, body_fat, waist')
          .eq('user_id', session.user.id)
          .gte('date', fromDate)
          .order('date'),
        supabase
          .from('performance_records')
          .select('id, exercise, value, unit, date')
          .eq('user_id', session.user.id)
          .gte('date', fromDate)
          .order('date', { ascending: false }),
        supabase
          .from('quiz_streaks')
          .select('current_streak')
          .eq('user_id', session.user.id)
          .single(),
        supabase
          .from('profiles')
          .select('daily_calories, is_premium')
          .eq('id', session.user.id)
          .single(),
      ]);

      // Macros par jour
      const byDay: Record<string, DayStat> = {};
      ((mealsRes.data ?? []) as any[]).forEach((r) => {
        const d = r.date as string;
        if (!byDay[d]) byDay[d] = { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
        byDay[d].kcal    += r.custom_calories ?? 0;
        byDay[d].protein += r.custom_protein  ?? 0;
        byDay[d].carbs   += r.custom_carbs    ?? 0;
        byDay[d].fat     += r.custom_fat      ?? 0;
        byDay[d].count   += 1;
      });
      setDayStats(Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)));

      setWeightLogs((weightsRes.data ?? []) as WeightEntry[]);
      setPerfRecords((perfsRes.data ?? []) as PerfRecord[]);

      if (streakRes.data) {
        const s = streakRes.data as any;
        setStreak({ current_streak: s.current_streak ?? 0, best_streak: s.best_streak ?? 0 });
        setFitPoints((s.current_streak ?? 0) * 15);
      }

      if (profileRes.data) {
        setDailyGoal((profileRes.data as any).daily_calories ?? 2200);
        setIsPremium(!!(profileRes.data as any).is_premium);
      }
    } catch (e) {
      console.error('Stats load error:', e);
    } finally {
      setLoading(false);
    }
  }, [session, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save weight ─────────────────────────────────────────────────────────────

  const saveWeight = async () => {
    if (!session?.user || !newWeight) return;
    try {
      await supabase.from('weight_logs').upsert({
        user_id: session.user.id,
        date: todayISO(),
        weight: parseFloat(newWeight),
        body_fat: newBodyFat ? parseFloat(newBodyFat) : null,
        waist: newWaist ? parseFloat(newWaist) : null,
      }, { onConflict: 'user_id,date' });
      setShowWeightModal(false);
      setNewWeight(''); setNewBodyFat(''); setNewWaist('');
      loadData();
    } catch (e) {
      if (Platform.OS !== 'web') Alert.alert('Erreur', 'Impossible de sauvegarder.');
    }
  };

  // ── Save perf ───────────────────────────────────────────────────────────────

  const savePerf = async () => {
    if (!session?.user || !newPerfValue) return;
    try {
      await supabase.from('performance_records').insert({
        user_id: session.user.id,
        exercise: newExercise,
        value: parseFloat(newPerfValue),
        unit: newPerfUnit,
        date: todayISO(),
      });
      setShowPerfModal(false);
      setNewPerfValue('');
      loadData();
    } catch (e) {
      if (Platform.OS !== 'web') Alert.alert('Erreur', 'Impossible de sauvegarder.');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const avgKcal = dayStats.length > 0
    ? Math.round(dayStats.reduce((s, d) => s + d.kcal, 0) / dayStats.length)
    : 0;

  const adherenceDays = dayStats.filter(d => d.kcal >= dailyGoal * 0.8).length;
  const adherencePct = dayStats.length > 0 ? Math.round((adherenceDays / periodToDays(period)) * 100) : 0;

  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1]! : null;
  const firstWeight  = weightLogs.length > 1 ? weightLogs[0]! : null;
  const weightDelta  = latestWeight && firstWeight ? +(latestWeight.weight - firstWeight.weight).toFixed(1) : null;

  // Group perfs by exercise → best value
  const perfByExercise: Record<string, { best: number; unit: string; date: string; count: number }> = {};
  perfRecords.forEach((r) => {
    if (!perfByExercise[r.exercise] || r.value > perfByExercise[r.exercise]!.best) {
      perfByExercise[r.exercise] = { best: r.value, unit: r.unit, date: r.date, count: (perfByExercise[r.exercise]?.count ?? 0) + 1 };
    } else {
      perfByExercise[r.exercise]!.count += 1;
    }
  });

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs: { key: StatsTab; label: string; premium?: boolean }[] = [
    { key: 'macros', label: '🔥 Calories' },
    { key: 'poids',  label: '⚖️ Poids' },
    { key: 'perfs',  label: '🏋️ PRs' },
    { key: 'points', label: '⚡ Points' },
    { key: 'scan',   label: '📸 Body Scan', premium: true },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.darkGreen} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Progression</Text>

        {/* Period toggle */}
        <View style={styles.periodRow}>
          {(['7j', '30j', '3m'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => {
              if (t.premium && !isPremium) { setShowPaywall(true); return; }
              setActiveTab(t.key);
            }}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            {t.premium && !isPremium && (
              <Text style={styles.tabPremiumIcon}>👑</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TAB MACROS ── */}
        {activeTab === 'macros' && (
          <View style={styles.tabContent}>
            <View style={styles.kpiRow}>
              <KPI label="Moy. / jour" value={`${avgKcal}`} sub="kcal" color={Colors.darkGreen} />
              <KPI label="Adhérence" value={`${adherencePct}%`} sub={`${adherenceDays}j sur objectif`} color={adherencePct >= 80 ? Colors.lime : Colors.orange} />
            </View>

            <Text style={styles.chartTitle}>Calories par jour</Text>
            <MiniBarChart
              data={dayStats.map(d => ({ label: shortDay(d.date), value: d.kcal }))}
              maxVal={dailyGoal * 1.3}
              color={Colors.darkGreen}
            />

            {/* Objectif line */}
            <View style={styles.goalLine}>
              <View style={styles.goalLineDash} />
              <Text style={styles.goalLineText}>Objectif : {dailyGoal} kcal</Text>
            </View>

            <Text style={[styles.chartTitle, { marginTop: 24 }]}>Protéines par jour</Text>
            <MiniBarChart
              data={dayStats.map(d => ({ label: shortDay(d.date), value: Math.round(d.protein) }))}
              maxVal={200}
              color={Colors.proteines}
            />
          </View>
        )}

        {/* ── TAB POIDS ── */}
        {activeTab === 'poids' && (
          <View style={styles.tabContent}>
            <View style={styles.kpiRow}>
              <KPI
                label="Poids actuel"
                value={latestWeight ? `${latestWeight.weight} kg` : '–'}
                sub={latestWeight?.body_fat ? `${latestWeight.body_fat}% MG` : undefined}
              />
              <KPI
                label="Évolution"
                value={weightDelta !== null ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg` : '–'}
                sub={`sur ${period}`}
                color={weightDelta && weightDelta < 0 ? Colors.lime : Colors.orange}
              />
            </View>

            {weightLogs.length > 0 ? (
              <>
                <Text style={styles.chartTitle}>Courbe de poids</Text>
                <MiniBarChart
                  data={weightLogs.map(w => ({ label: shortDay(w.date), value: w.weight }))}
                  maxVal={Math.max(...weightLogs.map(w => w.weight)) * 1.05}
                  color={Colors.info}
                />
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>⚖️</Text>
                <Text style={styles.emptyText}>Commence à suivre ton poids pour voir ta courbe ici.</Text>
              </View>
            )}

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowWeightModal(true)}>
              <Text style={styles.addBtnText}>+ Enregistrer mon poids</Text>
            </TouchableOpacity>

            {/* Historique */}
            {weightLogs.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Historique</Text>
                {[...weightLogs].reverse().slice(0, 10).map((w) => (
                  <View key={w.id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{shortDay(w.date)}</Text>
                    <Text style={styles.historyValue}>{w.weight} kg</Text>
                    {w.body_fat ? <Text style={styles.historyExtra}>{w.body_fat}% MG</Text> : null}
                    {w.waist ? <Text style={styles.historyExtra}>{w.waist} cm</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── TAB PERFS ── */}
        {activeTab === 'perfs' && (
          <View style={styles.tabContent}>
            {Object.keys(perfByExercise).length > 0 ? (
              Object.entries(perfByExercise).map(([ex, data]) => (
                <View key={ex} style={styles.prCard}>
                  <View style={styles.prCardHeader}>
                    <Text style={styles.prExercise}>{ex}</Text>
                    <Text style={styles.prBest}>{data.best} {data.unit}</Text>
                  </View>
                  <Text style={styles.prSub}>{data.count} entrée(s) · PR le {shortDay(data.date)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🏋️</Text>
                <Text style={styles.emptyText}>Enregistre tes records pour suivre ta progression.</Text>
              </View>
            )}

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowPerfModal(true)}>
              <Text style={styles.addBtnText}>+ Ajouter un record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TAB BODY SCAN ── */}
        {activeTab === 'scan' && (
          <PremiumGate isPremium={isPremium} onSubscribe={() => setShowPaywall(true)} label="Body Scan IA">
            <BodyScanPlaceholder />
          </PremiumGate>
        )}

        {/* ── TAB POINTS ── */}
        {activeTab === 'points' && (
          <View style={styles.tabContent}>
            <View style={styles.kpiRow}>
              <KPI label="FIT Points" value={`${fitPoints}`} sub="⚡" color={Colors.lime} />
              <KPI label="Streak actuel" value={`${streak.current_streak}j`} sub="🔥" color={Colors.orange} />
            </View>

            <View style={styles.pointsBreakdown}>
              <Text style={styles.historyTitle}>Comment gagner des points</Text>
              {[
                { emoji: '📋', label: 'Compléter le quiz du jour', pts: '+10' },
                { emoji: '🍽️', label: 'Enregistrer un repas', pts: '+5' },
                { emoji: '💡', label: 'Lire un tip', pts: '+5' },
                { emoji: '🔥', label: 'Streak quotidien', pts: '+15/j' },
                { emoji: '⚖️', label: 'Enregistrer son poids', pts: '+5' },
                { emoji: '🏋️', label: 'Nouveau PR', pts: '+20' },
              ].map((item, i) => (
                <View key={i} style={styles.pointsRow}>
                  <Text style={styles.pointsRowEmoji}>{item.emoji}</Text>
                  <Text style={styles.pointsRowLabel}>{item.label}</Text>
                  <Text style={styles.pointsRowPts}>{item.pts}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL POIDS ── */}
      <Modal visible={showWeightModal} transparent animationType="slide" onRequestClose={() => setShowWeightModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowWeightModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>⚖️ Mon poids aujourd'hui</Text>
            <Text style={styles.modalFieldLabel}>Poids (kg) *</Text>
            <TextInput style={styles.modalInput} value={newWeight} onChangeText={setNewWeight} placeholder="75.5" keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalFieldLabel}>% Masse grasse</Text>
                <TextInput style={styles.modalInput} value={newBodyFat} onChangeText={setNewBodyFat} placeholder="18" keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalFieldLabel}>Tour de taille (cm)</Text>
                <TextInput style={styles.modalInput} value={newWaist} onChangeText={setNewWaist} placeholder="82" keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={saveWeight}>
              <Text style={styles.modalConfirmText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL PERF ── */}
      <Modal visible={showPerfModal} transparent animationType="slide" onRequestClose={() => setShowPerfModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPerfModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🏋️ Nouveau record</Text>
            <Text style={styles.modalFieldLabel}>Exercice</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
              {EXERCICES.map((ex) => (
                <TouchableOpacity
                  key={ex}
                  style={[styles.exerciseChip, newExercise === ex && styles.exerciseChipActive]}
                  onPress={() => setNewExercise(ex)}
                >
                  <Text style={[styles.exerciseChipText, newExercise === ex && styles.exerciseChipTextActive]}>
                    {ex}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.modalFieldLabel}>Valeur *</Text>
                <TextInput style={styles.modalInput} value={newPerfValue} onChangeText={setNewPerfValue} placeholder="100" keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalFieldLabel}>Unité</Text>
                <View style={styles.unitRow}>
                  {['kg', 'reps', 'min'].map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitBtn, newPerfUnit === u && styles.unitBtnActive]}
                      onPress={() => setNewPerfUnit(u)}
                    >
                      <Text style={[styles.unitBtnText, newPerfUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={savePerf}>
              <Text style={styles.modalConfirmText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribe={async () => {
          // TODO: RevenueCat purchase flow
          setShowPaywall(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Body Scan Placeholder (UI complète grisée) ───────────────────────────────

function BodyScanPlaceholder() {
  return (
    <View style={bodyScanStyles.container}>
      <View style={bodyScanStyles.cameraZone}>
        <Text style={bodyScanStyles.cameraIcon}>📸</Text>
        <Text style={bodyScanStyles.cameraTitle}>Analyse corporelle IA</Text>
        <Text style={bodyScanStyles.cameraSub}>
          Prends une photo face + profil — l'IA analyse ta composition corporelle en 30 secondes
        </Text>
      </View>

      <View style={bodyScanStyles.resultsGrid}>
        {[
          { label: 'Masse grasse', value: '18.4%', icon: '🔥', color: '#E8612D' },
          { label: 'Masse musculaire', value: '42.1 kg', icon: '💪', color: Colors.darkGreen },
          { label: 'IMC', value: '23.2', icon: '⚖️', color: '#3B82F6' },
          { label: 'Eau corporelle', value: '61.3%', icon: '💧', color: '#06B6D4' },
        ].map((m, i) => (
          <View key={i} style={[bodyScanStyles.metricCard, { borderColor: m.color + '40' }]}>
            <Text style={bodyScanStyles.metricIcon}>{m.icon}</Text>
            <Text style={[bodyScanStyles.metricValue, { color: m.color }]}>{m.value}</Text>
            <Text style={bodyScanStyles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      <View style={bodyScanStyles.historyCard}>
        <Text style={bodyScanStyles.historyTitle}>Évolution masse grasse</Text>
        <View style={bodyScanStyles.fakeChart}>
          {[22, 20, 19.5, 18.8, 18.4].map((v, i) => (
            <View key={i} style={bodyScanStyles.fakeBarCol}>
              <View style={[bodyScanStyles.fakeBar, { height: v * 3 }]} />
              <Text style={bodyScanStyles.fakeBarLabel}>S{i + 1}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const bodyScanStyles = StyleSheet.create({
  container: { gap: 16 },
  cameraZone: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 10, borderWidth: 2,
    borderStyle: 'dashed', borderColor: Colors.border,
  },
  cameraIcon: { fontSize: 48 },
  cameraTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  cameraSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '47%', backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4, borderWidth: 1.5,
  },
  metricIcon: { fontSize: 24 },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  historyCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  historyTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fakeChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80 },
  fakeBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  fakeBar: { width: '70%', backgroundColor: Colors.lime, borderRadius: 4 },
  fakeBarLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },

  // Header
  header: {
    backgroundColor: Colors.darkGreen,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    gap: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  periodRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 3,
  },
  periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  periodBtnActive: { backgroundColor: Colors.white },
  periodBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  periodBtnTextActive: { color: Colors.darkGreen },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: Colors.darkGreen },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.darkGreen, fontWeight: '800' },
  tabPremiumIcon: { fontSize: 8, position: 'absolute', top: 4, right: 4 },

  // Tab content
  tabContent: { gap: 16 },
  kpiRow: { flexDirection: 'row', gap: 10 },

  // Charts
  chartTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  goalLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  goalLineDash: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Colors.orange },
  goalLineText: { fontSize: 10, color: Colors.orange, fontWeight: '600' },

  // Empty
  emptyCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border,
  },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Add btn
  addBtn: {
    backgroundColor: Colors.darkGreen, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  addBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },

  // History
  historySection: { marginTop: 8 },
  historyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyDate: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', width: 60 },
  historyValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  historyExtra: { fontSize: 12, color: Colors.textSecondary },

  // PR cards
  prCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  prCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prExercise: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  prBest: { fontSize: 18, fontWeight: '800', color: Colors.darkGreen },
  prSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // Points breakdown
  pointsBreakdown: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  pointsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pointsRowEmoji: { fontSize: 18 },
  pointsRowLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  pointsRowPts: { fontSize: 14, fontWeight: '800', color: Colors.lime },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalKeyboard: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalConfirmBtn: {
    backgroundColor: Colors.darkGreen, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  modalConfirmText: { color: Colors.white, fontSize: 16, fontWeight: '800' },

  // Exercise chips
  exerciseScroll: { marginBottom: 14, maxHeight: 40 },
  exerciseChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, marginRight: 8,
  },
  exerciseChipActive: { backgroundColor: Colors.darkGreen, borderColor: Colors.darkGreen },
  exerciseChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  exerciseChipTextActive: { color: Colors.white },

  // Unit btns
  unitRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  unitBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  unitBtnActive: { backgroundColor: Colors.darkGreen, borderColor: Colors.darkGreen },
  unitBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  unitBtnTextActive: { color: Colors.white },
});
