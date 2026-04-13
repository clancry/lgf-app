/**
 * PremiumGate — Système freemium La Gamelle Fit
 *
 * Usage :
 *   <PremiumGate isPremium={isPremium} onSubscribe={handleSubscribe}>
 *     <MonComposantPremium />
 *   </PremiumGate>
 *
 * ou en mode badge seul (sans wrapper) :
 *   <PremiumBadge />
 *
 * Paywall :
 *   <PremiumPaywall visible={show} onClose={() => setShow(false)} onSubscribe={handleSubscribe} />
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Platform, Dimensions, Linking,
} from 'react-native';
import { Colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

// ─── Badge 👑 ──────────────────────────────────────────────────────────────────

export function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const s = size === 'md' ? badgeStyles.md : badgeStyles.sm;
  return (
    <View style={[badgeStyles.badge, s]}>
      <Text style={[badgeStyles.text, size === 'md' && { fontSize: 12 }]}>👑 Premium</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 10, fontWeight: '800', color: '#fff' },
});

// ─── Wrapper grisé ─────────────────────────────────────────────────────────────

interface PremiumGateProps {
  isPremium: boolean;
  onSubscribe: () => void;
  children: React.ReactNode;
  label?: string;         // texte affiché sur le overlay
  blurIntensity?: number; // opacité du voile (0-1)
}

export function PremiumGate({
  isPremium,
  onSubscribe,
  children,
  label = 'Fonctionnalité Premium',
  blurIntensity = 0.88,
}: PremiumGateProps) {
  if (isPremium) return <>{children}</>;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onSubscribe}
      style={gateStyles.wrapper}
    >
      {/* Contenu grisé en dessous */}
      <View style={gateStyles.blurred} pointerEvents="none">
        {children}
      </View>

      {/* Voile + badge */}
      <View style={[gateStyles.overlay, { backgroundColor: `rgba(245,245,240,${blurIntensity})` }]}>
        <View style={gateStyles.lockCard}>
          <Text style={gateStyles.lockIcon}>👑</Text>
          <Text style={gateStyles.lockTitle}>{label}</Text>
          <Text style={gateStyles.lockSub}>1 mois gratuit · puis 19,99€/mois</Text>
          <View style={gateStyles.lockBtn}>
            <Text style={gateStyles.lockBtnText}>Essayer gratuitement</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const gateStyles = StyleSheet.create({
  wrapper: { position: 'relative' },
  blurred: { opacity: 0.25 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 16,
  },
  lockCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#F59E0B' + '60',
    width: width - 80,
  },
  lockIcon: { fontSize: 36 },
  lockTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  lockSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  lockBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  lockBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

// ─── Paywall complet ───────────────────────────────────────────────────────────

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  trialDaysLeft?: number; // nb de jours restants si déjà en trial
}

const PREMIUM_FEATURES = [
  { emoji: '📸', title: 'Body Scan IA', desc: 'Analyse ta composition corporelle par photo' },
  { emoji: '🧠', title: 'Coach IA personnalisé', desc: 'Conseils adaptatifs selon tes résultats' },
  { emoji: '📊', title: 'Stats avancées', desc: 'Courbes, tendances et prédictions' },
  { emoji: '🏆', title: 'Défis Arena avancés', desc: 'Inter-gyms, classements, challenges exclusifs' },
  { emoji: '🍽️', title: 'Plan repas IA', desc: 'Menu 7 jours généré selon tes objectifs' },
  { emoji: '📅', title: 'Historique illimité', desc: 'Accès à tout ton historique sans limite' },
];

export function PremiumPaywall({ visible, onClose, onSubscribe }: PremiumPaywallProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await onSubscribe();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={paywallStyles.container}>
        {/* Handle + close */}
        <View style={paywallStyles.topRow}>
          <View style={paywallStyles.handle} />
          <TouchableOpacity onPress={onClose} style={paywallStyles.closeBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={paywallStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={paywallStyles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={paywallStyles.hero}>
            <Text style={paywallStyles.heroEmoji}>👑</Text>
            <Text style={paywallStyles.heroTitle}>La Gamelle Fit Premium</Text>
            <Text style={paywallStyles.heroSub}>
              Ton coach nutritionnel complet — le premier mois est offert.
            </Text>
          </View>

          {/* Trial badge */}
          <View style={paywallStyles.trialBadge}>
            <Text style={paywallStyles.trialBadgeText}>🎁 1 mois GRATUIT · Puis 19,99€/mois</Text>
          </View>
          <Text style={paywallStyles.trialNote}>
            Sans engagement · Annulable à tout moment depuis l'App Store · Facturation le 31ème jour
          </Text>

          {/* Features */}
          <Text style={paywallStyles.featuresTitle}>Tout ce que tu débloques</Text>
          {PREMIUM_FEATURES.map((f, i) => (
            <View key={i} style={paywallStyles.featureRow}>
              <View style={paywallStyles.featureEmoji}>
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
              </View>
              <View style={paywallStyles.featureText}>
                <Text style={paywallStyles.featureTitle}>{f.title}</Text>
                <Text style={paywallStyles.featureDesc}>{f.desc}</Text>
              </View>
              <Text style={paywallStyles.featureCheck}>✓</Text>
            </View>
          ))}

          {/* Comparaison Free vs Premium */}
          <View style={paywallStyles.compareCard}>
            <View style={paywallStyles.compareRow}>
              <Text style={paywallStyles.compareLabel}></Text>
              <Text style={paywallStyles.compareHeaderFree}>Gratuit</Text>
              <Text style={paywallStyles.compareHeaderPro}>Premium</Text>
            </View>
            {[
              { label: 'Quiz du jour', free: '✓', pro: '✓' },
              { label: 'Recettes LGF', free: '✓', pro: '✓' },
              { label: 'Plan du jour', free: '✓', pro: '✓' },
              { label: 'Body Scan IA', free: '—', pro: '✓' },
              { label: 'Stats avancées', free: '7 jours', pro: 'Illimité' },
              { label: 'Coach IA', free: '—', pro: '✓' },
              { label: 'Plan repas IA', free: '—', pro: '✓' },
            ].map((row, i) => (
              <View key={i} style={[paywallStyles.compareRow, i % 2 === 0 && paywallStyles.compareRowAlt]}>
                <Text style={paywallStyles.compareLabel}>{row.label}</Text>
                <Text style={[paywallStyles.compareCell, row.free === '—' && paywallStyles.compareCellNo]}>{row.free}</Text>
                <Text style={[paywallStyles.compareCell, paywallStyles.compareCellPro]}>{row.pro}</Text>
              </View>
            ))}
          </View>

          {/* Témoignages */}
          <View style={paywallStyles.reviewCard}>
            <Text style={paywallStyles.reviewStars}>★★★★★</Text>
            <Text style={paywallStyles.reviewText}>
              "Le Body Scan IA m'a motivé comme jamais. Je vois mes progrès semaine après semaine."
            </Text>
            <Text style={paywallStyles.reviewAuthor}>— Marc D., membre Fitness Park Ducos</Text>
          </View>
        </ScrollView>

        {/* CTA sticky */}
        <View style={paywallStyles.footer}>
          <TouchableOpacity
            style={[paywallStyles.ctaBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubscribe}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={paywallStyles.ctaBtnText}>
              {loading ? 'Chargement...' : '🎁 Commencer mon mois gratuit'}
            </Text>
            <Text style={paywallStyles.ctaBtnSub}>puis 19,99€/mois · annulable à tout moment</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={paywallStyles.skipBtn}>
            <Text style={paywallStyles.skipBtnText}>Continuer sans Premium</Text>
          </TouchableOpacity>

          <Text style={paywallStyles.legal}>
            En souscrivant, tu acceptes les CGU. L'abonnement se renouvelle automatiquement à 19,99€/mois
            sauf annulation au moins 24h avant la fin de la période en cours. Gérable depuis les réglages
            de l'App Store.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const paywallStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  topRow: {
    alignItems: 'center', paddingTop: 12, paddingHorizontal: 20, paddingBottom: 4,
    position: 'relative',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  closeBtn: {
    position: 'absolute', right: 20, top: 12,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 16 },

  // Hero
  hero: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  heroEmoji: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  heroSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Trial
  trialBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#F59E0B',
    marginBottom: 8,
  },
  trialBadgeText: { fontSize: 16, fontWeight: '800', color: '#92400E' },
  trialNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 16 },

  // Features
  featuresTitle: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  featureEmoji: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.darkGreen + '12', justifyContent: 'center', alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  featureDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  featureCheck: { fontSize: 16, color: Colors.darkGreen, fontWeight: '800' },

  // Compare
  compareCard: {
    marginTop: 24, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  compareRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
  },
  compareRowAlt: { backgroundColor: Colors.background },
  compareLabel: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  compareHeaderFree: { width: 64, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  compareHeaderPro: { width: 64, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#F59E0B' },
  compareCell: { width: 64, textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  compareCellNo: { color: Colors.border },
  compareCellPro: { color: Colors.darkGreen, fontWeight: '700' },

  // Review
  reviewCard: {
    marginTop: 20, backgroundColor: Colors.background, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  reviewStars: { fontSize: 16, color: '#F59E0B', marginBottom: 6 },
  reviewText: { fontSize: 14, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 20, marginBottom: 8 },
  reviewAuthor: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // Footer CTA
  footer: {
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  ctaBtn: {
    backgroundColor: '#F59E0B', borderRadius: 18, paddingVertical: 18,
    alignItems: 'center', gap: 4,
    shadowColor: '#F59E0B', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  ctaBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipBtnText: { fontSize: 14, color: Colors.textMuted },
  legal: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 14, marginTop: 4 },
});
