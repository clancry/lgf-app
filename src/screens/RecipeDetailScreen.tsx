import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getRecipeById, toggleRecipeLike, getUserLikes, addToMealPlan, supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';
import { RootStackParamList } from '../../App';

const { width } = Dimensions.get('window');

interface RecipeDetailScreenProps {
  route: RouteProp<RootStackParamList, 'RecipeDetail'>;
  navigation: StackNavigationProp<RootStackParamList, 'RecipeDetail'>;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  calories?: number;
  proteines?: number;
  glucides?: number;
  lipides?: number;
  category?: string;
  regime?: string;
  likes?: number;
  image_url?: string;
  prep_time?: number;
  ingredients?: string[];
  instructions?: string;
  servings?: number;
  sauces?: string[];
}

const MEAL_TYPES = [
  { key: 'petit_dejeuner', label: '🌅 Petit-déjeuner' },
  { key: 'dejeuner', label: '☀️ Déjeuner' },
  { key: 'collation', label: '🍎 Collation' },
  { key: 'diner', label: '🌙 Dîner' },
];

export default function RecipeDetailScreen({ route, navigation }: RecipeDetailScreenProps) {
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const [addingToPlan, setAddingToPlan] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
    loadRecipe();
  }, [recipeId]);

  async function loadRecipe() {
    setLoading(true);
    const { recipe: data } = await getRecipeById(recipeId);
    if (data) {
      setRecipe(data);
      setLikesCount(data.likes ?? 0);
      // Check if user liked
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { likes } = await getUserLikes(user.id);
        setLiked(likes.includes(recipeId));
      }
    }
    setLoading(false);
  }

  async function handleLike() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLikeLoading(true);
    const { error } = await toggleRecipeLike(user.id, recipeId, liked);
    if (!error) {
      setLiked(!liked);
      setLikesCount((prev) => (liked ? prev - 1 : prev + 1));
    }
    setLikeLoading(false);
  }

  async function handleAddToPlan(mealType: string) {
    if (!currentUser) return;
    setAddingToPlan(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await addToMealPlan(currentUser.id, recipeId, today, mealType);
    setAddingToPlan(false);
    setShowAddToPlan(false);
    if (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter au plan. Réessaie.');
    } else {
      Alert.alert('Ajouté !', `${recipe?.name} a été ajouté à ton plan du jour.`);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Recette introuvable</Text>
      </View>
    );
  }

  const isFlame = (recipe.likes ?? 0) >= 20;
  const regime = recipe.regime;
  const regimeColor =
    regime === 'masse' ? Colors.orange : regime === 'seche' ? Colors.info : Colors.success;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero visual */}
        <View style={[styles.hero, { backgroundColor: Colors.darkGreen }]}>
          <View style={styles.heroContent}>
            <Text style={styles.heroEmoji}>🥗</Text>
            {isFlame && (
              <View style={styles.flameBadge}>
                <Text style={styles.flameBadgeText}>🔥 Populaire</Text>
              </View>
            )}
          </View>
          {/* Regime badge */}
          {regime && (
            <View
              style={[
                styles.regimeBadge,
                { backgroundColor: regimeColor + '30', borderColor: regimeColor },
              ]}
            >
              <Text style={[styles.regimeBadgeText, { color: regimeColor }]}>
                {regime === 'masse' ? '💪 Masse' : regime === 'seche' ? '🔥 Sèche' : '⚖️ Équilibré'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Title + like */}
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{recipe.name}</Text>
              {recipe.prep_time && (
                <Text style={styles.prepTime}>⏱️ {recipe.prep_time} min</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.likeButton, liked && styles.likeButtonActive]}
              onPress={handleLike}
              disabled={likeLoading}
            >
              {likeLoading ? (
                <ActivityIndicator size="small" color={liked ? Colors.white : Colors.orange} />
              ) : (
                <>
                  <Text style={styles.likeEmoji}>{liked ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
                    {likesCount}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}

          {/* Macros */}
          <View style={styles.macrosCard}>
            {[
              { label: 'Calories', value: `${recipe.calories ?? 0}`, unit: 'kcal', color: Colors.darkGreen },
              { label: 'Protéines', value: `${recipe.proteines ?? 0}`, unit: 'g', color: Colors.proteines },
              { label: 'Glucides', value: `${recipe.glucides ?? 0}`, unit: 'g', color: Colors.glucides },
              { label: 'Lipides', value: `${recipe.lipides ?? 0}`, unit: 'g', color: Colors.lipides },
            ].map(({ label, value, unit, color }) => (
              <View key={label} style={styles.macroItem}>
                <Text style={[styles.macroValue, { color }]}>{value}</Text>
                <Text style={styles.macroUnit}>{unit}</Text>
                <Text style={styles.macroLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingrédients 🛒</Text>
              {recipe.ingredients.map((ing: string, i: number) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <Text style={styles.ingredientText}>{ing}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Sauces */}
          {recipe.sauces && recipe.sauces.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sauces 🫙</Text>
              <View style={styles.saucesRow}>
                {recipe.sauces.map((sauce: string, i: number) => (
                  <View key={i} style={styles.saucePill}>
                    <Text style={styles.saucePillText}>{sauce}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Instructions */}
          {recipe.instructions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Préparation 👨‍🍳</Text>
              <Text style={styles.instructions}>{recipe.instructions}</Text>
            </View>
          )}

          {/* Add to plan button */}
          <TouchableOpacity
            style={styles.addToPlanButton}
            onPress={() => setShowAddToPlan(true)}
          >
            <Text style={styles.addToPlanText}>+ Ajouter au plan du jour</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Add to plan modal */}
      <Modal
        visible={showAddToPlan}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddToPlan(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter au plan</Text>
            <Text style={styles.modalSubtitle}>Choisir le repas du jour</Text>
            {MEAL_TYPES.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={styles.mealTypeButton}
                onPress={() => handleAddToPlan(key)}
                disabled={addingToPlan}
              >
                <Text style={styles.mealTypeText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAddToPlan(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  errorText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  hero: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroContent: {
    alignItems: 'center',
    gap: 12,
  },
  heroEmoji: {
    fontSize: 64,
  },
  flameBadge: {
    backgroundColor: Colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  flameBadgeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  regimeBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  regimeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  titleContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  prepTime: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  likeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  likeButtonActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  likeEmoji: {
    fontSize: 18,
  },
  likeCount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  likeCountActive: {
    color: Colors.white,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  macrosCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  macroItem: {
    alignItems: 'center',
    gap: 2,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  macroUnit: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  macroLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.lime,
  },
  ingredientText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  saucesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saucePill: {
    backgroundColor: Colors.darkGreen + '15',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.darkGreen + '30',
  },
  saucePillText: {
    fontSize: 14,
    color: Colors.darkGreen,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 24,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
  },
  addToPlanButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  addToPlanText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  mealTypeButton: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mealTypeText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelButtonText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
});
