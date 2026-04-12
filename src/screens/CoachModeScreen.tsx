import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { Colors } from '../theme/colors';
import { CoachMode, COACH_MODES } from '../lib/coach-modes';
import { supabase } from '../lib/supabase';

interface CoachModeScreenProps {
  session: Session | null;
  currentMode: CoachMode;
  onModeChange: (mode: CoachMode) => void;
  onClose: () => void;
}

export default function CoachModeScreen({ session, currentMode, onModeChange, onClose }: CoachModeScreenProps) {
  const [selected, setSelected] = useState<CoachMode>(currentMode);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    if (session?.user) {
      await supabase.from('profiles').update({ coach_mode: selected }).eq('id', session.user.id);
    }
    onModeChange(selected);
    setSaving(false);
    onClose();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choisis ton Coach</Text>
        <Text style={styles.headerSub}>Ton coach adapte son ton et ses exigences à ton mode</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {COACH_MODES.map((mode) => {
          const isSelected = selected === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeCard, isSelected && { borderColor: mode.color, borderWidth: 3 }]}
              onPress={() => setSelected(mode.id)}
              activeOpacity={0.8}
            >
              <View style={styles.modeHeader}>
                <View style={[styles.modeIconBg, { backgroundColor: mode.color + '20' }]}>
                  <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                </View>
                <View style={styles.modeInfo}>
                  <Text style={styles.modeName}>{mode.name}</Text>
                  <Text style={[styles.modeTagline, { color: mode.color }]}>{mode.tagline}</Text>
                </View>
                {isSelected && (
                  <View style={[styles.selectedBadge, { backgroundColor: mode.color }]}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modeDesc}>{mode.description}</Text>

              {/* Barre de tolérance */}
              <View style={styles.toleranceRow}>
                <Text style={styles.toleranceLabel}>Tolérance aux écarts</Text>
                <View style={styles.toleranceBar}>
                  <View style={[styles.toleranceFill, { width: `${mode.tolerance}%` as any, backgroundColor: mode.color }]} />
                </View>
                <Text style={[styles.toleranceValue, { color: mode.color }]}>
                  {mode.tolerance >= 80 ? 'Élevée' : mode.tolerance >= 50 ? 'Modérée' : mode.tolerance >= 20 ? 'Faible' : 'Nulle'}
                </Text>
              </View>

              {mode.id === 'warrior' && (
                <View style={styles.warningStrip}>
                  <Text style={styles.warningStripText}>⚔️ Mode extrême — punitions physiques en cas d'écart</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Enregistrement...' : `Activer le mode ${COACH_MODES.find(m => m.id === selected)?.name} ${COACH_MODES.find(m => m.id === selected)?.emoji}`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  header: { backgroundColor: Colors.darkGreen, padding: 20, paddingTop: 12 },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  closeBtnText: { color: '#fff', fontSize: 18 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  modeCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 2, borderColor: 'transparent', gap: 12 },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeIconBg: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  modeEmoji: { fontSize: 24 },
  modeInfo: { flex: 1 },
  modeName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modeTagline: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  selectedBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  selectedBadgeText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  modeDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  toleranceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toleranceLabel: { fontSize: 11, color: Colors.textMuted, width: 120 },
  toleranceBar: { flex: 1, height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  toleranceFill: { height: '100%', borderRadius: 3 },
  toleranceValue: { fontSize: 11, fontWeight: '700', width: 50, textAlign: 'right' },
  warningStrip: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 10, marginTop: 4 },
  warningStripText: { color: '#EF4444', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.darkGreen, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
