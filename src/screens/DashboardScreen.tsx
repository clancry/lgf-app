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
import { getProfile } from '../lib/supabase';
import { Colors } from '../theme/colors';

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
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [macros, setMacros] = useState({ p: 0, g: 0, l: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { profile: p } = await getProfile(session.user.id);
      setProfile(p);

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

        {/* Plan du jour résumé */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ton plan du jour ⏰</Text>
          <TouchableOpacity style={styles.planCard} activeOpacity={0.8}>
            <View style={styles.planCardHeader}>
              <Text style={{fontSize: 28}}>{'🏃'}</Text>
              <View style={{flex: 1}}>
                <Text style={styles.planCardTitle}>Chrono-Nutrition</Text>
                <Text style={styles.planCardSub}>
                  {profile?.regime === 'masse' ? '5-6 repas' : profile?.regime === 'seche' ? '4-5 repas' : '4 repas'} adaptés à ta journée
                </Text>
              </View>
              <Text style={{fontSize: 13, color: Colors.darkGreen, fontWeight: '700'}}>Voir ›</Text>
            </View>
            <Text style={styles.planCardTip}>
              💡 Dis-nous si c'est un jour d'entraînement ou repos — on s'occupe du reste
            </Text>
          </TouchableOpacity>
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
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.lime + '30',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  planCardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  planCardTip: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.lime + '15',
    lineHeight: 18,
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
