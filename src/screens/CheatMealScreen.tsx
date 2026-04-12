import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { Colors } from '../theme/colors';
import { CoachMode, COACH_MODES, getCheatMealResponse } from '../lib/coach-modes';

interface CheatMealScreenProps {
  session: Session | null;
  coachMode: CoachMode;
  regime: string;
  dailyCalories: number;
  onClose: () => void;
}

export default function CheatMealScreen({
  coachMode, regime, dailyCalories, onClose,
}: CheatMealScreenProps) {
  const [step, setStep] = useState<'input' | 'response' | 'punishment'>('input');
  const [food, setFood] = useState('');
  const [response, setResponse] = useState<ReturnType<typeof getCheatMealResponse> | null>(null);
  const [punishmentDone, setPunishmentDone] = useState(false);

  const modeConfig = COACH_MODES.find(m => m.id === coachMode)!;

  function handleSubmit() {
    if (!food.trim()) return;
    const resp = getCheatMealResponse(coachMode, food, regime, dailyCalories);
    setResponse(resp);
    setStep('response');
  }

  function handlePunishment() {
    setStep('punishment');
  }

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: modeConfig.color }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerEmoji}>{modeConfig.emoji}</Text>
        <Text style={styles.headerTitle}>STOP Cheat Meal</Text>
        <Text style={styles.headerSub}>Mode {modeConfig.name}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {step === 'input' && (
          <>
            <View style={styles.warningCard}>
              <Text style={styles.warningEmoji}>⚠️</Text>
              <Text style={styles.warningTitle}>Tu es sur le point de craquer ?</Text>
              <Text style={styles.warningText}>
                Dis-moi ce que tu vas manger et je t'aide à prendre la meilleure décision.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Qu'est-ce que tu veux manger ?</Text>
            <TextInput
              style={styles.input}
              value={food}
              onChangeText={setFood}
              placeholder="Ex: pizza, burger, glace..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: modeConfig.color }]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitBtnText}>Analyse mon écart →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>J'ai résisté 💪 Fermer</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'response' && response && (
          <>
            {/* Intro */}
            <View style={[styles.introCard, { borderLeftColor: modeConfig.color }]}>
              <Text style={styles.introText}>{response.intro}</Text>
            </View>

            {/* Conséquences */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Les conséquences</Text>
              {response.consequences.map((c, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bullet, { backgroundColor: modeConfig.color }]} />
                  <Text style={styles.bulletText}>{c}</Text>
                </View>
              ))}
            </View>

            {/* Rattrapage */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔄 Comment rattraper</Text>
              {response.rattrapage.map((r, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bullet, { backgroundColor: Colors.lime }]} />
                  <Text style={styles.bulletText}>{r}</Text>
                </View>
              ))}
            </View>

            {/* Punition Warrior */}
            {response.punishment && !punishmentDone && (
              <TouchableOpacity
                style={styles.punishmentCard}
                onPress={handlePunishment}
              >
                <Text style={styles.punishmentText}>{response.punishment}</Text>
                <Text style={styles.punishmentCta}>→ Je fais ma punition maintenant</Text>
              </TouchableOpacity>
            )}

            {/* Message de fermeture */}
            <View style={[styles.closingCard, { backgroundColor: modeConfig.color + '15' }]}>
              <Text style={[styles.closingText, { color: modeConfig.color }]}>
                {response.closing}
              </Text>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: modeConfig.color }]}
              onPress={() => { showAlert("Plan ajusté", "Ton plan de la semaine a été mis à jour pour rattraper cet écart."); onClose(); }}
            >
              <Text style={styles.submitBtnText}>Ajuster mon plan →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>J'ai compris. Fermer</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'punishment' && (
          <>
            <View style={[styles.punishmentCard, { marginTop: 0 }]}>
              <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>⚔️</Text>
              <Text style={styles.punishmentText}>PUNITION EN COURS</Text>
              <Text style={[styles.bulletText, { textAlign: 'center', marginTop: 12 }]}>
                100 burpees + 50 jumping squats{'\n'}Démarre maintenant. Je t'attends.
              </Text>
            </View>

            {/* Timer basique */}
            <View style={styles.timerCard}>
              <Text style={styles.timerTitle}>Chronomètre</Text>
              <Text style={styles.timerText}>Lance le chrono et reviens quand c'est fait.</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: Colors.darkGreen }]}
              onPress={() => { setPunishmentDone(true); setStep('response'); }}
            >
              <Text style={styles.submitBtnText}>✓ Punition terminée. Je mérite mes objectifs.</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  header: { padding: 24, alignItems: 'center', paddingTop: 16 },
  closeBtn: { position: 'absolute', top: 16, right: 16, padding: 8 },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerEmoji: { fontSize: 36, marginBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  warningCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#FEF3C7' },
  warningEmoji: { fontSize: 40, marginBottom: 8 },
  warningTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  warningText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  input: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1.5, borderColor: '#E8E8E8', color: Colors.textPrimary },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: Colors.textMuted, fontSize: 14 },
  introCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderLeftWidth: 4 },
  introText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22, fontStyle: 'italic' },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  punishmentCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginTop: 4 },
  punishmentText: { color: '#EF4444', fontSize: 16, fontWeight: '900', textAlign: 'center', lineHeight: 24 },
  punishmentCta: { color: '#fff', fontSize: 13, textAlign: 'center', marginTop: 12, opacity: 0.8 },
  closingCard: { borderRadius: 14, padding: 16, alignItems: 'center' },
  closingText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  timerCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center' },
  timerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  timerText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
});
