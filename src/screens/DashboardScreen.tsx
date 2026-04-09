import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase, getProfile } from '../lib/supabase';
import { Colors } from '../theme/colors';
import BreakfastCard from '../components/BreakfastCard';

const { width } = Dimensions.get('window');

interface DashboardScreenProps {
  session: Session | null;
}

interface Profile {
  id: string;
  first_name?: string;
  regime?: string;
  wallet_balance?: number;
  goal?: string;
}

interface Recipe {
  id: string;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  category?: string;
  regime?: string;
}

const REGIME_LABELS: Record<string, string> = {
  masse: '💪 Masse',
  seche: '🔥 Sèche',
  equilibre: '⚖️ Équilibré',
};

const REGIME_COLORS: Record<string, string> = {
  masse: Colors.orange,
  seche: Colors.info,
  equilibre: Colors.success,
};

// Daily calorie goals by regime
const CALORIE_GOALS: Record<string, number> = {
  masse: 3000,
  seche: 1800,
  equilibre: 2200,
};

export default function DashboardScreen({ session }: DashboardScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [breakfast, setBreakfast] = useState<Recipe | null>(null);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [macros, setMacros] = useState({ p: 0, g: 0, l: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { profile: p } = await getProfile(session.user.id);
      setProfile(p);

      // Load a breakfast recipe for the user's regime
      const regime = p?.regime ?? 'equilibre';
      const { data: recipes } = await supabase
        .from('recipes')
        .select('*')
        .eq('category', 'petit_dejeuner')
        .eq('regime', regime)
        .limit(10);
      if (recipes && recipes.length > 0) {
        const idx = new Date().getDate() % recipes.length;
        setBreakfast(recipes[idx]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function shuffleBreakfast() {
    if (!session?.user || !profile) return;
    const regime = profile.regime ?? 'equilibre';
    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .eq('category', 'petit_dejeuner')
      .eq('regime', regime)
      .limit(20);
    if (recipes && recipes.length > 0) {
      const idx = Math.floor(Math.random() * recipes.length);
      setBreakfast(recipes[idx]);
    }
  }

  const calorieGoal = CALORIE_GOALS[profile?.regime ?? 'equilibre'];
  const calorieProgress = Math.min(caloriesConsumed / calorieGoal, 1);
  const macroGoals = {
    p: profile?.regime === 'masse' ? 180 : 130,
    g: profile?.regime === 'seche' ? 100 : 250,
    l: 70,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  const firstName = profile?.first_name ?? 'Toi';
  const regime = profile?.regime ?? 'equilibre';
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'Bonjour' : greetingHour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.darkGreen}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {greeting}, <Text style={styles.greetingName}>{firstName} 👋</Text>
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          <View
            style={[
              styles.regimeBadge,
              { backgroundColor: REGIME_COLORS[regime] + '20', borderColor: REGIME_COLORS[regime] },
            ]}
          >
            <Text style={[styles.regimeBadgeText, { color: REGIME_COLORS[regime] }]}>
              {REGIME_LABELS[regime] ?? regime}
            </Text>
          </View>
        </View>

        {/* Calorie ring + macros */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Objectif du jour</Text>
          <View style={styles.statsRow}>
            {/* Ring (simplified with border) */}
            <View style={styles.ringContainer}>
              <View
                style={[
                  styles.ring,
                  {
                    borderColor: Colors.lime,
                    borderRightColor:
                      calorieProgress < 0.25
                        ? Colors.border
                        : Colors.lime,
                  },
                ]}
              >
                <Text style={styles.ringCalories}>{caloriesConsumed}</Text>
                <Text style={styles.ringUnit}>kcal</Text>
                <Text style={styles.ringGoal}>/ {calorieGoal}</Text>
              </View>
            </View>

            {/* Macro bars */}
            <View style={styles.macroBars}>
              {[
                {
                  label: 'Protéines',
                  value: macros.p,
                  goal: macroGoals.p,
                  color: Colors.proteines,
                },
                {
                  label: 'Glucides',
                  value: macros.g,
                  goal: macroGoals.g,
                  color: Colors.glucides,
                },
                {
                  label: 'Lipides',
                  value: macros.l,
                  goal: macroGoals.l,
                  color: Colors.lipides,
                },
              ].map(({ label, value, goal, color }) => (
                <View key={label} style={styles.macroBar}>
                  <View style={styles.macroBarHeader}>
                    <Text style={styles.macroLabel}>{label}</Text>
                    <Text style={styles.macroValue}>
                      {value}g / {goal}g
                    </Text>
                  </View>
                  <View style={styles.macroTrack}>
                    <View
                      style={[
                        styles.macroFill,
                        {
                          width: `${Math.min((value / goal) * 100, 100)}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Breakfast card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Petit-déjeuner du jour 🌅</Text>
          <BreakfastCard regime={profile?.regime || 'equilibre'} />
        </View>

        {/* Chrono-nutrition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chrono-Nutrition ⏰</Text>
          <View style={styles.chronoCard}>
            <View style={styles.chronoRow}>
              {[
                { label: 'Petit-déj', time: '07:00', emoji: '🌅' },
                { label: 'Déjeuner', time: '12:30', emoji: '☀️' },
                { label: 'Collation', time: '16:00', emoji: '🍎' },
                { label: 'Dîner', time: '19:30', emoji: '🌙' },
              ].map(({ label, time, emoji }) => (
                <View key={label} style={styles.mealSlot}>
                  <Text style={styles.mealEmoji}>{emoji}</Text>
                  <Text style={styles.mealLabel}>{label}</Text>
                  <Text style={styles.mealTime}>{time}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.planButton}>
              <Text style={styles.planButtonText}>Voir mon plan complet →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick access cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accès rapide</Text>
          <View style={styles.quickCards}>
            <TouchableOpacity style={[styles.quickCard, styles.quickCardGreen]}>
              <Text style={styles.quickCardEmoji}>⌚</Text>
              <Text style={styles.quickCardTitle}>Smartwatch</Text>
              <Text style={styles.quickCardSubtitle}>Connecter Apple Watch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickCard, styles.quickCardOrange]}>
              <Text style={styles.quickCardEmoji}>⭐</Text>
              <Text style={styles.quickCardTitle}>Premium</Text>
              <Text style={styles.quickCardSubtitle}>Débloquer tout le contenu</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: {
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  greetingName: {
    fontWeight: '800',
    color: Colors.darkGreen,
  },
  date: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  regimeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  regimeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  statsCard: {
    margin: 20,
    marginBottom: 0,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  ringContainer: {
    alignItems: 'center',
  },
  ring: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 8,
    borderColor: Colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCalories: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  ringUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  ringGoal: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  macroBars: {
    flex: 1,
    gap: 12,
  },
  macroBar: {
    gap: 4,
  },
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  macroValue: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  macroTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 3,
  },
  chronoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  chronoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mealSlot: {
    alignItems: 'center',
    gap: 4,
  },
  mealEmoji: {
    fontSize: 20,
  },
  mealLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  mealTime: {
    fontSize: 12,
    color: Colors.darkGreen,
    fontWeight: '700',
  },
  planButton: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  planButtonText: {
    color: Colors.darkGreen,
    fontSize: 14,
    fontWeight: '700',
  },
  quickCards: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  quickCardGreen: {
    backgroundColor: Colors.darkGreen,
  },
  quickCardOrange: {
    backgroundColor: Colors.orange,
  },
  quickCardEmoji: {
    fontSize: 24,
  },
  quickCardTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  quickCardSubtitle: {
    color: Colors.white,
    fontSize: 12,
    opacity: 0.8,
  },
});
