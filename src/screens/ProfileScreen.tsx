import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { getProfile, signOut } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface ProfileScreenProps {
  session: Session | null;
}

interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  regime?: string;
  objectif?: string;
  taille?: number;
  poids?: number;
  age?: number;
  genre?: string;
  niveau_activite?: string;
  wallet_balance?: number;
  is_premium?: boolean;
  fitness_park?: string;
}

const REGIME_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  masse: { label: 'Prise de masse', color: Colors.orange, emoji: '💪' },
  seche: { label: 'Sèche', color: Colors.info, emoji: '🔥' },
  equilibre: { label: 'Équilibré', color: Colors.success, emoji: '⚖️' },
};

const NIVEAU_LABELS: Record<string, string> = {
  sedentaire: 'Sédentaire',
  modere: 'Modéré',
  actif: 'Actif',
  tres_actif: 'Très actif',
};

export default function ProfileScreen({ session }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.user) return;
    const { profile: p } = await getProfile(session.user.id);
    setProfile(p);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSignOut() {
    Alert.alert(
      'Se déconnecter ?',
      'Tu vas être redirigé vers l\'écran de connexion.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  const regime = profile?.regime ?? 'equilibre';
  const regimeInfo = REGIME_INFO[regime] ?? REGIME_INFO.equilibre;
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadProfile(); }}
            tintColor={Colors.darkGreen}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>
            {profile?.first_name} {profile?.last_name}
          </Text>
          <Text style={styles.profileEmail}>{profile?.email ?? session?.user?.email}</Text>
          <View
            style={[
              styles.regimeBadge,
              { backgroundColor: regimeInfo.color + '25', borderColor: regimeInfo.color },
            ]}
          >
            <Text style={[styles.regimeBadgeText, { color: regimeInfo.color }]}>
              {regimeInfo.emoji} {regimeInfo.label}
            </Text>
          </View>
          {profile?.is_premium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>⭐ Premium</Text>
            </View>
          )}
        </View>

        {/* Body stats */}
        <View style={styles.statsCard}>
          {[
            { label: 'Taille', value: profile?.taille ? `${profile.taille} cm` : '—' },
            { label: 'Poids', value: profile?.poids ? `${profile.poids} kg` : '—' },
            { label: 'Âge', value: profile?.age ? `${profile.age} ans` : '—' },
            {
              label: 'Activité',
              value: NIVEAU_LABELS[profile?.niveau_activite ?? ''] ?? '—',
            },
          ].map(({ label, value }) => (
            <View key={label} style={styles.statItem}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Wallet summary */}
        <View style={styles.walletRow}>
          <View style={styles.walletInfo}>
            <Text style={styles.walletLabel}>Solde Wallet</Text>
            <Text style={styles.walletAmount}>
              {(profile?.wallet_balance ?? 0).toFixed(2)}€
            </Text>
          </View>
          <TouchableOpacity style={styles.rechargeBtn}>
            <Text style={styles.rechargeBtnText}>Recharger →</Text>
          </TouchableOpacity>
        </View>

        {/* Menu sections */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Santé & Performance</Text>

          <MenuRow
            emoji="📸"
            label="Body Scan"
            subtitle="Analyse ta composition corporelle"
            onPress={() => Alert.alert('Bientôt disponible', 'La fonctionnalité Body Scan arrive prochainement.')}
          />
          <MenuRow
            emoji="⌚"
            label="Smartwatch"
            subtitle="Connecter Apple Watch / Garmin"
            onPress={() => Alert.alert('Bientôt disponible', 'La synchronisation Smartwatch arrive prochainement.')}
          />
          <MenuRow
            emoji="📊"
            label="Mes statistiques"
            subtitle="Calories, macros, progression"
            onPress={() => Alert.alert('Bientôt disponible', 'Les statistiques détaillées arrivent prochainement.')}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Abonnement</Text>

          <MenuRow
            emoji="⭐"
            label="Passer Premium"
            subtitle="Accès illimité à toutes les recettes"
            badge="Bientôt"
            onPress={() => Alert.alert('Premium', 'La souscription Premium sera disponible prochainement.')}
            highlight
          />
          <MenuRow
            emoji="💳"
            label="Gérer mon abonnement"
            subtitle="Voir et modifier mes formules"
            onPress={() => Alert.alert('Info', 'Aucun abonnement actif pour le moment.')}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Compte</Text>

          <MenuRow
            emoji="✏️"
            label="Modifier mon profil"
            subtitle="Nom, objectifs, mesures"
            onPress={() => Alert.alert('Bientôt disponible', 'La modification de profil sera disponible prochainement.')}
          />
          <MenuRow
            emoji="🔔"
            label="Notifications"
            subtitle="Gérer mes alertes"
            onPress={() => Alert.alert('Bientôt disponible', 'Les paramètres de notifications arrivent prochainement.')}
          />
          <MenuRow
            emoji="🔒"
            label="Mot de passe"
            subtitle="Modifier mon mot de passe"
            onPress={() => Alert.alert('Bientôt disponible', 'La modification du mot de passe arrive prochainement.')}
          />
          <MenuRow
            emoji="🙋"
            label="Support"
            subtitle="Besoin d'aide ?"
            onPress={() => Alert.alert('Support', 'Contacte-nous à support@lagamellefit.com')}
          />
        </View>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <Text style={styles.signOutText}>🚪  Se déconnecter</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.version}>La Gamelle Fit v1.0.0</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  emoji,
  label,
  subtitle,
  badge,
  onPress,
  highlight,
}: {
  emoji: string;
  label: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, highlight && styles.menuRowHighlight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuRowIcon, highlight && styles.menuRowIconHighlight]}>
        <Text style={styles.menuRowEmoji}>{emoji}</Text>
      </View>
      <View style={styles.menuRowContent}>
        <Text style={[styles.menuRowLabel, highlight && styles.menuRowLabelHighlight]}>
          {label}
        </Text>
        <Text style={styles.menuRowSubtitle}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
      <Text style={styles.menuRowArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.darkGreen,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.darkGreen,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.7,
  },
  regimeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 4,
  },
  regimeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  premiumBadge: {
    backgroundColor: Colors.orange,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumBadgeText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.darkGreen,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
  },
  walletInfo: {
    gap: 2,
  },
  walletLabel: {
    fontSize: 12,
    color: Colors.white,
    opacity: 0.7,
    fontWeight: '600',
  },
  walletAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.lime,
  },
  rechargeBtn: {
    backgroundColor: Colors.lime,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rechargeBtnText: {
    color: Colors.darkGreen,
    fontSize: 13,
    fontWeight: '800',
  },
  menuSection: {
    marginTop: 24,
    marginHorizontal: 20,
    gap: 2,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 2,
    gap: 12,
  },
  menuRowHighlight: {
    backgroundColor: Colors.lime + '20',
    borderWidth: 1.5,
    borderColor: Colors.lime,
  },
  menuRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowIconHighlight: {
    backgroundColor: Colors.lime + '40',
  },
  menuRowEmoji: {
    fontSize: 18,
  },
  menuRowContent: {
    flex: 1,
    gap: 2,
  },
  menuRowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuRowLabelHighlight: {
    color: Colors.darkGreen,
  },
  menuRowSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  menuBadge: {
    backgroundColor: Colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  menuBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  menuRowArrow: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  signOutSection: {
    marginHorizontal: 20,
    marginTop: 28,
  },
  signOutButton: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  signOutText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 20,
  },
});
