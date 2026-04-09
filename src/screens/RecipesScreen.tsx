import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { getRecipes, getUserLikes } from '../lib/supabase';
import { Colors } from '../theme/colors';
import RecipeCard from '../components/RecipeCard';
import { RootStackParamList } from '../../App';

interface RecipesScreenProps {
  session: Session | null;
}

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
  image_url?: string;
  prep_time?: number;
}

const REGIMES = [
  { key: '', label: 'Tous' },
  { key: 'masse', label: '💪 Masse' },
  { key: 'seche', label: '🔥 Sèche' },
  { key: 'equilibre', label: '⚖️ Équilibré' },
];

const CATEGORIES = [
  { key: '', label: 'Tout' },
  { key: 'repas', label: '🍽️ Repas' },
  { key: 'snack', label: '🍎 Snack' },
  { key: 'dessert', label: '🍮 Dessert' },
  { key: 'patisserie', label: '🧁 Pâtisserie' },
  { key: 'petit_dejeuner', label: '🌅 Petit-déj' },
];

export default function RecipesScreen({ session }: RecipesScreenProps) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [userLikes, setUserLikes] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [regimeFilter, setRegimeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    const { recipes: data } = await getRecipes({
      regime: regimeFilter || undefined,
      category: categoryFilter || undefined,
      search: search || undefined,
    });
    setRecipes(data ?? []);
    setLoading(false);
  }, [regimeFilter, categoryFilter, search]);

  useEffect(() => {
    const timer = setTimeout(loadRecipes, 300);
    return () => clearTimeout(timer);
  }, [loadRecipes]);

  useEffect(() => {
    if (session?.user) {
      getUserLikes(session.user.id).then(({ likes }) => setUserLikes(likes));
    }
  }, [session]);

  function openRecipe(id: string) {
    navigation.navigate('RecipeDetail', { recipeId: id });
  }

  function toggleLikeLocal(id: string, liked: boolean) {
    setUserLikes((prev) =>
      liked ? prev.filter((l) => l !== id) : [...prev, id]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recettes 🥗</Text>
        <Text style={styles.count}>{recipes.length} recettes</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une recette..."
            placeholderTextColor={Colors.textMuted}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Regime filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={styles.filtersContent}
      >
        {REGIMES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              regimeFilter === key && styles.filterChipActive,
            ]}
            onPress={() => setRegimeFilter(key)}
          >
            <Text
              style={[
                styles.filterChipText,
                regimeFilter === key && styles.filterChipTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={styles.filtersContent}
      >
        {CATEGORIES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              styles.filterChipSecondary,
              categoryFilter === key && styles.filterChipActive,
            ]}
            onPress={() => setCategoryFilter(key)}
          >
            <Text
              style={[
                styles.filterChipText,
                categoryFilter === key && styles.filterChipTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recipe list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.darkGreen} />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              liked={userLikes.includes(item.id)}
              onPress={() => openRecipe(item.id)}
              onLikeToggle={(liked) => toggleLikeLocal(item.id, liked)}
              session={session}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyText}>Aucune recette trouvée</Text>
              <Text style={styles.emptySubtext}>
                Essaie de modifier tes filtres
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  count: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  filtersRow: {
    backgroundColor: Colors.white,
    maxHeight: 48,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginRight: 8,
  },
  filterChipSecondary: {
    backgroundColor: Colors.background,
  },
  filterChipActive: {
    backgroundColor: Colors.darkGreen,
    borderColor: Colors.darkGreen,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 12,
    paddingBottom: 32,
  },
  row: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
