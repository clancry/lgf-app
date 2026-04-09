import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { toggleRecipeLike } from '../lib/supabase';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 12 * 3) / 2;

interface Recipe {
  id: string;
  name: string;
  calories?: number;
  proteines?: number;
  glucides?: number;
  lipides?: number;
  category?: string;
  regime?: string;
  likes?: number;
  prep_time?: number;
}

interface RecipeCardProps {
  recipe: Recipe;
  liked: boolean;
  onPress: () => void;
  onLikeToggle: (liked: boolean) => void;
  session: Session | null;
}

const REGIME_COLORS: Record<string, string> = {
  masse: Colors.orange,
  seche: Colors.info,
  equilibre: Colors.success,
};

const CATEGORY_EMOJIS: Record<string, string> = {
  repas: '🍽️',
  snack: '🍎',
  dessert: '🍮',
  patisserie: '🧁',
  petit_dejeuner: '🌅',
  default: '🥗',
};

export default function RecipeCard({
  recipe,
  liked,
  onPress,
  onLikeToggle,
  session,
}: RecipeCardProps) {
  const [likeLoading, setLikeLoading] = useState(false);
  const [localLiked, setLocalLiked] = useState(liked);
  const [localLikes, setLocalLikes] = useState(recipe.likes ?? 0);

  async function handleLike() {
    if (!session?.user || likeLoading) return;
    setLikeLoading(true);
    const { error } = await toggleRecipeLike(session.user.id, recipe.id, localLiked);
    if (!error) {
      const newLiked = !localLiked;
      setLocalLiked(newLiked);
      setLocalLikes((prev) => (localLiked ? prev - 1 : prev + 1));
      onLikeToggle(localLiked);
    }
    setLikeLoading(false);
  }

  const isFlame = localLikes >= 20;
  const regimeColor = REGIME_COLORS[recipe.regime ?? ''] ?? Colors.textMuted;
  const categoryEmoji = CATEGORY_EMOJIS[recipe.category ?? 'default'] ?? CATEGORY_EMOJIS.default;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Visual placeholder */}
      <View style={[styles.imageArea, { backgroundColor: regimeColor + '20' }]}>
        <Text style={styles.imageEmoji}>{categoryEmoji}</Text>
        {isFlame && (
          <View style={styles.flameBadge}>
            <Text style={styles.flameBadgeText}>🔥</Text>
          </View>
        )}
        {recipe.regime && (
          <View
            style={[
              styles.regimePill,
              { backgroundColor: regimeColor, },
            ]}
          >
            <Text style={styles.regimePillText}>
              {recipe.regime === 'masse' ? '💪' : recipe.regime === 'seche' ? '🔥' : '⚖️'}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>

        {/* Macros row */}
        <View style={styles.macros}>
          {recipe.calories !== undefined && (
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: Colors.darkGreen }]}>
                {recipe.calories}
              </Text>
              <Text style={styles.macroUnit}>kcal</Text>
            </View>
          )}
          {recipe.proteines !== undefined && (
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: Colors.proteines }]}>
                {recipe.proteines}g
              </Text>
              <Text style={styles.macroUnit}>prot.</Text>
            </View>
          )}
        </View>

        {/* Prep time + like */}
        <View style={styles.footer}>
          {recipe.prep_time && (
            <Text style={styles.prepTime}>⏱️ {recipe.prep_time}min</Text>
          )}
          <TouchableOpacity
            style={styles.likeButton}
            onPress={handleLike}
            disabled={likeLoading || !session}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {likeLoading ? (
              <ActivityIndicator size="small" color={Colors.orange} />
            ) : (
              <Text style={styles.likeText}>
                {localLiked ? '❤️' : '🤍'} {localLikes}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageArea: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageEmoji: {
    fontSize: 40,
  },
  flameBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flameBadgeText: {
    fontSize: 12,
  },
  regimePill: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regimePillText: {
    fontSize: 12,
  },
  content: {
    padding: 10,
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  macros: {
    flexDirection: 'row',
    gap: 10,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  macroUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  prepTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  likeButton: {
    padding: 2,
  },
  likeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
