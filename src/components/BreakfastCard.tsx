import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

interface Breakfast {
  name: string;
  emoji: string;
  ingredients: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tip: string;
}

const breakfastDB: Record<string, Breakfast[]> = {
  masse: [
    { name: "Porridge Sportif", emoji: "🍚", ingredients: "Flocons d'avoine + lait entier + banane + beurre de cacahuète + miel", calories: 620, protein: 22, carbs: 82, fat: 20, tip: "Glucides complexes + bons lipides. Idéal 2h avant l'entraînement." },
    { name: "Omelette Champion", emoji: "🍳", ingredients: "4 œufs + fromage + pain complet grillé + avocat", calories: 650, protein: 38, carbs: 42, fat: 32, tip: "Riche en protéines complètes. La choline des œufs booste la mémoire musculaire." },
    { name: "Smoothie Bowl Force", emoji: "🥤", ingredients: "Banane + whey + avoine + beurre d'amande + fruits rouges + granola", calories: 580, protein: 35, carbs: 68, fat: 16, tip: "30g de protéines dès le réveil." },
    { name: "Crêpes Protéinées", emoji: "🧀", ingredients: "Avoine + œufs + banane + whey + sirop d'érable + noix", calories: 600, protein: 34, carbs: 65, fat: 18, tip: "Rapide à préparer. La banane écrasée remplace le sucre." },
    { name: "Bowl Tropical Péyi", emoji: "🥝", ingredients: "Skyr + granola coco + mangue + noix de cajou + miel local", calories: 560, protein: 28, carbs: 58, fat: 22, tip: "Le Skyr c'est 2x plus de protéines que le yaourt classique." },
    { name: "Sandwich Matin Costaud", emoji: "🥖", ingredients: "Pain complet + omelette + fromage + avocat + salade", calories: 630, protein: 30, carbs: 48, fat: 30, tip: "Si tu as peu de temps. Emballe et mange sur le trajet." },
  ],
  seche: [
    { name: "Omelette Blancs d'œufs", emoji: "🍳", ingredients: "4 blancs d'œufs + 1 jaune + épinards + tomate + herbes", calories: 220, protein: 28, carbs: 6, fat: 8, tip: "Maximum de protéines, minimum de calories." },
    { name: "Skyr Zéro Sucre", emoji: "🥛", ingredients: "Skyr 0% + myrtilles + graines de chia + cannelle", calories: 180, protein: 25, carbs: 14, fat: 2, tip: "25g de protéines pour 180 kcal. Le ratio rêve en sèche." },
    { name: "Toast Avocat-Œuf", emoji: "🥑", ingredients: "1 tranche pain complet + 1/2 avocat + 1 œuf poché + piment", calories: 280, protein: 14, carbs: 22, fat: 16, tip: "Les bons gras de l'avocat maintiennent la satiété 3-4h." },
    { name: "Smoothie Vert Brûle-Graisse", emoji: "🥬", ingredients: "Épinards + concombre + pomme verte + gingembre + citron", calories: 120, protein: 3, carbs: 26, fat: 1, tip: "Le gingembre accélère le métabolisme." },
    { name: "Galette Cassave Légère", emoji: "🧇", ingredients: "Cassave + blanc d'œuf + tomate + herbes fraîches", calories: 200, protein: 12, carbs: 30, fat: 4, tip: "Féculent local sans gluten. Léger et rassasiant." },
    { name: "Fromage Blanc Tropical", emoji: "🍍", ingredients: "Fromage blanc 0% + ananas frais + menthe + zeste citron", calories: 160, protein: 20, carbs: 18, fat: 0, tip: "La bromélaïne de l'ananas aide à digérer les protéines." },
  ],
  equilibre: [
    { name: "Granola Bowl Maison", emoji: "🥣", ingredients: "Granola + yaourt grec + fruits de saison + noisettes", calories: 420, protein: 18, carbs: 52, fat: 16, tip: "L'équilibre parfait. Les noisettes apportent de la vitamine E." },
    { name: "Tartine Complète", emoji: "🍞", ingredients: "Pain complet + fromage frais + saumon fumé + roquette + citron", calories: 380, protein: 22, carbs: 34, fat: 16, tip: "Oméga-3 du saumon + glucides lents." },
    { name: "Œufs Brouillés & Fruits", emoji: "🍳", ingredients: "2 œufs brouillés + pain complet + salade de fruits frais", calories: 380, protein: 20, carbs: 40, fat: 14, tip: "Simple, rapide, complet." },
    { name: "Smoothie Équilibré", emoji: "🥤", ingredients: "Banane + lait demi-écrémé + avoine + beurre d'amande + miel", calories: 400, protein: 14, carbs: 56, fat: 14, tip: "Tous les macros en un verre. Prêt en 2 minutes." },
    { name: "Pain Perdu Fit", emoji: "🍞", ingredients: "Pain complet + œuf + lait + cannelle + fruits frais", calories: 360, protein: 16, carbs: 48, fat: 12, tip: "Plaisir et nutrition. La cannelle régule la glycémie." },
    { name: "Bol Açai Martiniquais", emoji: "🫐", ingredients: "Açai + banane + granola local + noix de cajou + mangue", calories: 420, protein: 10, carbs: 60, fat: 16, tip: "Antioxydants puissants. La mangue locale est riche en vitamine A." },
  ],
};

interface BreakfastCardProps {
  regime: string;
}

export default function BreakfastCard({ regime }: BreakfastCardProps) {
  const pool = breakfastDB[regime] || breakfastDB.equilibre;
  const [index, setIndex] = useState(() => new Date().getDate() % pool.length);
  const bf = pool[index];
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;

  const handleShuffle = () => {
    setIndex((prev) => (prev + 1) % pool.length);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{isMorning ? '☀️' : '☕'}</Text>
          <Text style={styles.headerTitle}>
            {isMorning ? 'Bon matin' : 'Petit-déjeuner du jour'}
          </Text>
        </View>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{bf.calories} kcal</Text>
          </View>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{index + 1}/{pool.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.emoji}>{bf.emoji}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>{bf.name}</Text>
          <Text style={styles.ingredients}>{bf.ingredients}</Text>
        </View>
      </View>

      <View style={styles.macros}>
        <View style={styles.macro}>
          <View style={[styles.macroDot, { backgroundColor: Colors.orange }]} />
          <Text style={styles.macroText}>P: {bf.protein}g</Text>
        </View>
        <View style={styles.macro}>
          <View style={[styles.macroDot, { backgroundColor: Colors.lime }]} />
          <Text style={styles.macroText}>G: {bf.carbs}g</Text>
        </View>
        <View style={styles.macro}>
          <View style={[styles.macroDot, { backgroundColor: '#6366f1' }]} />
          <Text style={styles.macroText}>L: {bf.fat}g</Text>
        </View>
      </View>

      <View style={styles.tipContainer}>
        <Text style={styles.tip}>💡 {bf.tip}</Text>
      </View>

      <TouchableOpacity style={styles.shuffleBtn} onPress={handleShuffle}>
        <Text style={styles.shuffleBtnText}>🔀  Un autre petit-déj</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.lime + '30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIcon: { fontSize: 16 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  badgeCount: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeCountText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  content: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  emoji: { fontSize: 36 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  ingredients: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  macros: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingTop: 12 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  macroDot: { width: 6, height: 6, borderRadius: 3 },
  macroText: { fontSize: 11, color: Colors.textSecondary },
  tipContainer: {
    marginHorizontal: 16, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.lime + '20',
  },
  tip: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  shuffleBtn: {
    margin: 16, marginTop: 12,
    backgroundColor: Colors.darkGreen + '08',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shuffleBtnText: { fontSize: 13, fontWeight: '700', color: Colors.darkGreen },
});
