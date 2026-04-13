import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  session: Session | null;
  onComplete: () => void;
}

interface OnboardingData {
  first_name: string;
  last_name: string;
  taille: string;
  poids: string;
  birth_date: string; // format DD/MM/YYYY
  genre: string;
  regime: string;
  objectif: string;
  objectif_secondaire: string;
  niveau_activite: string;
  heure_entrainement: string;
  budget_mensuel: number;
}

/** Calcule l'âge à partir de DD/MM/YYYY */
function calcAge(ddmmyyyy: string): number | null {
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y || y < 1900 || y > new Date().getFullYear()) return null;
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 1 && age <= 120 ? age : null;
}

/** Convertit DD/MM/YYYY → YYYY-MM-DD pour Supabase */
function toISO(ddmmyyyy: string): string | null {
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Formate automatiquement la saisie DD/MM/YYYY */
function formatBirthDate(raw: string, prev: string): string {
  // Supprimer tout sauf chiffres
  const digits = raw.replace(/\D/g, '');
  let formatted = '';
  if (digits.length <= 2) {
    formatted = digits;
  } else if (digits.length <= 4) {
    formatted = digits.slice(0, 2) + '/' + digits.slice(2);
  } else {
    formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
  }
  return formatted;
}

const REGIMES = [
  { key: 'masse', label: 'Prise de masse', emoji: '💪', desc: 'Gagner du muscle' },
  { key: 'seche', label: 'Sèche', emoji: '🔥', desc: 'Perdre du gras' },
  { key: 'equilibre', label: 'Équilibré', emoji: '⚖️', desc: 'Rester en forme' },
];

const OBJECTIFS = [
  { key: 'poids', label: 'Perdre du poids', emoji: '⚖️' },
  { key: 'muscle', label: 'Prendre du muscle', emoji: '💪' },
  { key: 'perf', label: 'Améliorer mes performances', emoji: '🏃' },
  { key: 'alim', label: 'Mieux manger au quotidien', emoji: '🥗' },
  { key: 'stress', label: 'Gérer mon stress', emoji: '🧘' },
  { key: 'energie', label: 'Avoir plus d\'énergie', emoji: '⚡' },
];

const NIVEAUX = [
  { key: 'sedentaire', label: 'Sédentaire', desc: '< 1h sport/semaine' },
  { key: 'modere', label: 'Modéré', desc: '1-3h sport/semaine' },
  { key: 'actif', label: 'Actif', desc: '3-5h sport/semaine' },
  { key: 'tres_actif', label: 'Très actif', desc: '> 5h sport/semaine' },
];

const HORAIRES = ['06:00', '07:00', '08:00', '12:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const BUDGET_MIN = 80;
const BUDGET_MAX = 800;

/** Slider budget maison (sans dépendance externe) */
function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const TRACK_WIDTH = width - 48;
  const THUMB = 28;

  const pct = (value - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN);
  const thumbX = pct * (TRACK_WIDTH - THUMB);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / TRACK_WIDTH));
      const raw = BUDGET_MIN + ratio * (BUDGET_MAX - BUDGET_MIN);
      onChange(Math.round(raw / 10) * 10);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / TRACK_WIDTH));
      const raw = BUDGET_MIN + ratio * (BUDGET_MAX - BUDGET_MIN);
      onChange(Math.round(raw / 10) * 10);
    },
  });

  const label = value >= BUDGET_MAX ? `${BUDGET_MAX}€ +` : `${value}€`;
  const PALIERS = [80, 200, 400, 600, 800];

  return (
    <View style={sliderStyles.wrapper}>
      {/* Valeur centrale */}
      <View style={sliderStyles.valueRow}>
        <Text style={sliderStyles.valueText}>{label}</Text>
        <Text style={sliderStyles.valueSub}>par mois</Text>
      </View>

      {/* Track + thumb */}
      <View
        style={[sliderStyles.trackHit, { width: TRACK_WIDTH }]}
        {...panResponder.panHandlers}
      >
        <View style={[sliderStyles.track, { width: TRACK_WIDTH }]}>
          {/* Fill */}
          <View style={[sliderStyles.fill, { width: thumbX + THUMB / 2 }]} />
          {/* Thumb */}
          <View style={[sliderStyles.thumb, { left: thumbX }]} />
        </View>
      </View>

      {/* Paliers */}
      <View style={[sliderStyles.palierRow, { width: TRACK_WIDTH }]}>
        {PALIERS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => onChange(p)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={[
              sliderStyles.palierLabel,
              value === p && sliderStyles.palierLabelActive,
            ]}>
              {p === 800 ? '800€+' : `${p}€`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginBottom: 24 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 20 },
  valueText: { fontSize: 42, fontWeight: '800', color: Colors.darkGreen },
  valueSub: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  trackHit: { height: 44, justifyContent: 'center' },
  track: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 6,
    backgroundColor: Colors.lime,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: -11,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.darkGreen,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  palierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  palierLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  palierLabelActive: { color: Colors.darkGreen, fontWeight: '800' },
});

export default function OnboardingScreen({ session, onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    first_name: '',
    last_name: '',
    taille: '',
    poids: '',
    birth_date: '',
    genre: '',
    regime: '',
    objectif: '',
    objectif_secondaire: '',
    niveau_activite: '',
    heure_entrainement: '',
    budget_mensuel: 200,
  });

  function update(key: keyof OnboardingData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  function nextStep() {
    if (step === 0 && !data.regime) {
      showAlert('Choix requis', 'Sélectionne ton régime pour continuer.');
      return;
    }
    if (step === 1) {
      if (!data.first_name || !data.last_name) {
        showAlert('Informations manquantes', 'Prénom et nom sont requis.');
        return;
      }
      if (data.birth_date && calcAge(data.birth_date) === null) {
        showAlert('Date invalide', 'Vérifie ta date de naissance (JJ/MM/AAAA).');
        return;
      }
    }
    if (step < 3) setStep(step + 1);
    else handleFinish();
  }

  async function handleFinish() {
    if (!session?.user) return;
    setLoading(true);
    try {
      const age = calcAge(data.birth_date);
      const birthISO = toISO(data.birth_date);

      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        height: data.taille ? Number(data.taille) : null,
        weight: data.poids ? Number(data.poids) : null,
        age: age,
        birth_date: birthISO,
        gender: data.genre || null,
        regime: data.regime || null,
        goal: data.objectif || null,
        secondary_goal: data.objectif_secondaire || null,
        activity_level: data.niveau_activite || null,
        training_time: data.heure_entrainement || null,
        monthly_budget: data.budget_mensuel || null,
        onboarding_done: true,
      });
      setLoading(false);
      if (error) {
        console.error('Onboarding error:', error);
        if (Platform.OS === 'web') {
          window.alert('Erreur : ' + error.message);
        } else {
          Alert.alert('Erreur', error.message);
        }
      } else {
        onComplete();
      }
    } catch (e: any) {
      setLoading(false);
      console.error('Onboarding catch:', e);
      onComplete();
    }
  }

  const steps = ['Bienvenue', 'Profil', 'Objectifs', 'Planning'];
  const age = data.birth_date.length >= 10 ? calcAge(data.birth_date) : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress dots */}
      <View style={styles.progressContainer}>
        {steps.map((label, i) => (
          <View key={i} style={styles.stepContainer}>
            <View
              style={[
                styles.dot,
                i === step && styles.dotActive,
                i < step && styles.dotCompleted,
              ]}
            >
              {i < step && <Text style={styles.dotCheck}>✓</Text>}
              {i >= step && (
                <Text style={[styles.dotNumber, i === step && styles.dotNumberActive]}>
                  {i + 1}
                </Text>
              )}
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepLine, i < step && styles.stepLineCompleted]} />
            )}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 0: Bienvenue + régime */}
          {step === 0 && (
            <View>
              <Text style={styles.stepTitle}>Bienvenue sur La Gamelle Fit ! 🎉</Text>
              <Text style={styles.stepSubtitle}>
                Pour personnaliser ton expérience, dis-nous quel est ton objectif principal.
              </Text>
              <Text style={styles.fieldLabel}>Choisis ton régime</Text>
              <View style={styles.regimeCards}>
                {REGIMES.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.regimeCard,
                      data.regime === r.key && styles.regimeCardActive,
                    ]}
                    onPress={() => update('regime', r.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.regimeEmoji}>{r.emoji}</Text>
                    <Text
                      style={[
                        styles.regimeLabel,
                        data.regime === r.key && styles.regimeLabelActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                    <Text style={styles.regimeDesc}>{r.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Profil */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Ton profil 👤</Text>
              <Text style={styles.stepSubtitle}>
                Ces informations nous permettent de personnaliser tes recettes et macros.
              </Text>

              <Text style={styles.fieldLabel}>Prénom *</Text>
              <TextInput
                style={styles.input}
                value={data.first_name}
                onChangeText={(v) => update('first_name', v)}
                placeholder="Ton prénom"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput
                style={styles.input}
                value={data.last_name}
                onChangeText={(v) => update('last_name', v)}
                placeholder="Ton nom de famille"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Taille (cm)</Text>
                  <TextInput
                    style={styles.input}
                    value={data.taille}
                    onChangeText={(v) => update('taille', v)}
                    placeholder="175"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Poids (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={data.poids}
                    onChangeText={(v) => update('poids', v)}
                    placeholder="70"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* Date de naissance → calcul âge auto */}
              <Text style={styles.fieldLabel}>Date de naissance</Text>
              <View style={styles.birthWrapper}>
                <TextInput
                  style={styles.birthInput}
                  value={data.birth_date}
                  onChangeText={(v) => update('birth_date', formatBirthDate(v, data.birth_date))}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                />
                {age !== null && (
                  <View style={styles.ageBadge}>
                    <Text style={styles.ageBadgeText}>{age} ans</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Genre</Text>
              <View style={styles.genreRow}>
                {['Homme', 'Femme', 'Autre'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genreButton,
                      data.genre === g && styles.genreButtonActive,
                    ]}
                    onPress={() => update('genre', g)}
                  >
                    <Text
                      style={[
                        styles.genreButtonText,
                        data.genre === g && styles.genreButtonTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Objectifs */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Tes objectifs 🎯</Text>
              <Text style={styles.stepSubtitle}>
                Définis ton objectif principal et un objectif secondaire pour affiner ton coaching.
              </Text>

              {/* Objectif principal */}
              <Text style={styles.fieldLabel}>Objectif principal</Text>
              <View style={styles.objectifsGrid}>
                {OBJECTIFS.map((obj) => (
                  <TouchableOpacity
                    key={obj.key}
                    style={[
                      styles.objectifCard,
                      data.objectif === obj.key && styles.objectifCardActive,
                      // désactiver si déjà choisi en secondaire
                      data.objectif_secondaire === obj.key && styles.objectifCardDisabled,
                    ]}
                    onPress={() => {
                      if (data.objectif_secondaire === obj.key) return; // même que secondaire → ignore
                      update('objectif', obj.key);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.objectifEmoji}>{obj.emoji}</Text>
                    <Text
                      style={[
                        styles.objectifLabel,
                        data.objectif === obj.key && styles.objectifLabelActive,
                      ]}
                    >
                      {obj.label}
                    </Text>
                    {data.objectif === obj.key && (
                      <View style={styles.objectifBadge}>
                        <Text style={styles.objectifBadgeText}>Principal</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Objectif secondaire */}
              <Text style={[styles.fieldLabel, { marginTop: 28 }]}>
                Objectif secondaire{' '}
                <Text style={styles.optionalTag}>(optionnel)</Text>
              </Text>
              <View style={styles.objectifsGrid}>
                {OBJECTIFS.filter((o) => o.key !== data.objectif).map((obj) => (
                  <TouchableOpacity
                    key={obj.key}
                    style={[
                      styles.objectifCard,
                      data.objectif_secondaire === obj.key && styles.objectifCardSecondaire,
                    ]}
                    onPress={() =>
                      update(
                        'objectif_secondaire',
                        data.objectif_secondaire === obj.key ? '' : obj.key
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.objectifEmoji}>{obj.emoji}</Text>
                    <Text
                      style={[
                        styles.objectifLabel,
                        data.objectif_secondaire === obj.key && styles.objectifLabelSecondaire,
                      ]}
                    >
                      {obj.label}
                    </Text>
                    {data.objectif_secondaire === obj.key && (
                      <View style={styles.objectifBadgeSecondaire}>
                        <Text style={styles.objectifBadgeText}>Secondaire</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Niveau d'activité */}
              <Text style={[styles.fieldLabel, { marginTop: 28 }]}>Niveau d'activité</Text>
              {NIVEAUX.map((n) => (
                <TouchableOpacity
                  key={n.key}
                  style={[
                    styles.selectItem,
                    data.niveau_activite === n.key && styles.selectItemActive,
                  ]}
                  onPress={() => update('niveau_activite', n.key)}
                >
                  <View>
                    <Text
                      style={[
                        styles.selectItemText,
                        data.niveau_activite === n.key && styles.selectItemTextActive,
                      ]}
                    >
                      {n.label}
                    </Text>
                    <Text style={styles.selectItemDesc}>{n.desc}</Text>
                  </View>
                  {data.niveau_activite === n.key && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 3: Planning */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Ton planning 📅</Text>
              <Text style={styles.stepSubtitle}>
                Ces informations nous aident à adapter tes repas à ton rythme de vie.
              </Text>

              <Text style={styles.fieldLabel}>Heure d'entraînement préférée</Text>
              <View style={styles.pillsGrid}>
                {HORAIRES.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.pill,
                      data.heure_entrainement === h && styles.pillActive,
                    ]}
                    onPress={() => update('heure_entrainement', h)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        data.heure_entrainement === h && styles.pillTextActive,
                      ]}
                    >
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>
                Budget mensuel alimentation saine
              </Text>
              <BudgetSlider
                value={data.budget_mensuel}
                onChange={(v) => update('budget_mensuel', v as any)}
              />

              <View style={styles.readyCard}>
                <Text style={styles.readyEmoji}>🎉</Text>
                <Text style={styles.readyTitle}>Tout est prêt !</Text>
                <Text style={styles.readyText}>
                  Ton profil va être créé et tes recettes personnalisées seront disponibles immédiatement.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA Button */}
      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backBtnText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={nextStep}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 3 ? "C'est parti ! 🚀" : 'Continuer →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 32,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: Colors.darkGreen,
  },
  dotCompleted: {
    backgroundColor: Colors.lime,
  },
  dotNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dotNumberActive: {
    color: Colors.white,
  },
  dotCheck: {
    fontSize: 14,
    color: Colors.darkGreen,
    fontWeight: '900',
  },
  stepLine: {
    width: 28,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: Colors.lime,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  stepSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },

  /* Date de naissance */
  birthWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  birthInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  ageBadge: {
    backgroundColor: Colors.lime + '30',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.lime,
  },
  ageBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.darkGreen,
  },

  /* Genre */
  genreRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 2,
  },
  genreButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  genreButtonActive: {
    backgroundColor: Colors.darkGreen,
    borderColor: Colors.darkGreen,
  },
  genreButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  genreButtonTextActive: {
    color: Colors.white,
  },

  /* Régimes */
  regimeCards: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  regimeCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  regimeCardActive: {
    borderColor: Colors.lime,
    backgroundColor: Colors.lime + '15',
  },
  regimeEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  regimeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  regimeLabelActive: {
    color: Colors.darkGreen,
  },
  regimeDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  /* Objectifs grid */
  objectifsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  objectifCard: {
    width: (width - 48 - 10) / 2,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    position: 'relative',
  },
  objectifCardActive: {
    borderColor: Colors.darkGreen,
    backgroundColor: Colors.darkGreen + '08',
  },
  objectifCardSecondaire: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + '08',
  },
  objectifCardDisabled: {
    opacity: 0.4,
  },
  objectifEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  objectifLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  objectifLabelActive: {
    color: Colors.darkGreen,
    fontWeight: '700',
  },
  objectifLabelSecondaire: {
    color: Colors.orange,
    fontWeight: '700',
  },
  objectifBadge: {
    marginTop: 6,
    backgroundColor: Colors.darkGreen,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  objectifBadgeSecondaire: {
    marginTop: 6,
    backgroundColor: Colors.orange,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  objectifBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },

  /* Niveau / select */
  selectItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectItemActive: {
    borderColor: Colors.darkGreen,
    backgroundColor: Colors.darkGreen + '08',
  },
  selectItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  selectItemTextActive: {
    color: Colors.darkGreen,
    fontWeight: '700',
  },
  selectItemDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    color: Colors.darkGreen,
    fontWeight: '900',
  },

  /* Pills */
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  pillActive: {
    backgroundColor: Colors.darkGreen,
    borderColor: Colors.darkGreen,
  },
  pillText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: Colors.white,
  },

  /* Ready card */
  readyCard: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 28,
  },
  readyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 8,
  },
  readyText: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  backBtn: {
    alignItems: 'center',
  },
  backBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  nextButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
