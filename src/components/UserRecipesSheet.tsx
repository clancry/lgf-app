import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import type { LoggedMeal } from './MealLogModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UserRecipe {
  id: number;
  user_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  shared?: boolean;
  created_at?: string;
}

export interface UserRecipesSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (meal: LoggedMeal) => void;
  session: Session | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MacroBadge (local)
// ─────────────────────────────────────────────────────────────────────────────

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[badgeStyles.badge, { borderColor: color + '40', backgroundColor: color + '15' }]}>
      <Text style={[badgeStyles.label, { color }]}>{label}</Text>
      <Text style={[badgeStyles.value, { color }]}>{value}g</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  label: { fontSize: 10, fontWeight: '700', marginRight: 2 },
  value: { fontSize: 10, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────────────────────────
// AddRecipeForm
// ─────────────────────────────────────────────────────────────────────────────

interface AddRecipeFormProps {
  session: Session | null;
  onSaved: () => void;
  onCancel: () => void;
}

function AddRecipeForm({ session, onSaved, onCancel }: AddRecipeFormProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Le nom est obligatoire.';
    if (!calories.trim() || isNaN(Number(calories))) e.calories = 'Valeur invalide.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!session?.user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_recipes').insert({
        user_id: session.user.id,
        name: name.trim(),
        calories: parseInt(calories, 10) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        shared,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      if (Platform.OS !== 'web') {
        Alert.alert('Erreur', "Impossible d'enregistrer la recette. Réessaie.");
      } else {
        console.error('Erreur insert user_recipe :', err);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={formStyles.wrapper}
    >
      <ScrollView
        contentContainerStyle={formStyles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={formStyles.header}>
          <Text style={formStyles.title}>Nouvelle recette</Text>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={formStyles.cancelLink}>Annuler</Text>
          </TouchableOpacity>
        </View>

        {/* Nom */}
        <Text style={formStyles.label}>Nom <Text style={formStyles.required}>*</Text></Text>
        <TextInput
          style={[formStyles.input, errors.name ? formStyles.inputError : null]}
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
          placeholder="Ex : Blanquette de poulet maison"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="next"
        />
        {errors.name ? <Text style={formStyles.error}>{errors.name}</Text> : null}

        {/* Macros */}
        <Text style={formStyles.sectionLabel}>Valeurs nutritionnelles</Text>
        <View style={formStyles.grid}>
          <View style={formStyles.gridField}>
            <Text style={formStyles.gridLabel}>Calories (kcal) <Text style={formStyles.required}>*</Text></Text>
            <TextInput
              style={[formStyles.input, errors.calories ? formStyles.inputError : null]}
              value={calories}
              onChangeText={(t) => { setCalories(t); setErrors((e) => ({ ...e, calories: '' })); }}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
            {errors.calories ? <Text style={formStyles.error}>{errors.calories}</Text> : null}
          </View>
          <View style={formStyles.gridField}>
            <Text style={formStyles.gridLabel}>Protéines (g)</Text>
            <TextInput
              style={formStyles.input}
              value={protein}
              onChangeText={setProtein}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={formStyles.gridField}>
            <Text style={formStyles.gridLabel}>Glucides (g)</Text>
            <TextInput
              style={formStyles.input}
              value={carbs}
              onChangeText={setCarbs}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={formStyles.gridField}>
            <Text style={formStyles.gridLabel}>Lipides (g)</Text>
            <TextInput
              style={formStyles.input}
              value={fat}
              onChangeText={setFat}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Share */}
        <View style={formStyles.switchRow}>
          <View style={formStyles.switchTextCol}>
            <Text style={formStyles.switchLabel}>Partager avec la communauté</Text>
            <Text style={formStyles.switchSub}>D'autres utilisateurs pourront voir ta recette</Text>
          </View>
          <Switch
            value={shared}
            onValueChange={setShared}
            trackColor={{ false: Colors.border, true: Colors.darkGreen + '80' }}
            thumbColor={shared ? Colors.darkGreen : Colors.textMuted}
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[formStyles.saveBtn, saving && formStyles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={formStyles.saveBtnText}>Enregistrer la recette</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const formStyles = StyleSheet.create({
  wrapper: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  cancelLink: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  required: { color: Colors.error },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  inputError: { borderColor: Colors.error },
  error: { fontSize: 12, color: Colors.error, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridField: { width: '47%' },
  gridLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 14,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchTextCol: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  saveBtn: {
    marginTop: 24,
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// UserRecipesSheet (main export)
// ─────────────────────────────────────────────────────────────────────────────

export default function UserRecipesSheet({
  visible,
  onClose,
  onSelect,
  session,
}: UserRecipesSheetProps) {
  const [recipes, setRecipes] = useState<UserRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchRecipes = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_recipes')
        .select('id,user_id,name,calories,protein,carbs,fat,shared,created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes((data as UserRecipe[]) ?? []);
    } catch (err) {
      if (Platform.OS !== 'web') {
        Alert.alert('Erreur', 'Impossible de charger tes recettes.');
      } else {
        console.error('Erreur fetch user_recipes :', err);
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (visible) {
      fetchRecipes();
      setShowForm(false);
    }
  }, [visible, fetchRecipes]);

  const handleSelect = (recipe: UserRecipe) => {
    onSelect({
      name: recipe.name,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      source: 'user_recipe',
    });
    onClose();
  };

  const handleFormSaved = () => {
    setShowForm(false);
    fetchRecipes();
  };

  const handleDelete = (recipe: UserRecipe) => {
    if (Platform.OS === 'web') {
      // No confirm on web — just delete
      deleteRecipe(recipe.id);
      return;
    }
    Alert.alert(
      'Supprimer la recette',
      `Supprimer "${recipe.name}" de tes recettes ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteRecipe(recipe.id) },
      ],
    );
  };

  const deleteRecipe = async (id: number) => {
    try {
      const { error } = await supabase
        .from('user_recipes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      if (Platform.OS !== 'web') {
        Alert.alert('Erreur', 'Impossible de supprimer la recette.');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={sheetStyles.container}>
        {/* Header */}
        <View style={sheetStyles.header}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <Text style={sheetStyles.title}>Mes recettes</Text>
            <View style={sheetStyles.headerActions}>
              {!showForm && (
                <TouchableOpacity
                  style={sheetStyles.addBtn}
                  onPress={() => setShowForm(true)}
                >
                  <Text style={sheetStyles.addBtnText}>+ Ajouter</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={sheetStyles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={sheetStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Body */}
        {showForm ? (
          <AddRecipeForm
            session={session}
            onSaved={handleFormSaved}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
            {loading ? (
              <View style={sheetStyles.centered}>
                <ActivityIndicator size="large" color={Colors.darkGreen} />
                <Text style={sheetStyles.loadingText}>Chargement...</Text>
              </View>
            ) : recipes.length === 0 ? (
              <View style={sheetStyles.empty}>
                <Text style={sheetStyles.emptyIcon}>📋</Text>
                <Text style={sheetStyles.emptyTitle}>Aucune recette enregistrée</Text>
                <Text style={sheetStyles.emptySub}>
                  Ajoute tes plats maison pour les retrouver rapidement.
                </Text>
                <TouchableOpacity
                  style={sheetStyles.emptyAddBtn}
                  onPress={() => setShowForm(true)}
                >
                  <Text style={sheetStyles.emptyAddBtnText}>+ Créer ma première recette</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={recipes}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={sheetStyles.list}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                renderItem={({ item }) => (
                  <View style={sheetStyles.recipeCard}>
                    <View style={sheetStyles.recipeCardTop}>
                      <Text style={sheetStyles.recipeName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.shared && (
                        <View style={sheetStyles.sharedBadge}>
                          <Text style={sheetStyles.sharedBadgeText}>🌍 Partagée</Text>
                        </View>
                      )}
                    </View>

                    <View style={sheetStyles.macroRow}>
                      <View style={sheetStyles.calPill}>
                        <Text style={sheetStyles.calPillText}>{item.calories} kcal</Text>
                      </View>
                      <MacroBadge label="P" value={item.protein} color={Colors.proteines} />
                      <MacroBadge label="G" value={item.carbs} color={Colors.glucides} />
                      <MacroBadge label="L" value={item.fat} color={Colors.lipides} />
                    </View>

                    <View style={sheetStyles.recipeActions}>
                      <TouchableOpacity
                        style={sheetStyles.deleteBtn}
                        onPress={() => handleDelete(item)}
                        hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                      >
                        <Text style={sheetStyles.deleteBtnText}>🗑️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={sheetStyles.selectBtn}
                        onPress={() => handleSelect(item)}
                      >
                        <Text style={sheetStyles.selectBtnText}>Sélectionner</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  handle: {
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
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    backgroundColor: Colors.lime,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: Colors.darkGreen },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  list: { padding: 16, paddingBottom: 40 },
  recipeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recipeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  sharedBadge: {
    backgroundColor: Colors.info + '20',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  sharedBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.info },
  macroRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  calPill: {
    backgroundColor: Colors.darkGreen + '15',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  calPillText: { color: Colors.darkGreen, fontSize: 12, fontWeight: '700' },
  recipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: { fontSize: 16 },
  selectBtn: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 10,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    marginTop: 12,
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyAddBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
