import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions,
} from 'react-native';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40; // plein largeur avec marges

// ─── Types ────────────────────────────────────────────────────────────────────

interface MealSuggestion {
  name: string;
  emoji: string;
  ingredients: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tip: string;
}

interface MealMoment {
  key: string;
  label: string;
  icon: string;
  timeRange: string;
  suggestions: Record<string, MealSuggestion[]>;
}

// ─── Base de données suggestions ──────────────────────────────────────────────

const MEAL_MOMENTS: MealMoment[] = [
  {
    key: 'breakfast',
    label: 'Petit-déjeuner',
    icon: '☀️',
    timeRange: '6h – 9h',
    suggestions: {
      masse: [
        { name: 'Porridge Sportif', emoji: '🍚', ingredients: "Flocons d'avoine + lait entier + banane + beurre de cacahuète + miel", calories: 620, protein: 22, carbs: 82, fat: 20, tip: "Glucides complexes + bons lipides. Idéal 2h avant l'entraînement." },
        { name: 'Omelette Champion', emoji: '🍳', ingredients: '4 œufs + fromage + pain complet grillé + avocat', calories: 650, protein: 38, carbs: 42, fat: 32, tip: 'Riche en protéines complètes. La choline des œufs booste la mémoire musculaire.' },
        { name: 'Bowl Tropical Péyi', emoji: '🥝', ingredients: 'Skyr + granola coco + mangue + noix de cajou + miel local', calories: 560, protein: 28, carbs: 58, fat: 22, tip: 'Le Skyr c\'est 2x plus de protéines que le yaourt classique.' },
      ],
      seche: [
        { name: 'Omelette Blancs', emoji: '🍳', ingredients: '4 blancs d\'œufs + 1 jaune + épinards + tomate + herbes', calories: 220, protein: 28, carbs: 6, fat: 8, tip: 'Maximum de protéines, minimum de calories.' },
        { name: 'Skyr Zéro Sucre', emoji: '🥛', ingredients: 'Skyr 0% + myrtilles + graines de chia + cannelle', calories: 180, protein: 25, carbs: 14, fat: 2, tip: '25g de protéines pour 180 kcal. Le ratio rêve en sèche.' },
        { name: 'Toast Avocat-Œuf', emoji: '🥑', ingredients: '1 tranche pain complet + 1/2 avocat + 1 œuf poché + piment', calories: 280, protein: 14, carbs: 22, fat: 16, tip: 'Les bons gras de l\'avocat maintiennent la satiété 3-4h.' },
      ],
      equilibre: [
        { name: 'Granola Bowl Maison', emoji: '🥣', ingredients: 'Granola + yaourt grec + fruits de saison + noisettes', calories: 420, protein: 18, carbs: 52, fat: 16, tip: 'L\'équilibre parfait. Les noisettes apportent de la vitamine E.' },
        { name: 'Tartine Complète', emoji: '🍞', ingredients: 'Pain complet + fromage frais + saumon fumé + roquette + citron', calories: 380, protein: 22, carbs: 34, fat: 16, tip: 'Oméga-3 du saumon + glucides lents.' },
        { name: 'Œufs Brouillés & Fruits', emoji: '🍳', ingredients: '2 œufs brouillés + pain complet + salade de fruits frais', calories: 380, protein: 20, carbs: 40, fat: 14, tip: 'Simple, rapide, complet.' },
      ],
    },
  },
  {
    key: 'lunch',
    label: 'Déjeuner',
    icon: '🌤️',
    timeRange: '12h – 14h',
    suggestions: {
      masse: [
        { name: 'Poulet Riz Légumes', emoji: '🍗', ingredients: '200g poulet grillé + 150g riz basmati + brocolis vapeur + huile olive', calories: 680, protein: 52, carbs: 68, fat: 18, tip: 'Le repas le plus populaire en prise de masse. Simple et efficace.' },
        { name: 'Pâtes Bolognaise Fit', emoji: '🍝', ingredients: '150g pâtes complètes + 150g bœuf haché + tomates + parmesan', calories: 720, protein: 48, carbs: 78, fat: 22, tip: 'Les pâtes complètes ont un index glycémique plus bas.' },
        { name: 'Bowl Quinoa Thon', emoji: '🥗', ingredients: 'Quinoa + thon + avocat + concombre + sauce citron', calories: 580, protein: 45, carbs: 52, fat: 20, tip: 'Le quinoa est une protéine complète — rare dans les céréales.' },
      ],
      seche: [
        { name: 'Salade César Fit', emoji: '🥗', ingredients: 'Poulet grillé + salade + parmesan + œuf dur + sauce allégée', calories: 380, protein: 42, carbs: 12, fat: 16, tip: 'Évite la sauce César classique — 200 kcal de trop.' },
        { name: 'Saumon Légumes', emoji: '🐟', ingredients: '180g saumon + haricots verts + brocolis + citron + herbes', calories: 420, protein: 40, carbs: 14, fat: 24, tip: 'Les oméga-3 du saumon favorisent la perte de masse grasse.' },
        { name: 'Poulet Épinards', emoji: '🍗', ingredients: '200g poulet + épinards sautés + champignons + ail + citron', calories: 340, protein: 46, carbs: 8, fat: 14, tip: 'Repas ultra-protéiné à faible densité calorique.' },
      ],
      equilibre: [
        { name: 'Wrap Poulet Avocat', emoji: '🌯', ingredients: 'Tortilla complète + poulet + avocat + salade + tomate + fromage frais', calories: 480, protein: 32, carbs: 44, fat: 20, tip: 'Pratique à emporter. Prépare-le la veille.' },
        { name: 'Riz Créole Crevettes', emoji: '🦐', ingredients: 'Riz + crevettes sautées + légumes du marché + huile de coco', calories: 520, protein: 36, carbs: 58, fat: 16, tip: 'Saveurs antillaises. Les crevettes sont pauvres en calories et riches en protéines.' },
        { name: 'Lentilles Légumes', emoji: '🥘', ingredients: 'Lentilles corail + carottes + céleri + cumin + citron', calories: 440, protein: 24, carbs: 62, fat: 8, tip: 'Les lentilles rassasient pour 4-5h grâce aux fibres.' },
      ],
    },
  },
  {
    key: 'snack',
    label: 'Collation',
    icon: '⚡',
    timeRange: '15h – 17h',
    suggestions: {
      masse: [
        { name: 'Shaker Whey Banane', emoji: '🥤', ingredients: '1 dose whey + 1 banane + 200ml lait entier', calories: 380, protein: 32, carbs: 42, fat: 8, tip: 'Collation anabolique parfaite pour la fenêtre post-entraînement.' },
        { name: 'Pain Complet & Beurre Cacahuète', emoji: '🥜', ingredients: '2 tranches pain complet + 2 cuil. beurre cacahuète + 1 banane', calories: 420, protein: 16, carbs: 52, fat: 18, tip: 'Glucides + graisses saines + protéines. Énergie 3h.' },
        { name: 'Greek Yogurt & Granola', emoji: '🥣', ingredients: 'Yaourt grec 10% + 40g granola + fruits rouges + miel', calories: 360, protein: 20, carbs: 44, fat: 12, tip: 'Dense en nutriments. Idéal 2h avant l\'entraînement.' },
      ],
      seche: [
        { name: 'Fromage Blanc & Fruits', emoji: '🍓', ingredients: 'Fromage blanc 0% + fraises + 1 cuil. graines de chia', calories: 160, protein: 18, carbs: 16, fat: 2, tip: 'Satiété maximale pour un minimum de calories.' },
        { name: 'Amandes & Pomme', emoji: '🍎', ingredients: '20g amandes + 1 pomme + 1 carré chocolat noir 85%', calories: 200, protein: 5, carbs: 22, fat: 12, tip: 'Les amandes stabilisent la glycémie. Évite les fringales.' },
        { name: 'Skyr Nature', emoji: '🥛', ingredients: 'Skyr 0% + cannelle + quelques myrtilles', calories: 140, protein: 20, carbs: 12, fat: 0, tip: 'La collation sèche parfaite. 20g de protéines sans lipides.' },
      ],
      equilibre: [
        { name: 'Smoothie Vert', emoji: '🥤', ingredients: 'Épinards + banane + lait d\'amande + beurre d\'amande + miel', calories: 280, protein: 8, carbs: 38, fat: 10, tip: 'Vitamines + énergie naturelle. Prêt en 2 minutes.' },
        { name: 'Toast Avocat', emoji: '🥑', ingredients: '1 tranche pain complet + 1/4 avocat + graines de sésame + sel', calories: 220, protein: 6, carbs: 24, fat: 12, tip: 'Collation anti-fringale. Les graisses de l\'avocat rassasient.' },
        { name: 'Fruits Secs & Noix', emoji: '🥜', ingredients: '15g noix de cajou + 10g raisins secs + 1 carré chocolat noir', calories: 180, protein: 4, carbs: 18, fat: 10, tip: 'Collation nomade. Se transporte partout.' },
      ],
    },
  },
  {
    key: 'dinner',
    label: 'Dîner',
    icon: '🌙',
    timeRange: '19h – 21h',
    suggestions: {
      masse: [
        { name: 'Steak Patate Douce', emoji: '🥩', ingredients: '200g steak + 200g patate douce + haricots verts + huile olive', calories: 640, protein: 46, carbs: 56, fat: 22, tip: 'Repas anabolique du soir. La patate douce recharge le glycogène.' },
        { name: 'Saumon Riz Brun', emoji: '🐟', ingredients: '200g saumon + 150g riz brun + brocolis + sauce soja légère', calories: 620, protein: 48, carbs: 58, fat: 20, tip: 'Parfait pour la récupération nocturne. Le saumon booste l\'IGF-1.' },
        { name: 'Omelette Géante', emoji: '🍳', ingredients: '5 œufs + pommes de terre + poivrons + fromage + herbes', calories: 580, protein: 42, carbs: 38, fat: 28, tip: 'Simple et protéiné. La caséine des œufs se libère lentement la nuit.' },
      ],
      seche: [
        { name: 'Poulet Légumes Vapeur', emoji: '🍗', ingredients: '180g poulet + courgettes + carottes + brocolis + citron + herbes', calories: 320, protein: 44, carbs: 16, fat: 8, tip: 'Le dîner idéal en sèche. Peu de glucides, maximum de protéines.' },
        { name: 'Cabillaud Épinards', emoji: '🐟', ingredients: '200g cabillaud + épinards sautés + ail + huile olive + citron', calories: 280, protein: 42, carbs: 4, fat: 10, tip: 'Poisson blanc = protéines pures. 0 glucides pour la nuit.' },
        { name: 'Omelette Légumes', emoji: '🥚', ingredients: '3 œufs + 1 blanc + champignons + épinards + tomate + herbes', calories: 260, protein: 26, carbs: 8, fat: 14, tip: 'Rapide à préparer. Idéal les soirs de flemme.' },
      ],
      equilibre: [
        { name: 'Curry Pois Chiches', emoji: '🍛', ingredients: 'Pois chiches + lait de coco + épices curry + riz basmati + coriandre', calories: 480, protein: 18, carbs: 68, fat: 14, tip: 'Repas végétarien complet. Les pois chiches = protéines + fibres.' },
        { name: 'Daurade Plancha', emoji: '🐟', ingredients: 'Daurade + pommes de terre + tomates + herbes de Provence + citron', calories: 440, protein: 38, carbs: 36, fat: 14, tip: 'Poisson local de Martinique. Léger et complet.' },
        { name: 'Pasta Saumon Crème', emoji: '🍝', ingredients: 'Pâtes complètes + saumon fumé + crème allégée + aneth + citron', calories: 520, protein: 32, carbs: 54, fat: 16, tip: 'Dîner plaisir sans excès. La crème allégée divise les lipides par 3.' },
      ],
    },
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface MealSuggestionsCarouselProps {
  regime: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MealSuggestionsCarousel({ regime }: MealSuggestionsCarouselProps) {
  const pool = (regime === 'masse' || regime === 'seche' || regime === 'equilibre') ? regime : 'equilibre';
  const today = new Date().getDate();

  // Index de suggestion rotatif par moment
  const [indices, setIndices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    MEAL_MOMENTS.forEach((m) => { init[m.key] = today % 3; });
    return init;
  });

  // Moment actif (swipe horizontal entre les cards)
  const [activeMoment, setActiveMoment] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function shuffle(key: string) {
    setIndices((prev) => ({ ...prev, [key]: (prev[key]! + 1) % 3 }));
  }

  function scrollToMoment(idx: number) {
    setActiveMoment(idx);
    scrollRef.current?.scrollTo({ x: idx * CARD_WIDTH, animated: true });
  }

  return (
    <View>
      {/* Pills de navigation L/D/C/D */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsRow}
      >
        {MEAL_MOMENTS.map((m, idx) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.pill, activeMoment === idx && styles.pillActive]}
            onPress={() => scrollToMoment(idx)}
            activeOpacity={0.8}
          >
            <Text style={styles.pillIcon}>{m.icon}</Text>
            <Text style={[styles.pillLabel, activeMoment === idx && styles.pillLabelActive]}>
              {m.label}
            </Text>
            <Text style={[styles.pillTime, activeMoment === idx && styles.pillTimeActive]}>
              {m.timeRange}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Carousel de cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setActiveMoment(idx);
        }}
        contentContainerStyle={styles.carouselContent}
      >
        {MEAL_MOMENTS.map((moment) => {
          const suggestions = moment.suggestions[pool] ?? moment.suggestions.equilibre!;
          const idx = indices[moment.key] ?? 0;
          const suggestion = suggestions[idx]!;

          return (
            <View key={moment.key} style={[styles.card, { width: CARD_WIDTH }]}>
              {/* Header card */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.cardMomentIcon}>{moment.icon}</Text>
                  <View>
                    <Text style={styles.cardMomentLabel}>{moment.label}</Text>
                    <Text style={styles.cardMomentTime}>{moment.timeRange}</Text>
                  </View>
                </View>
                <View style={styles.calBadge}>
                  <Text style={styles.calBadgeText}>{suggestion.calories} kcal</Text>
                </View>
              </View>

              {/* Contenu */}
              <View style={styles.cardBody}>
                <Text style={styles.cardEmoji}>{suggestion.emoji}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{suggestion.name}</Text>
                  <Text style={styles.cardIngredients}>{suggestion.ingredients}</Text>
                </View>
              </View>

              {/* Macros */}
              <View style={styles.macrosRow}>
                <View style={styles.macro}>
                  <View style={[styles.macroDot, { backgroundColor: Colors.proteines }]} />
                  <Text style={styles.macroText}>P {suggestion.protein}g</Text>
                </View>
                <View style={styles.macro}>
                  <View style={[styles.macroDot, { backgroundColor: Colors.glucides }]} />
                  <Text style={styles.macroText}>G {suggestion.carbs}g</Text>
                </View>
                <View style={styles.macro}>
                  <View style={[styles.macroDot, { backgroundColor: Colors.lipides }]} />
                  <Text style={styles.macroText}>L {suggestion.fat}g</Text>
                </View>
              </View>

              {/* Tip */}
              <View style={styles.tipRow}>
                <Text style={styles.tipText}>💡 {suggestion.tip}</Text>
              </View>

              {/* Bouton autre suggestion */}
              <TouchableOpacity
                style={styles.shuffleBtn}
                onPress={() => shuffle(moment.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.shuffleBtnText}>🔀  Autre suggestion</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Indicateur de pagination */}
      <View style={styles.pagination}>
        {MEAL_MOMENTS.map((_, idx) => (
          <TouchableOpacity key={idx} onPress={() => scrollToMoment(idx)}>
            <View style={[styles.pageDoc, activeMoment === idx && styles.pageDotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Pills nav
  pillsRow: {
    gap: 8,
    paddingBottom: 12,
  },
  pill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 2,
  },
  pillActive: {
    backgroundColor: Colors.darkGreen,
    borderColor: Colors.darkGreen,
  },
  pillIcon: { fontSize: 16 },
  pillLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  pillLabelActive: { color: Colors.white },
  pillTime: { fontSize: 9, color: Colors.textMuted, fontWeight: '500' },
  pillTimeActive: { color: 'rgba(255,255,255,0.7)' },

  // Carousel
  carouselContent: { gap: 0 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.lime + '40',
    overflow: 'hidden',
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMomentIcon: { fontSize: 22 },
  cardMomentLabel: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  cardMomentTime: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  calBadge: {
    backgroundColor: Colors.darkGreen + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  calBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.darkGreen },

  // Card body
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cardEmoji: { fontSize: 36 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  cardIngredients: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // Macros
  macrosRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  macroDot: { width: 6, height: 6, borderRadius: 3 },
  macroText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  // Tip
  tipRow: {
    marginHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.lime + '25',
  },
  tipText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // Shuffle btn
  shuffleBtn: {
    margin: 12,
    marginTop: 6,
    backgroundColor: Colors.darkGreen + '08',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shuffleBtnText: { fontSize: 13, fontWeight: '700', color: Colors.darkGreen },

  // Pagination dots
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
  },
  pageDoc: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.border,
  },
  pageDotActive: {
    width: 18, height: 6, borderRadius: 3,
    backgroundColor: Colors.darkGreen,
  },
});
