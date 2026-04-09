import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../theme/colors';

interface Recipe {
  id: string;
  name: string;
  calories?: number;
  proteines?: number;
  glucides?: number;
  lipides?: number;
  category?: string;
  prep_time?: number;
}

interface BreakfastCardProps {
  recipe: Recipe | null;
  onShuffle: () => Promise<void>;
}

export default function BreakfastCard({ recipe, onShuffle }: BreakfastCardProps) {
  const [shuffling, setShuffling] = useState(false);

  async function handleShuffle() {
    setShuffling(true);
    await onShuffle();
    setShuffling(false);
  }

  if (!recipe) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌅</Text>
          <Text style={styles.emptyText}>Aucun petit-déjeuner planifié</Text>
          <TouchableOpacity style={styles.shuffleButton} onPress={handleShuffle}>
            <Text style={styles.shuffleButtonText}>🔀 Suggérer un petit-déj</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Visual area */}
      <View style={styles.visual}>
        <Text style={styles.visualEmoji}>🌅</Text>
        <View style={styles.visualOverlay}>
          <Text style={styles.visualLabel}>Petit-déjeuner du jour</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.recipeName} numberOfLines={2}>
            {recipe.name}
          </Text>
          <TouchableOpacity
            style={styles.shuffleIcon}
            onPress={handleShuffle}
            disabled={shuffling}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {shuffling ? (
              <ActivityIndicator size="small" color={Colors.darkGreen} />
            ) : (
              <Text style={styles.shuffleIconText}>🔀</Text>
            )}
          </TouchableOpacity>
        </View>

        {recipe.prep_time && (
          <Text style={styles.prepTime}>⏱️ {recipe.prep_time} min de préparation</Text>
        )}

        {/* Macros */}
        <View style={styles.macrosRow}>
          {[
            {
              label: 'Calories',
              value: recipe.calories ?? 0,
              unit: 'kcal',
              color: Colors.darkGreen,
            },
            {
              label: 'Protéines',
              value: recipe.proteines ?? 0,
              unit: 'g',
              color: Colors.proteines,
            },
            {
              label: 'Glucides',
              value: recipe.glucides ?? 0,
              unit: 'g',
              color: Colors.glucides,
            },
            {
              label: 'Lipides',
              value: recipe.lipides ?? 0,
              unit: 'g',
              color: Colors.lipides,
            },
          ].map(({ label, value, unit, color }) => (
            <View key={label} style={styles.macroItem}>
              <Text style={[styles.macroValue, { color }]}>
                {value}
                <Text style={styles.macroUnit}>{unit}</Text>
              </Text>
              <Text style={styles.macroLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Voir la recette complète →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={handleShuffle}
            disabled={shuffling}
          >
            {shuffling ? (
              <ActivityIndicator size="small" color={Colors.darkGreen} />
            ) : (
              <Text style={styles.secondaryActionText}>🔀 Autre suggestion</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  shuffleButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shuffleButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  visual: {
    height: 90,
    backgroundColor: Colors.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  visualEmoji: {
    fontSize: 40,
  },
  visualOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  visualLabel: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.9,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  recipeName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  shuffleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shuffleIconText: {
    fontSize: 16,
  },
  prepTime: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  macroItem: {
    alignItems: 'center',
    gap: 2,
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  macroUnit: {
    fontSize: 10,
    fontWeight: '500',
  },
  macroLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  actions: {
    gap: 8,
    marginTop: 2,
  },
  primaryAction: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryActionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
