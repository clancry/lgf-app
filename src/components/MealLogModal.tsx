import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Switch,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Session } from '@supabase/supabase-js';
import { Colors } from '../theme/colors';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LoggedMeal {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'lgf' | 'manual' | 'scan' | 'user_recipe';
  recipeId?: number;
}

interface LGFRecipe {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  regime: string;
  category: string;
}

interface MealLogModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (meal: LoggedMeal) => void;
  session: Session | null;
  mealType: string;
  regime: string;
  eatenAt?: string;         // heure pré-remplie (HH:MM)
  onEatenAtChange?: (t: string) => void;
  suggestion?: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    recipeId?: number;
  };
}

// Créneaux horaires disponibles pour la saisie d'heure
const TIME_SLOTS: string[] = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30',
  '22:00','22:30',
];

type Tab = 'lgf' | 'manual' | 'scan';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const REGIME_LABEL: Record<string, string> = {
  masse: 'Masse',
  seche: 'Sèche',
  equilibre: 'Équilibre',
};

const REGIME_COLOR: Record<string, string> = {
  masse: Colors.masse,
  seche: Colors.seche,
  equilibre: Colors.equilibre,
};

// Simulated AI analysis results
const AI_SIMULATION_RESULTS = [
  { name: 'Poulet grillé + riz basmati + haricots verts', calories: 540, protein: 42, carbs: 58, fat: 12 },
  { name: 'Salade composée au thon', calories: 380, protein: 34, carbs: 22, fat: 16 },
  { name: 'Pâtes bolognaise maison', calories: 620, protein: 38, carbs: 72, fat: 18 },
  { name: 'Omelette 3 œufs + légumes sautés', calories: 320, protein: 26, carbs: 8, fat: 20 },
  { name: 'Quinoa + pois chiches + légumes rôtis', calories: 460, protein: 22, carbs: 64, fat: 14 },
];

function pickSimulationResult(): typeof AI_SIMULATION_RESULTS[0] {
  return AI_SIMULATION_RESULTS[Math.floor(Math.random() * AI_SIMULATION_RESULTS.length)]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// MacroBadge
// ─────────────────────────────────────────────────────────────────────────────

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[macroBadgeStyles.badge, { borderColor: color + '40', backgroundColor: color + '15' }]}>
      <Text style={[macroBadgeStyles.label, { color }]}>{label}</Text>
      <Text style={[macroBadgeStyles.value, { color }]}>{value}g</Text>
    </View>
  );
}

const macroBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginRight: 2,
  },
  value: {
    fontSize: 10,
    fontWeight: '500',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Nos plats (LGF)
// ─────────────────────────────────────────────────────────────────────────────

interface LGFTabProps {
  regime: string;
  suggestion?: MealLogModalProps['suggestion'];
  onConfirm: (meal: LoggedMeal) => void;
}

function LGFTab({ regime, suggestion, onConfirm }: LGFTabProps) {
  const [recipes, setRecipes] = useState<LGFRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('id,name,calories,protein,carbs,fat,regime,category')
          .eq('regime', regime)
          .order('likes', { ascending: false });

        if (error) throw error;
        setRecipes((data as LGFRecipe[]) ?? []);
      } catch (err) {
        if (Platform.OS === 'web') {
          console.error('Erreur chargement recettes :', err);
        } else {
          Alert.alert('Erreur', 'Impossible de charger les recettes.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [regime]);

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Build displayed list: suggestion pinned at top if not already first in list
  const isSuggestionInList =
    suggestion != null &&
    recipes.some((r) => r.id === suggestion.recipeId);

  const displayList: (LGFRecipe | 'suggestion')[] = [];
  if (suggestion && !isSuggestionInList && search.trim() === '') {
    displayList.push('suggestion');
  }
  displayList.push(...filtered);

  const selectedRecipe = recipes.find((r) => r.id === selectedId) ?? null;

  const handleConfirm = () => {
    if (selectedRecipe) {
      onConfirm({
        name: selectedRecipe.name,
        calories: selectedRecipe.calories,
        protein: selectedRecipe.protein,
        carbs: selectedRecipe.carbs,
        fat: selectedRecipe.fat,
        source: 'lgf',
        recipeId: selectedRecipe.id,
      });
    } else if (selectedId === -1 && suggestion) {
      // suggestion pseudo-card selected
      onConfirm({
        name: suggestion.name,
        calories: suggestion.calories,
        protein: suggestion.protein,
        carbs: suggestion.carbs,
        fat: suggestion.fat,
        source: 'lgf',
        recipeId: suggestion.recipeId,
      });
    }
  };

  if (loading) {
    return (
      <View style={lgfStyles.centered}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
        <Text style={lgfStyles.loadingText}>Chargement des plats...</Text>
      </View>
    );
  }

  return (
    <View style={lgfStyles.container}>
      {/* Search */}
      <View style={lgfStyles.searchRow}>
        <Text style={lgfStyles.searchIcon}>🔍</Text>
        <TextInput
          style={lgfStyles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un plat..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={displayList}
        keyExtractor={(item) =>
          item === 'suggestion' ? 'suggestion-card' : String(item.id)
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          if (item === 'suggestion') {
            // Pinned suggestion card
            const isSelected = selectedId === -1;
            return (
              <TouchableOpacity
                style={[lgfStyles.recipeCard, lgfStyles.suggestionCard, isSelected && lgfStyles.recipeCardSelected]}
                onPress={() => setSelectedId(isSelected ? null : -1)}
                activeOpacity={0.75}
              >
                <View style={lgfStyles.suggestionBadge}>
                  <Text style={lgfStyles.suggestionBadgeText}>✓ Plat suggéré</Text>
                </View>
                <View style={lgfStyles.recipeCardHeader}>
                  <Text style={lgfStyles.recipeName} numberOfLines={2}>
                    {suggestion!.name}
                  </Text>
                  <View style={lgfStyles.calBadge}>
                    <Text style={lgfStyles.calBadgeText}>{suggestion!.calories} kcal</Text>
                  </View>
                </View>
                <View style={lgfStyles.macroRow}>
                  <MacroBadge label="P" value={suggestion!.protein} color={Colors.proteines} />
                  <MacroBadge label="G" value={suggestion!.carbs} color={Colors.glucides} />
                  <MacroBadge label="L" value={suggestion!.fat} color={Colors.lipides} />
                </View>
                {isSelected && (
                  <View style={lgfStyles.selectedCheck}>
                    <Text style={lgfStyles.selectedCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }

          const recipe = item as LGFRecipe;
          const isSugg =
            suggestion?.recipeId === recipe.id ||
            (suggestion?.name === recipe.name && !suggestion?.recipeId);
          const isSelected = selectedId === recipe.id;

          return (
            <TouchableOpacity
              style={[
                lgfStyles.recipeCard,
                isSugg && lgfStyles.suggestionCard,
                isSelected && lgfStyles.recipeCardSelected,
              ]}
              onPress={() => setSelectedId(isSelected ? null : recipe.id)}
              activeOpacity={0.75}
            >
              {isSugg && (
                <View style={lgfStyles.suggestionBadge}>
                  <Text style={lgfStyles.suggestionBadgeText}>✓ Plat suggéré</Text>
                </View>
              )}
              <View style={lgfStyles.recipeCardHeader}>
                <Text style={lgfStyles.recipeName} numberOfLines={2}>
                  {recipe.name}
                </Text>
                <View style={lgfStyles.calBadge}>
                  <Text style={lgfStyles.calBadgeText}>{recipe.calories} kcal</Text>
                </View>
              </View>
              <View style={lgfStyles.macroRow}>
                <MacroBadge label="P" value={recipe.protein} color={Colors.proteines} />
                <MacroBadge label="G" value={recipe.carbs} color={Colors.glucides} />
                <MacroBadge label="L" value={recipe.fat} color={Colors.lipides} />
                <View
                  style={[
                    lgfStyles.regimeBadge,
                    { backgroundColor: (REGIME_COLOR[recipe.regime] ?? Colors.darkGreen) + '20' },
                  ]}
                >
                  <Text style={[lgfStyles.regimeBadgeText, { color: REGIME_COLOR[recipe.regime] ?? Colors.darkGreen }]}>
                    {REGIME_LABEL[recipe.regime] ?? recipe.regime}
                  </Text>
                </View>
              </View>
              {isSelected && (
                <View style={lgfStyles.selectedCheck}>
                  <Text style={lgfStyles.selectedCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Confirm button */}
      {selectedId !== null && (
        <View style={lgfStyles.confirmWrapper}>
          <TouchableOpacity style={lgfStyles.confirmBtn} onPress={handleConfirm}>
            <Text style={lgfStyles.confirmBtnText}>Confirmer ce plat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const lgfStyles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  recipeCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  suggestionCard: {
    borderColor: Colors.lime,
    borderWidth: 2,
  },
  recipeCardSelected: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  recipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recipeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  calBadge: {
    backgroundColor: Colors.darkGreen + '15',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  calBadgeText: {
    color: Colors.darkGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  macroRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  regimeBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  regimeBadgeText: { fontSize: 10, fontWeight: '600' },
  suggestionBadge: {
    backgroundColor: Colors.lime + '30',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  suggestionBadgeText: { fontSize: 10, fontWeight: '700', color: '#5A6B0A' },
  selectedCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.success,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheckText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  confirmWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  confirmBtn: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Maison / Restaurant
// ─────────────────────────────────────────────────────────────────────────────

interface ManualTabProps {
  session: Session | null;
  onConfirm: (meal: LoggedMeal) => void;
}

function ManualTab({ session, onConfirm }: ManualTabProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saveToRecipes, setSaveToRecipes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Le nom est obligatoire.';
    if (!calories.trim() || isNaN(Number(calories))) e.calories = 'Valeur invalide.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const kcal = parseInt(calories, 10) || 0;
      const prot = parseFloat(protein) || 0;
      const crbs = parseFloat(carbs) || 0;
      const lps = parseFloat(fat) || 0;

      if (saveToRecipes && session?.user) {
        const { error } = await supabase.from('user_recipes').insert({
          user_id: session.user.id,
          name: name.trim(),
          calories: kcal,
          protein: prot,
          carbs: crbs,
          fat: lps,
        });
        if (error) throw error;
      }

      onConfirm({
        name: name.trim(),
        calories: kcal,
        protein: prot,
        carbs: crbs,
        fat: lps,
        source: 'manual',
      });
    } catch (err) {
      if (Platform.OS === 'web') {
        console.error('Erreur sauvegarde recette :', err);
      } else {
        Alert.alert('Erreur', "Impossible d'enregistrer la recette.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={manualStyles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nom */}
        <Text style={manualStyles.fieldLabel}>Nom du plat <Text style={manualStyles.required}>*</Text></Text>
        <TextInput
          style={[manualStyles.input, errors.name ? manualStyles.inputError : null]}
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
          placeholder="Ex : Poulet rôti maison"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="next"
        />
        {errors.name ? <Text style={manualStyles.errorText}>{errors.name}</Text> : null}

        {/* Macros grid */}
        <Text style={manualStyles.sectionLabel}>Valeurs nutritionnelles</Text>
        <View style={manualStyles.macroGrid}>
          <View style={manualStyles.macroField}>
            <Text style={manualStyles.macroFieldLabel}>Calories (kcal) <Text style={manualStyles.required}>*</Text></Text>
            <TextInput
              style={[manualStyles.macroInput, errors.calories ? manualStyles.inputError : null]}
              value={calories}
              onChangeText={(t) => { setCalories(t); setErrors((e) => ({ ...e, calories: '' })); }}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              returnKeyType="next"
            />
            {errors.calories ? <Text style={manualStyles.errorText}>{errors.calories}</Text> : null}
          </View>
          <View style={manualStyles.macroField}>
            <Text style={manualStyles.macroFieldLabel}>Protéines (g)</Text>
            <TextInput
              style={manualStyles.macroInput}
              value={protein}
              onChangeText={setProtein}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
          </View>
          <View style={manualStyles.macroField}>
            <Text style={manualStyles.macroFieldLabel}>Glucides (g)</Text>
            <TextInput
              style={manualStyles.macroInput}
              value={carbs}
              onChangeText={setCarbs}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
          </View>
          <View style={manualStyles.macroField}>
            <Text style={manualStyles.macroFieldLabel}>Lipides (g)</Text>
            <TextInput
              style={manualStyles.macroInput}
              value={fat}
              onChangeText={setFat}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Switch enregistrer */}
        {session?.user && (
          <View style={manualStyles.switchRow}>
            <View style={manualStyles.switchTextCol}>
              <Text style={manualStyles.switchLabel}>Enregistrer dans mes recettes</Text>
              <Text style={manualStyles.switchSub}>Retrouvez-la dans "Mes recettes" plus tard</Text>
            </View>
            <Switch
              value={saveToRecipes}
              onValueChange={setSaveToRecipes}
              trackColor={{ false: Colors.border, true: Colors.darkGreen + '80' }}
              thumbColor={saveToRecipes ? Colors.darkGreen : Colors.textMuted}
            />
          </View>
        )}

        {/* Confirm */}
        <TouchableOpacity
          style={[manualStyles.confirmBtn, saving && manualStyles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={manualStyles.confirmBtnText}>Confirmer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const manualStyles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: Colors.error },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  inputError: { borderColor: Colors.error },
  errorText: { fontSize: 12, color: Colors.error, marginBottom: 4 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  macroField: { width: '47%' },
  macroFieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  macroInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    padding: 14,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchTextCol: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  confirmBtn: {
    marginTop: 28,
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Scanner
// ─────────────────────────────────────────────────────────────────────────────

interface ScanTabProps {
  onConfirm: (meal: LoggedMeal) => void;
}

interface ScanResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function ScanTab({ onConfirm }: ScanTabProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  // Adjusted fields
  const [adjName, setAdjName] = useState('');
  const [adjCalories, setAdjCalories] = useState('');
  const [adjProtein, setAdjProtein] = useState('');
  const [adjCarbs, setAdjCarbs] = useState('');
  const [adjFat, setAdjFat] = useState('');

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Permission refusée',
          "L'accès à la caméra est nécessaire pour analyser ton assiette.",
        );
      }
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setResult(null);
        setAdjusting(false);
      }
    } catch (err) {
      if (Platform.OS !== 'web') {
        Alert.alert('Erreur', 'Impossible d\'accéder à la caméra.');
      }
    }
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS !== 'web') {
        Alert.alert('Permission refusée', "L'accès à la galerie est nécessaire.");
      }
      return;
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setResult(null);
        setAdjusting(false);
      }
    } catch (err) {
      if (Platform.OS !== 'web') {
        Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
      }
    }
  };

  const handleAnalyze = async () => {
    if (!photoUri) return;
    setAnalyzing(true);
    setResult(null);
    setAdjusting(false);

    // Simulate AI analysis — 2s delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const simulated = pickSimulationResult();
    setResult(simulated);
    setAdjName(simulated.name);
    setAdjCalories(String(simulated.calories));
    setAdjProtein(String(simulated.protein));
    setAdjCarbs(String(simulated.carbs));
    setAdjFat(String(simulated.fat));
    setAnalyzing(false);
  };

  const handleConfirm = () => {
    if (!result) return;
    const finalResult: ScanResult = adjusting
      ? {
          name: adjName || result.name,
          calories: parseInt(adjCalories, 10) || result.calories,
          protein: parseFloat(adjProtein) || result.protein,
          carbs: parseFloat(adjCarbs) || result.carbs,
          fat: parseFloat(adjFat) || result.fat,
        }
      : result;

    onConfirm({
      ...finalResult,
      source: 'scan',
    });
  };

  return (
    <ScrollView
      contentContainerStyle={scanStyles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Photo zone */}
      <View style={scanStyles.photoZone}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={scanStyles.photo} resizeMode="cover" />
        ) : (
          <View style={scanStyles.photoPlaceholder}>
            <Text style={scanStyles.cameraIcon}>📷</Text>
            <Text style={scanStyles.placeholderText}>Prends une photo de ton assiette</Text>
            <Text style={scanStyles.placeholderSub}>L'IA analysera les aliments présents</Text>
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={scanStyles.btnRow}>
        <TouchableOpacity style={scanStyles.photoBtn} onPress={handleTakePhoto}>
          <Text style={scanStyles.photoBtnText}>📸 Prendre une photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[scanStyles.photoBtn, scanStyles.photoBtnSecondary]} onPress={handlePickFromLibrary}>
          <Text style={[scanStyles.photoBtnText, { color: Colors.darkGreen }]}>🖼️ Galerie</Text>
        </TouchableOpacity>
      </View>

      {/* Analyze button */}
      {photoUri && !result && (
        <TouchableOpacity
          style={[scanStyles.analyzeBtn, analyzing && scanStyles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <View style={scanStyles.analyzingRow}>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={[scanStyles.analyzeBtnText, { marginLeft: 8 }]}>Analyse en cours...</Text>
            </View>
          ) : (
            <Text style={scanStyles.analyzeBtnText}>🤖 Analyser</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Result */}
      {result && (
        <View style={scanStyles.resultCard}>
          <Text style={scanStyles.resultTitle}>Photo analysée 🤖</Text>

          {adjusting ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Text style={scanStyles.adjLabel}>Nom du plat</Text>
              <TextInput style={scanStyles.adjInput} value={adjName} onChangeText={setAdjName} placeholderTextColor={Colors.textMuted} />
              <View style={scanStyles.adjGrid}>
                <View style={scanStyles.adjField}>
                  <Text style={scanStyles.adjFieldLabel}>Calories (kcal)</Text>
                  <TextInput style={scanStyles.adjInput} value={adjCalories} onChangeText={setAdjCalories} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={scanStyles.adjField}>
                  <Text style={scanStyles.adjFieldLabel}>Protéines (g)</Text>
                  <TextInput style={scanStyles.adjInput} value={adjProtein} onChangeText={setAdjProtein} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={scanStyles.adjField}>
                  <Text style={scanStyles.adjFieldLabel}>Glucides (g)</Text>
                  <TextInput style={scanStyles.adjInput} value={adjCarbs} onChangeText={setAdjCarbs} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={scanStyles.adjField}>
                  <Text style={scanStyles.adjFieldLabel}>Lipides (g)</Text>
                  <TextInput style={scanStyles.adjInput} value={adjFat} onChangeText={setAdjFat} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <>
              <Text style={scanStyles.resultName}>{result.name}</Text>
              <View style={scanStyles.resultMacros}>
                <View style={scanStyles.resultCalPill}>
                  <Text style={scanStyles.resultCalText}>{result.calories} kcal</Text>
                </View>
                <MacroBadge label="P" value={result.protein} color={Colors.proteines} />
                <MacroBadge label="G" value={result.carbs} color={Colors.glucides} />
                <MacroBadge label="L" value={result.fat} color={Colors.lipides} />
              </View>
            </>
          )}

          <Text style={scanStyles.disclaimer}>
            ⚠️ Précision estimée ±20% — vérifie les valeurs{'\n'}
            <Text style={scanStyles.disclaimerSub}>En production : GPT-4 Vision ou Passio.ai</Text>
          </Text>

          <View style={scanStyles.resultBtns}>
            <TouchableOpacity
              style={scanStyles.adjustBtn}
              onPress={() => setAdjusting((a) => !a)}
            >
              <Text style={scanStyles.adjustBtnText}>{adjusting ? '← Annuler' : '✏️ Ajuster'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={scanStyles.confirmBtn} onPress={handleConfirm}>
              <Text style={scanStyles.confirmBtnText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const scanStyles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  photoZone: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  cameraIcon: { fontSize: 48 },
  placeholderText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  placeholderSub: { fontSize: 12, color: Colors.textMuted },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  photoBtn: {
    flex: 1,
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoBtnSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.darkGreen,
  },
  photoBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  analyzeBtn: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  analyzingRow: { flexDirection: 'row', alignItems: 'center' },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.lime,
    gap: 10,
  },
  resultTitle: { fontSize: 16, fontWeight: '700', color: Colors.darkGreen },
  resultName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  resultMacros: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  resultCalPill: {
    backgroundColor: Colors.darkGreen + '15',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  resultCalText: { color: Colors.darkGreen, fontSize: 12, fontWeight: '700' },
  disclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
  },
  disclaimerSub: { fontSize: 10, color: Colors.textMuted },
  resultBtns: { flexDirection: 'row', gap: 10 },
  adjustBtn: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adjustBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  adjLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  adjInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  adjGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  adjField: { width: '47%' },
  adjFieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MealLogModal (main export)
// ─────────────────────────────────────────────────────────────────────────────

export default function MealLogModal({
  visible,
  onClose,
  onConfirm,
  session,
  mealType,
  regime,
  eatenAt,
  onEatenAtChange,
  suggestion,
}: MealLogModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('lgf');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'lgf', label: '🧊 Nos plats' },
    { key: 'manual', label: '🏠 Maison' },
    { key: 'scan', label: '📷 Scanner' },
  ];

  const handleConfirm = (meal: LoggedMeal) => {
    onConfirm(meal);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles.container}>
        {/* Header */}
        <View style={modalStyles.header}>
          <View style={modalStyles.headerHandle} />
          <View style={modalStyles.headerRow}>
            <View>
              <Text style={modalStyles.headerTitle}>Qu'as-tu mangé ?</Text>
              <Text style={modalStyles.headerSub}>{mealType}</Text>
            </View>
            <TouchableOpacity
              style={modalStyles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Heure du repas */}
          <TouchableOpacity
            style={modalStyles.timeRow}
            onPress={() => setShowTimePicker(!showTimePicker)}
            activeOpacity={0.8}
          >
            <Text style={modalStyles.timeLabel}>🕐 Heure du repas :</Text>
            <Text style={modalStyles.timeValue}>{eatenAt ?? '--:--'}</Text>
            <Text style={modalStyles.timeChevron}>{showTimePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showTimePicker && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={modalStyles.timeSlotsContent}
              style={modalStyles.timeSlotsRow}
            >
              {TIME_SLOTS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    modalStyles.timeSlot,
                    eatenAt === t && modalStyles.timeSlotActive,
                  ]}
                  onPress={() => {
                    onEatenAtChange?.(t);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[
                    modalStyles.timeSlotText,
                    eatenAt === t && modalStyles.timeSlotTextActive,
                  ]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Tabs */}
          <View style={modalStyles.tabBar}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[modalStyles.tab, activeTab === tab.key && modalStyles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[modalStyles.tabText, activeTab === tab.key && modalStyles.tabTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab content */}
        <View style={modalStyles.body}>
          {activeTab === 'lgf' && (
            <LGFTab regime={regime} suggestion={suggestion} onConfirm={handleConfirm} />
          )}
          {activeTab === 'manual' && (
            <ManualTab session={session} onConfirm={handleConfirm} />
          )}
          {activeTab === 'scan' && (
            <ScanTab onConfirm={handleConfirm} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.darkGreen,
    paddingTop: 12,
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  headerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: Colors.darkGreen,
  },
  body: {
    flex: 1,
    backgroundColor: Colors.white,
  },

  /* Heure du repas */
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  timeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 14,
    color: Colors.lime,
    fontWeight: '800',
    flex: 1,
  },
  timeChevron: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  timeSlotsRow: {
    maxHeight: 44,
    marginBottom: 4,
  },
  timeSlotsContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  timeSlot: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  timeSlotActive: {
    backgroundColor: Colors.lime,
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  timeSlotTextActive: {
    color: Colors.darkGreen,
    fontWeight: '800',
  },
});
