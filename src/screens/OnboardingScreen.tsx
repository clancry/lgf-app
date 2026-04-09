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
  age: string;
  genre: string;
  regime: string;
  objectif: string;
  niveau_activite: string;
  heure_entrainement: string;
  budget_mensuel: string;
}

const REGIMES = [
  { key: 'masse', label: 'Prise de masse', emoji: '💪', desc: 'Gagner du muscle' },
  { key: 'seche', label: 'Sèche', emoji: '🔥', desc: 'Perdre du gras' },
  { key: 'equilibre', label: 'Équilibré', emoji: '⚖️', desc: 'Rester en forme' },
];

const OBJECTIFS = [
  'Perdre du poids',
  'Prendre du muscle',
  'Améliorer mes performances',
  'Adopter une meilleure alimentation',
  'Gérer mon stress',
];

const NIVEAUX = [
  { key: 'sedentaire', label: 'Sédentaire', desc: '< 1h sport/semaine' },
  { key: 'modere', label: 'Modéré', desc: '1-3h sport/semaine' },
  { key: 'actif', label: 'Actif', desc: '3-5h sport/semaine' },
  { key: 'tres_actif', label: 'Très actif', desc: '> 5h sport/semaine' },
];

const HORAIRES = ['06:00', '07:00', '08:00', '12:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const BUDGETS = ['< 50€', '50-100€', '100-200€', '> 200€'];

export default function OnboardingScreen({ session, onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    first_name: '',
    last_name: '',
    taille: '',
    poids: '',
    age: '',
    genre: '',
    regime: '',
    objectif: '',
    niveau_activite: '',
    heure_entrainement: '',
    budget_mensuel: '',
  });

  function update(key: keyof OnboardingData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (step === 0 && !data.regime) {
      Alert.alert('Choix requis', 'Sélectionne ton régime pour continuer.');
      return;
    }
    if (step === 1) {
      if (!data.first_name || !data.last_name) {
        Alert.alert('Informations manquantes', 'Prénom et nom sont requis.');
        return;
      }
    }
    if (step < 3) setStep(step + 1);
    else handleFinish();
  }

  async function handleFinish() {
    if (!session?.user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      first_name: data.first_name,
      last_name: data.last_name,
      taille: data.taille ? Number(data.taille) : null,
      poids: data.poids ? Number(data.poids) : null,
      age: data.age ? Number(data.age) : null,
      genre: data.genre,
      regime: data.regime,
      objectif: data.objectif,
      niveau_activite: data.niveau_activite,
      heure_entrainement: data.heure_entrainement,
      budget_mensuel: data.budget_mensuel,
      onboarding_done: true,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', "Impossible de sauvegarder ton profil. Réessaie.");
    } else {
      onComplete();
    }
  }

  const steps = ['Bienvenue', 'Profil', 'Objectifs', 'Planning'];

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

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Âge</Text>
                  <TextInput
                    style={styles.input}
                    value={data.age}
                    onChangeText={(v) => update('age', v)}
                    placeholder="25"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Genre</Text>
                  <View style={styles.genreRow}>
                    {['Homme', 'Femme'].map((g) => (
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
              </View>
            </View>
          )}

          {/* Step 2: Objectifs */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Tes objectifs 🎯</Text>
              <Text style={styles.stepSubtitle}>
                Précise ton objectif principal et ton niveau d'activité physique.
              </Text>

              <Text style={styles.fieldLabel}>Objectif principal</Text>
              {OBJECTIFS.map((obj) => (
                <TouchableOpacity
                  key={obj}
                  style={[
                    styles.selectItem,
                    data.objectif === obj && styles.selectItemActive,
                  ]}
                  onPress={() => update('objectif', obj)}
                >
                  <Text
                    style={[
                      styles.selectItemText,
                      data.objectif === obj && styles.selectItemTextActive,
                    ]}
                  >
                    {obj}
                  </Text>
                  {data.objectif === obj && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>
                Niveau d'activité
              </Text>
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
                Budget mensuel alimentation
              </Text>
              <View style={styles.pillsGrid}>
                {BUDGETS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.pill,
                      data.budget_mensuel === b && styles.pillActive,
                    ]}
                    onPress={() => update('budget_mensuel', b)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        data.budget_mensuel === b && styles.pillTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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
