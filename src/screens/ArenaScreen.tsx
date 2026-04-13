import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface ArenaScreenProps {
  session: Session | null;
}

type ArenaTab = 'quiz' | 'feed' | 'challenges' | 'tips';

// ─── FIT Points ────────────────────────────────────────────────────────────────

function getLevel(points: number): { name: string; emoji: string } {
  if (points < 100) return { name: 'Débutant', emoji: '🥉' };
  if (points < 300) return { name: 'Sportif', emoji: '🥈' };
  if (points < 750) return { name: 'Athlète', emoji: '🥇' };
  if (points < 1500) return { name: 'Champion', emoji: '💎' };
  return { name: 'Légende', emoji: '👑' };
}

// ─── Quiz Data ─────────────────────────────────────────────────────────────────

interface QuizQuestion {
  id: string;
  category: string;
  categoryEmoji: string;
  question: string;
  options: string[];
  correctIndex: number;
  fact: string;
}

// Questions du quiz — chargées depuis Supabase (get_random_quiz_questions)
// Le state quizQuestions est défini dans le composant ArenaScreen


function getQuizPoints(score: number): number {
  if (score === 5) return 50;
  if (score === 4) return 30;
  if (score === 3) return 20;
  return 10;
}

// ─── Tips Data ─────────────────────────────────────────────────────────────────

interface TipArticle {
  id: string;
  category: string;
  categoryEmoji: string;
  title: string;
  summary: string;        // affiché avant l'ouverture
  content: string;        // révélé après tap
  vraiFaux?: {            // quiz interactif Vrai/Faux
    question: string;
    answer: boolean;      // true = Vrai, false = Faux
    explanation: string;
  };
  videoId?: string;       // ID YouTube (ouvre dans navigateur)
  videoLabel?: string;    // libellé du bouton vidéo
}

const TIPS_ARTICLES: TipArticle[] = [
  // Postures
  {
    id: 't1',
    category: 'Postures',
    categoryEmoji: '🏋️',
    title: 'Le squat parfait',
    summary: 'Tape pour découvrir la technique complète + vidéo.',
    content: 'Pieds écartés largeur d\'épaules, pointes légèrement vers l\'extérieur. Descends en poussant les fesses en arrière, genoux alignés avec les orteils. Le dos reste droit — imagine que tu t\'assois sur une chaise. Descends jusqu\'à ce que tes cuisses soient parallèles au sol. Remonte en poussant par les talons.',
    vraiFaux: {
      question: 'Les genoux peuvent dépasser les orteils au squat sans danger.',
      answer: true,
      explanation: 'VRAI — C\'est un mythe. Les genoux peuvent légèrement dépasser les orteils sans risque si la technique globale est correcte. Interdire ce mouvement limite la profondeur et crée plus de tension dans le bas du dos.',
    },
    videoId: 'nhoikoUEI8U',
    videoLabel: '▶ Voir la technique en vidéo',
  },
  {
    id: 't2',
    category: 'Postures',
    categoryEmoji: '🏋️',
    title: 'Le soulevé de terre (deadlift)',
    summary: 'Tape pour maîtriser le roi des exercices sans te blesser.',
    content: 'Pieds sous la barre, écartés largeur de hanches. Prise mixte ou double pronation. Tire en gardant la barre collée aux tibias. Le dos reste PLAT — ne jamais arrondir le bas du dos. Verrouille en haut en serrant les fessiers.',
    vraiFaux: {
      question: 'Arrondir légèrement le dos au deadlift est acceptable pour soulever plus lourd.',
      answer: false,
      explanation: 'FAUX — Arrondir le dos au deadlift est l\'une des erreurs les plus dangereuses. Même une légère flexion sous charge maximale peut comprimer les disques lombaires. Priorité absolue : dos plat, même si tu soulèves moins lourd.',
    },
    videoId: 'op9kVnSso6Q',
    videoLabel: '▶ Voir la technique en vidéo',
  },
  {
    id: 't3',
    category: 'Postures',
    categoryEmoji: '🏋️',
    title: 'Le développé couché',
    summary: 'Tape pour protéger tes épaules et progresser plus vite.',
    content: 'Omoplates serrées, légère cambrure du bas du dos. Pieds bien ancrés au sol. Descends la barre au niveau des mamelons, coudes à 45° (pas 90°). Pousse en ligne droite vers le plafond.',
    vraiFaux: {
      question: 'Les coudes doivent être à 90° du corps pour un développé couché efficace.',
      answer: false,
      explanation: 'FAUX — Les coudes à 90° sont la position la plus risquée pour les épaules. La bonne position est 45-75° par rapport au corps. Ça réduit le stress sur le deltoïde antérieur et l\'articulation gléno-humérale.',
    },
    videoId: 'rT7DgCr-3pg',
    videoLabel: '▶ Voir la technique en vidéo',
  },
  {
    id: 't4',
    category: 'Postures',
    categoryEmoji: '🏋️',
    title: 'La bonne posture en course',
    summary: 'Tape pour courir plus vite et sans douleurs.',
    content: 'Regard droit devant, épaules relâchées, bras à 90°. Le pied atterrit sous le centre de gravité, pas devant. Fréquence idéale : 170-180 pas/min. Gainage actif pour économiser de l\'énergie.',
    vraiFaux: {
      question: 'Attaquer le sol avec le talon est la meilleure technique de course.',
      answer: false,
      explanation: 'FAUX — L\'attaque talon crée un effet de frein et augmente les impacts sur les articulations. L\'attaque médio-pied (sous le centre de gravité) est plus économique et génère moins de blessures à long terme.',
    },
    videoId: 'wRkeBVMQSgg',
    videoLabel: '▶ Voir la technique en vidéo',
  },
  // Mythes
  {
    id: 't5',
    category: 'Mythes',
    categoryEmoji: '🍽️',
    title: 'Les œufs font monter le cholestérol',
    summary: 'Vrai ou Faux ? Tape pour découvrir la réponse.',
    content: 'Le cholestérol alimentaire a très peu d\'impact sur le cholestérol sanguin. Les œufs sont une source exceptionnelle de protéines complètes, de choline et de vitamines. Tu peux manger 3-4 œufs par jour sans problème si tu es en bonne santé.',
    vraiFaux: {
      question: 'Manger des œufs chaque jour augmente significativement ton cholestérol sanguin.',
      answer: false,
      explanation: 'FAUX — Le foie régule la production de cholestérol en fonction de l\'apport alimentaire. Chez la majorité des gens, les œufs n\'augmentent pas le LDL de façon problématique. C\'est le sucre et les graisses trans qui sont les vraies causes.',
    },
  },
  {
    id: 't6',
    category: 'Mythes',
    categoryEmoji: '🍽️',
    title: 'Manger le soir fait grossir',
    summary: 'Vrai ou Faux ? Tape pour découvrir la réponse.',
    content: 'Ce qui compte c\'est le total calorique sur 24h, pas l\'heure. Manger tard ne stocke pas plus de gras. Par contre, évite les glucides rapides avant de dormir — privilégie protéines + légumes.',
    vraiFaux: {
      question: 'Un repas pris après 20h est stocké directement en graisse.',
      answer: false,
      explanation: 'FAUX — Le corps ne stocke pas les graisses différemment selon l\'heure. Ce qui compte c\'est le bilan calorique total sur 24h. Dîner tard peut cependant perturber le sommeil et la sécrétion de mélatonine.',
    },
  },
  {
    id: 't7',
    category: 'Mythes',
    categoryEmoji: '🍽️',
    title: 'Les protéines abîment les reins',
    summary: 'Vrai ou Faux ? Tape pour découvrir la réponse.',
    content: 'Aucune étude n\'a montré que 2g/kg de protéines abîme les reins chez les personnes en bonne santé. C\'est un mythe qui décourage les sportifs de consommer assez de protéines.',
    vraiFaux: {
      question: 'Consommer 2g de protéines par kg de poids endommage les reins des sportifs sains.',
      answer: false,
      explanation: 'FAUX — Ce mythe vient d\'études sur des patients déjà atteints d\'insuffisance rénale. Chez les personnes saines, jusqu\'à 3g/kg/j ne montre aucun impact négatif sur la fonction rénale. Hydrate-toi bien, c\'est tout.',
    },
  },
  {
    id: 't8',
    category: 'Mythes',
    categoryEmoji: '🍽️',
    title: 'Il faut manger toutes les 3 heures',
    summary: 'Vrai ou Faux ? Tape pour découvrir la réponse.',
    content: 'La fréquence des repas n\'affecte pas le métabolisme. Ce qui compte c\'est le total calorique et la répartition des macros. 3 repas ou 6 repas — même résultat si les totaux sont identiques.',
    vraiFaux: {
      question: 'Manger toutes les 3h booste le métabolisme et brûle plus de calories.',
      answer: false,
      explanation: 'FAUX — L\'effet thermique des aliments (environ 10% des calories) est identique quelle que soit la fréquence des repas. Ce mythe vient des années 80. Les études actuelles montrent qu\'il n\'y a aucune différence sur la composition corporelle.',
    },
  },
  // Récupération
  {
    id: 't9',
    category: 'Récupération',
    categoryEmoji: '💪',
    title: 'Sommeil = muscle',
    summary: 'Tape pour comprendre pourquoi le sommeil est ton meilleur allié.',
    content: '70% de l\'hormone de croissance est sécrétée pendant le sommeil profond. Dormir moins de 6h réduit la synthèse protéique de 18%. Vise 7-9h, dans une chambre fraîche et sombre.',
    vraiFaux: {
      question: 'Dormir moins de 6h réduit la synthèse musculaire de plus de 15%.',
      answer: true,
      explanation: 'VRAI — Une étude de 2011 (Nedeltcheva et al.) a montré que restreindre le sommeil à 5.5h réduisait la perte de masse grasse de 55% et la synthèse protéique de 18%. Le sommeil est aussi important que l\'entraînement.',
    },
  },
  {
    id: 't10',
    category: 'Récupération',
    categoryEmoji: '💪',
    title: 'L\'importance de l\'hydratation',
    summary: 'Tape pour découvrir à quel point l\'eau impacte tes performances.',
    content: '1% de déshydratation = 10% de perte de performance. Bois 30-40ml par kg de poids corporel par jour. Pendant l\'effort : 150-250ml toutes les 15 minutes. L\'eau minérale est préférable à l\'eau du robinet pour les sportifs.',
    vraiFaux: {
      question: '1% de déshydratation peut réduire tes performances sportives de 10%.',
      answer: true,
      explanation: 'VRAI — Même une légère déshydratation impacte la force, l\'endurance et la concentration. À 2% de déshydratation, la performance chute de 20%. L\'urine doit être jaune clair — si elle est foncée, bois immédiatement.',
    },
  },
  {
    id: 't11',
    category: 'Récupération',
    categoryEmoji: '💪',
    title: 'Stretching et mobilité',
    summary: 'Tape pour savoir comment étirer efficacement.',
    content: '10 minutes de stretching post-workout réduisent les courbatures de 30%. Concentre-toi sur les groupes musculaires travaillés. Maintiens chaque étirement 20-30 secondes. Le stretching statique doit se faire APRÈS l\'effort, pas avant.',
    vraiFaux: {
      question: 'Faire du stretching statique avant l\'entraînement améliore les performances.',
      answer: false,
      explanation: 'FAUX — Le stretching statique avant l\'effort réduit temporairement la force et la puissance musculaire. Avant l\'entraînement : échauffement dynamique (rotations, leg swings). Après : stretching statique pour récupérer.',
    },
    videoId: 'g6lTK4XBhKk',
    videoLabel: '▶ Routine stretching complète',
  },
  // Mindset
  {
    id: 't12',
    category: 'Mindset',
    categoryEmoji: '🧠',
    title: 'La règle des 2 jours',
    summary: 'Vrai ou Faux ? Tape pour découvrir cette règle qui change tout.',
    content: 'Ne rate jamais 2 jours d\'affilée. Rater un jour c\'est humain, rater deux jours c\'est une habitude qui se perd. Même 20 minutes comptent. Cette règle est utilisée par les athlètes professionnels pour maintenir la régularité.',
    vraiFaux: {
      question: 'Rater 2 jours d\'entraînement consécutifs brise le circuit de l\'habitude dans le cerveau.',
      answer: true,
      explanation: 'VRAI — Les neurosciences montrent que 2 jours sans comportement ciblent le circuit de récompense et réduisent la dopamine associée à l\'activité. Après 3 jours, l\'habitude doit être reconstruite. La règle des 2 jours protège le circuit.',
    },
  },
  {
    id: 't13',
    category: 'Mindset',
    categoryEmoji: '🧠',
    title: 'Progresser, pas performer',
    summary: 'Tape pour changer ta façon de mesurer le succès.',
    content: 'Compare-toi à toi-même d\'il y a 3 mois, pas au gars à côté. La progression est personnelle. 1% de mieux chaque jour = 37x mieux en un an (effet composé). Garde un journal de tes performances.',
    vraiFaux: {
      question: 'Une amélioration de 1% par jour pendant 365 jours te rend 37 fois meilleur.',
      answer: true,
      explanation: 'VRAI — C\'est l\'effet composé appliqué à la performance : 1.01^365 = 37.78. À l\'inverse, 0.99^365 = 0.03 — régresser de 1% par jour te ramène à presque rien en un an. La régularité bat l\'intensité sur le long terme.',
    },
  },
  {
    id: 't14',
    category: 'Mindset',
    categoryEmoji: '🧠',
    title: 'L\'effet communauté',
    summary: 'Tape pour comprendre pourquoi l\'Arena booste tes résultats.',
    content: 'Les personnes qui s\'entraînent en groupe ont 95% plus de chances de maintenir leur programme. C\'est pour ça que l\'Arena existe — ensemble on va plus loin. La responsabilité sociale active le cortex préfrontal et réduit la procrastination.',
    vraiFaux: {
      question: 'S\'entraîner en groupe augmente la persévérance de plus de 90% par rapport à l\'entraînement solo.',
      answer: true,
      explanation: 'VRAI — Une étude de l\'Université d\'Aberdeen (2016) a montré que trouver un partenaire d\'entraînement augmentait les séances de 78% en moyenne. Ajouter la compétition et la communauté monte ce chiffre à 95%.',
    },
  },
];

const TIPS_CATEGORIES = ['Postures', 'Mythes', 'Récupération', 'Mindset'];

// ─── Challenges Data ───────────────────────────────────────────────────────────

const STATIC_CHALLENGES = [
  {
    id: 'c1',
    type: 'Inter-gym',
    title: 'Cluny VS Ducos — Avril',
    teamA: { name: 'Cluny', pts: 847 },
    teamB: { name: 'Ducos', pts: 923 },
    daysLeft: 18,
    joinPoints: 10,
  },
  {
    id: 'c2',
    type: 'Personnel',
    title: '30 jours sans junk food',
    progress: 18,
    total: 30,
    participants: 128,
    daysLeft: 12,
    joinPoints: 0,
  },
  {
    id: 'c3',
    type: 'Amis',
    title: 'Objectif +3kg masse',
    participants: 6,
    daysLeft: 42,
    joinPoints: 0,
  },
  {
    id: 'c4',
    type: 'WOD',
    title: 'WOD hebdo — Record perso',
    participants: 73,
    daysLeft: 5,
    joinPoints: 0,
  },
];

const AVATAR_COLORS = [
  '#005240', '#E8612D', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981',
];

function avatarColor(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ArenaScreen({ session }: ArenaScreenProps) {
  // FIT Points
  const [fitPoints, setFitPoints] = useState(350);
  const [level, setLevel] = useState(() => getLevel(350));
  const [streak] = useState(12);

  // Floating animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const [floatLabel, setFloatLabel] = useState('');

  function awardPoints(pts: number, label: string) {
    const next = fitPoints + pts;
    setFitPoints(next);
    setLevel(getLevel(next));
    setFloatLabel(`+${pts} pts`);
    floatAnim.setValue(0);
    floatOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(floatAnim, { toValue: -80, duration: 1200, useNativeDriver: true }),
      Animated.timing(floatOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]).start();
  }

  // Tabs
  const [activeTab, setActiveTab] = useState<ArenaTab>('quiz');

  // ── Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(true);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>(Array(5).fill(null));
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizPointsAwarded, setQuizPointsAwarded] = useState(false);
  const [quizDoneToday, setQuizDoneToday] = useState(false);
  const [quizTodayResult, setQuizTodayResult] = useState<{ score: number; points: number } | null>(null);

  function handleAnswer(idx: number) {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    const newAnswers = [...quizAnswers];
    newAnswers[quizIndex] = idx;
    setQuizAnswers(newAnswers);
  }

  function nextQuestion() {
    if (quizIndex + 1 >= quizQuestions.length) {
      setQuizFinished(true);
    } else {
      setQuizIndex(i => i + 1);
      setSelectedAnswer(null);
    }
  }

  // Compute score when finished
  const quizScore = quizQuestions.reduce(
    (acc, q, i) => acc + (quizAnswers[i] === q.correctIndex ? 1 : 0),
    0
  );

  // Charger les questions — avec vérification 1x/jour
  useEffect(() => {
    async function fetchQuizQuestions() {
      try {
        // Vérifier si déjà fait aujourd'hui
        if (session?.user) {
          const today = new Date().toISOString().split('T')[0];
          const { data: done } = await supabase
            .from('user_daily_quiz')
            .select('score, points_earned')
            .eq('user_id', session.user.id)
            .eq('quiz_date', today)
            .single();
          if (done) {
            setQuizDoneToday(true);
            setQuizTodayResult({ score: done.score, points: done.points_earned });
            setQuizLoading(false);
            return;
          }
        }

        const { data, error } = await supabase.rpc('get_random_quiz_questions', { n: 5 });
        if (!error && data && data.length > 0) {
          setQuizQuestions(data.map((q: any) => ({
            id: String(q.id),
            category: q.category,
            categoryEmoji: q.emoji || '❓',
            question: q.question,
            options: Array.isArray(q.options) ? q.options : JSON.parse(q.options),
            correctIndex: q.answer,
            fact: q.fact || '',
          })));
          setQuizAnswers(Array(data.length).fill(null));
        }
      } catch (e) {
        console.error('Quiz fetch error:', e);
      } finally {
        setQuizLoading(false);
      }
    }
    fetchQuizQuestions();
  }, [session]);

  useEffect(() => {
    if (quizFinished && !quizPointsAwarded) {
      const pts = getQuizPoints(quizScore);
      awardPoints(pts, 'quiz');
      setQuizPointsAwarded(true);
      // Sauvegarder dans Supabase
      if (session?.user) {
        const today = new Date().toISOString().split('T')[0];
        supabase.from('user_daily_quiz').upsert({
          user_id: session.user.id,
          quiz_date: today,
          score: quizScore,
          points_earned: pts,
        }, { onConflict: 'user_id,quiz_date' }).then(() => {
          setQuizDoneToday(true);
          setQuizTodayResult({ score: quizScore, points: pts });
        });
      }
    }
  }, [quizFinished, quizScore]);

  function restartQuiz() {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizAnswers(Array(5).fill(null));
    setQuizFinished(false);
    setQuizPointsAwarded(false);
  }

  // ── Feed state
  const [posts, setPosts] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [postLoading, setPostLoading] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const { data } = await supabase
        .from('arena_posts')
        .select('*, profiles(first_name, regime, fitness_park)')
        .order('created_at', { ascending: false })
        .limit(50);
      setPosts(data || []);
    } catch (e) {
      console.error('Feed error:', e);
      setPosts([]);
    } finally {
      setFeedLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'feed') loadFeed();
  }, [activeTab]);

  async function submitPost() {
    if (!newPost.trim() || !session?.user) return;
    setPostLoading(true);
    try {
      const { error } = await supabase.from('arena_posts').insert({
        user_id: session.user.id,
        content: newPost.trim(),
      });
      if (!error) {
        setNewPost('');
        setShowComposer(false);
        await loadFeed();
      } else {
        showAlert('Erreur', 'Impossible de publier.');
      }
    } catch {
      showAlert('Erreur', 'Impossible de publier.');
    } finally {
      setPostLoading(false);
    }
  }

  // ── Challenges state
  const [joinedChallenges, setJoinedChallenges] = useState<Set<string>>(new Set());

  function joinChallenge(id: string, pts: number, title: string) {
    if (joinedChallenges.has(id)) return;
    const next = new Set(joinedChallenges);
    next.add(id);
    setJoinedChallenges(next);
    if (pts > 0) awardPoints(pts, 'challenge');
    showAlert('Défi rejoint !', `Tu as rejoint "${title}". Bonne chance ! 💪`);
  }

  // ── Tips state
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [readTips, setReadTips] = useState<Set<string>>(new Set());
  const [tipsCategory, setTipsCategory] = useState<string>('Postures');
  const [vraiFauxAnswers, setVraiFauxAnswers] = useState<Record<string, boolean | null>>({});  // null = pas encore répondu

  function answerVraiFaux(tipId: string, answer: boolean) {
    setVraiFauxAnswers(prev => ({ ...prev, [tipId]: answer }));
  }

  function toggleTip(id: string) {
    if (expandedTip === id) {
      setExpandedTip(null);
    } else {
      setExpandedTip(id);
      if (!readTips.has(id)) {
        const next = new Set(readTips);
        next.add(id);
        setReadTips(next);
        awardPoints(5, 'tip');
      }
    }
  }

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  const currentQ = quizQuestions[quizIndex] || null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Floating points badge */}
      <Animated.View
        style={[
          styles.floatBadge,
          { transform: [{ translateY: floatAnim }], opacity: floatOpacity },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.floatBadgeText}>{floatLabel}</Text>
      </Animated.View>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Arena ⚔️</Text>
          <Text style={styles.headerStreak}>🔥 {streak} jours de streak</Text>
        </View>
        <View style={styles.fitBadge}>
          <Text style={styles.fitBadgePts}>🔥 {fitPoints} pts</Text>
          <View style={styles.fitLevelBadge}>
            <Text style={styles.fitLevelText}>
              {level.emoji} {level.name}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {([
          { key: 'quiz', label: '🧠 Quiz' },
          { key: 'feed', label: '📣 Feed' },
          { key: 'challenges', label: '⚔️ Challenges' },
          { key: 'tips', label: '💡 Tips' },
        ] as { key: ArenaTab; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Quiz Tab ── */}
      {activeTab === 'quiz' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.quizContent}>
          {quizLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator size="large" color={Colors.darkGreen} />
              <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Chargement du quiz...</Text>
            </View>
          ) : quizDoneToday && quizTodayResult && !quizFinished ? (
            // ── Quiz déjà fait aujourd'hui — afficher le score comme une victoire
            <View style={styles.resultContainer}>
              <Text style={styles.resultEmoji}>
                {quizTodayResult.score === 5 ? '🏆' : quizTodayResult.score === 4 ? '🥇' : quizTodayResult.score === 3 ? '🥈' : '💪'}
              </Text>
              <Text style={styles.resultTitle}>Quiz du jour complété !</Text>
              <Text style={styles.resultScore}>{quizTodayResult.score} / 5</Text>
              <Text style={styles.resultSub}>bonnes réponses aujourd'hui</Text>

              <View style={styles.resultPointsBox}>
                <Text style={styles.resultPointsLabel}>Points gagnés</Text>
                <Text style={styles.resultPointsValue}>+{quizTodayResult.points} pts</Text>
              </View>

              <View style={styles.resultStreakBox}>
                <Text style={styles.resultStreakText}>🔥 Streak : {streak} jours</Text>
              </View>

              <View style={styles.quizCoachComment}>
                <Text style={styles.quizCoachCommentText}>
                  {quizTodayResult.score === 5
                    ? '🏆 Parfait ! 5/5 — Tu es imbattable aujourd\'hui !'
                    : quizTodayResult.score === 4
                    ? '🥇 Excellent ! 4/5 — Presque parfait, continue comme ça !'
                    : quizTodayResult.score === 3
                    ? '🥈 Bien joué ! 3/5 — Tu progresses chaque jour.'
                    : quizTodayResult.score === 2
                    ? '💪 2/5 — Bonne participation ! Les tips Arena t\'aideront.'
                    : '💪 Tu t\'es lancé, c\'est déjà une victoire !'}
                </Text>
                <View style={styles.quizDoneSeparator} />
                <Text style={styles.quizDoneNextLabel}>Prochain quiz disponible dans</Text>
                <Text style={styles.quizDoneNextTime}>
                  {(() => {
                    const now = new Date();
                    const midnight = new Date();
                    midnight.setHours(24, 0, 0, 0);
                    const diff = Math.ceil((midnight.getTime() - now.getTime()) / 60000);
                    const h = Math.floor(diff / 60);
                    const m = diff % 60;
                    return `${h}h ${m}min`;
                  })()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => {
                  setActiveTab('feed');
                  setShowComposer(true);
                  setNewPost(`🧠 Quiz Arena — ${quizTodayResult.score}/5 bonnes réponses ! +${quizTodayResult.points} pts gagnés. Streak : ${streak} jours 🔥`);
                }}
              >
                <Text style={styles.shareButtonText}>📣 Partager sur le Feed</Text>
              </TouchableOpacity>
            </View>

          ) : quizQuestions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40 }}>😕</Text>
              <Text style={{ marginTop: 12, color: Colors.textSecondary, textAlign: 'center' }}>Impossible de charger le quiz. Vérifie ta connexion.</Text>
            </View>
          ) : quizFinished ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultEmoji}>
                {quizScore === 5 ? '🏆' : quizScore >= 3 ? '💪' : '📚'}
              </Text>
              <Text style={styles.resultTitle}>Quiz terminé !</Text>
              <Text style={styles.resultScore}>
                {quizScore} / {quizQuestions.length}
              </Text>
              <Text style={styles.resultSub}>bonnes réponses</Text>

              <View style={styles.resultPointsBox}>
                <Text style={styles.resultPointsLabel}>Points gagnés</Text>
                <Text style={styles.resultPointsValue}>+{getQuizPoints(quizScore)} pts</Text>
              </View>

              <View style={styles.resultStreakBox}>
                <Text style={styles.resultStreakText}>🔥 Streak : {streak} jours</Text>
              </View>

              {/* Commentaire coach selon le score */}
              <View style={styles.quizCoachComment}>
                <Text style={styles.quizCoachCommentText}>
                  {quizScore === 5
                    ? '🏆 Parfait ! 5/5 — Tu es une encyclopédie vivante. Continuer comme ça !'
                    : quizScore === 4
                    ? '🥇 Excellent ! 4/5 — Un tout petit effort et tu toucheras la perfection.'
                    : quizScore === 3
                    ? '🥈 Bien joué ! 3/5 — Tu progresses. Reviens demain pour aller plus loin.'
                    : quizScore === 2
                    ? '💪 2/5 — C\'est un début. Consulte les tips pour t\'améliorer !'
                    : quizScore === 1
                    ? '📚 1/5 — N\'abandonne pas. Chaque jour compte.'
                    : '📚 0/5 — Ça arrive ! Commence par lire les tips de l\'Arena.'}
                </Text>
                <Text style={styles.quizCoachReviensDemain}>
                  Reviens demain pour le prochain quiz 👋
                </Text>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => {
                  setActiveTab('feed');
                  setShowComposer(true);
                  setNewPost(
                    `🧠 Quiz Arena — ${quizScore}/5 bonnes réponses ! +${getQuizPoints(
                      quizScore
                    )} pts gagnés. Streak : ${streak} jours 🔥`
                  );
                }}
              >
                <Text style={styles.shareButtonText}>📣 Partager sur le Feed</Text>
              </TouchableOpacity>

              {/* Recommencer désactivé — 1x par jour */}
            </View>
          ) : (
            <View>
              {!currentQ ? null : (<>
              {/* Progress dots */}
              <View style={styles.progressDots}>
                {quizQuestions.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i < quizIndex && styles.dotDone,
                      i === quizIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>

              {/* Category badge */}
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {currentQ.categoryEmoji} {currentQ.category}
                </Text>
              </View>

              {/* Question */}
              <Text style={styles.questionText}>{currentQ.question}</Text>

              {/* Options */}
              {currentQ.options.map((opt, i) => {
                const answered = selectedAnswer !== null;
                const isCorrect = i === currentQ.correctIndex;
                const isSelected = i === selectedAnswer;
                const showCorrect = answered && isCorrect;
                const showWrong = answered && isSelected && !isCorrect;

                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.optionButton,
                      showCorrect && styles.optionCorrect,
                      showWrong && styles.optionWrong,
                    ]}
                    onPress={() => handleAnswer(i)}
                    disabled={answered}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.optionLetter,
                        showCorrect && styles.optionLetterCorrect,
                        showWrong && styles.optionLetterWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLetterText,
                          (showCorrect || showWrong) && styles.optionLetterTextFilled,
                        ]}
                      >
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        showCorrect && styles.optionTextCorrect,
                        showWrong && styles.optionTextWrong,
                      ]}
                    >
                      {opt}
                    </Text>
                    {showCorrect && <Text style={styles.optionCheck}>✓</Text>}
                    {showWrong && <Text style={styles.optionX}>✕</Text>}
                  </TouchableOpacity>
                );
              })}

              {/* Fact + next */}
              {selectedAnswer !== null && (
                <View style={styles.factBox}>
                  <Text style={styles.factIcon}>
                    {selectedAnswer === currentQ.correctIndex ? '✅' : '❌'}
                  </Text>
                  <View style={styles.factContent}>
                    <Text style={styles.factLabel}>
                      {selectedAnswer === currentQ.correctIndex
                        ? 'Bonne réponse !'
                        : `Réponse : ${currentQ.options[currentQ.correctIndex]}`}
                    </Text>
                    <Text style={styles.factText}>{currentQ.fact}</Text>
                  </View>
                </View>
              )}

              {selectedAnswer !== null && (
                <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
                  <Text style={styles.nextButtonText}>
                    {quizIndex + 1 >= quizQuestions.length
                      ? 'Voir mes résultats →'
                      : 'Question suivante →'}
                  </Text>
                </TouchableOpacity>
              )}
              </>)}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Feed Tab ── */}
      {activeTab === 'feed' && (
        <View style={styles.flex}>
          {/* Composer */}
          {showComposer ? (
            <View style={styles.composerExpanded}>
              <TextInput
                style={styles.composerInput}
                value={newPost}
                onChangeText={setNewPost}
                placeholder="Partage ton score, ta séance, ton repas…"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={280}
                autoFocus
              />
              <View style={styles.composerActions}>
                <TouchableOpacity
                  style={styles.composerCancel}
                  onPress={() => {
                    setShowComposer(false);
                    setNewPost('');
                  }}
                >
                  <Text style={styles.composerCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.postButton,
                    (!newPost.trim() || postLoading) && styles.postButtonDisabled,
                  ]}
                  onPress={submitPost}
                  disabled={!newPost.trim() || postLoading}
                >
                  {postLoading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.postButtonText}>Publier</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.composerPill}
              onPress={() => setShowComposer(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.composerPillText}>
                Partage ton score, ta séance, ton repas…
              </Text>
              <View style={styles.composerPlusBtn}>
                <Text style={styles.composerPlusText}>+</Text>
              </View>
            </TouchableOpacity>
          )}

          {feedLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={Colors.darkGreen} />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.feedList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadFeed();
                  }}
                  tintColor={Colors.darkGreen}
                />
              }
              renderItem={({ item }) => {
                const name = item.profiles?.first_name ?? 'Anonyme';
                const initial = name[0]?.toUpperCase() ?? '?';
                const bg = avatarColor(name);
                const regime = item.profiles?.regime;
                const park = item.profiles?.fitness_park;

                return (
                  <View style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={[styles.avatar, { backgroundColor: bg }]}>
                        <Text style={styles.avatarText}>{initial}</Text>
                      </View>
                      <View style={styles.postMeta}>
                        <Text style={styles.postAuthor}>{name}</Text>
                        <View style={styles.postBadgeRow}>
                          {regime && (
                            <View
                              style={[
                                styles.regimeBadge,
                                {
                                  backgroundColor:
                                    regime === 'masse'
                                      ? Colors.masse + '20'
                                      : regime === 'seche'
                                      ? Colors.seche + '20'
                                      : Colors.equilibre + '20',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.regimeBadgeText,
                                  {
                                    color:
                                      regime === 'masse'
                                        ? Colors.masse
                                        : regime === 'seche'
                                        ? Colors.seche
                                        : Colors.equilibre,
                                  },
                                ]}
                              >
                                {regime === 'masse'
                                  ? '💪 Masse'
                                  : regime === 'seche'
                                  ? '🔥 Sèche'
                                  : '⚖️ Équilibré'}
                              </Text>
                            </View>
                          )}
                          {park && (
                            <Text style={styles.postPark}>📍 {park}</Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.postTime}>
                        {relativeDate(item.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.postContent}>{item.content}</Text>
                    <TouchableOpacity style={styles.likeRow} activeOpacity={0.7}>
                      <Text style={styles.likeText}>❤️ {item.likes ?? 0}</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyFeed}>
                  <Text style={styles.emptyFeedEmoji}>📣</Text>
                  <Text style={styles.emptyFeedText}>
                    Aucun post pour le moment — sois le premier !
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ── Challenges Tab ── */}
      {activeTab === 'challenges' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.challengesContent}>
          {STATIC_CHALLENGES.map(c => {
            const joined = joinedChallenges.has(c.id);
            return (
              <View key={c.id} style={styles.challengeCard}>
                <View style={styles.challengeTypeBadge}>
                  <Text style={styles.challengeTypeText}>{c.type}</Text>
                </View>
                <Text style={styles.challengeTitle}>{c.title}</Text>

                {/* Inter-gym: score bars */}
                {c.id === 'c1' && c.teamA && c.teamB && (() => {
                  const total = c.teamA.pts + c.teamB.pts;
                  const pctA = (c.teamA.pts / total) * 100;
                  return (
                    <View style={styles.interGymBlock}>
                      <View style={styles.interGymRow}>
                        <Text style={styles.interGymTeam}>{c.teamA.name}</Text>
                        <Text style={styles.interGymPts}>{c.teamA.pts} pts</Text>
                      </View>
                      <View style={styles.interGymBar}>
                        <View
                          style={[
                            styles.interGymBarA,
                            { width: `${pctA}%` as any },
                          ]}
                        />
                        <View style={styles.interGymBarB} />
                      </View>
                      <View style={styles.interGymRow}>
                        <Text style={styles.interGymTeam}>{c.teamB.name}</Text>
                        <Text style={styles.interGymPts}>{c.teamB.pts} pts</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Personal: progress bar */}
                {c.progress !== undefined && c.total !== undefined && (
                  <View style={styles.progressBlock}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${(c.progress / c.total) * 100}%` as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      {c.progress}/{c.total} jours
                    </Text>
                  </View>
                )}

                <View style={styles.challengeMeta}>
                  {c.participants !== undefined && (
                    <Text style={styles.challengeMetaText}>
                      👥 {c.participants} participants
                    </Text>
                  )}
                  <Text style={styles.challengeMetaText}>
                    ⏱ {c.daysLeft}j restants
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.joinButton, joined && styles.joinButtonDone]}
                  onPress={() =>
                    !joined && joinChallenge(c.id, c.joinPoints ?? 0, c.title)
                  }
                  disabled={joined}
                >
                  <Text style={[styles.joinButtonText, joined && styles.joinButtonTextDone]}>
                    {joined
                      ? '✓ Rejoint'
                      : c.id === 'c1'
                      ? `Rejoindre mon équipe +${c.joinPoints} pts`
                      : 'Rejoindre'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.createChallengeButton}
            onPress={() => showAlert('Bientôt disponible', 'La création de challenges arrive prochainement !')}
          >
            <Text style={styles.createChallengeText}>+ Créer un challenge</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Tips Tab ── */}
      {activeTab === 'tips' && (
        <View style={styles.flex}>
          {/* Category filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tipsFilterScroll}
            contentContainerStyle={styles.tipsFilterContainer}
          >
            {TIPS_CATEGORIES.map(cat => {
              const article = TIPS_ARTICLES.find(a => a.category === cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.tipsFilterTab,
                    tipsCategory === cat && styles.tipsFilterTabActive,
                  ]}
                  onPress={() => setTipsCategory(cat)}
                >
                  <Text style={styles.tipsFilterEmoji}>
                    {article?.categoryEmoji ?? ''}
                  </Text>
                  <Text
                    style={[
                      styles.tipsFilterText,
                      tipsCategory === cat && styles.tipsFilterTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.tipsContent}
            showsVerticalScrollIndicator={false}
          >
            {TIPS_ARTICLES.filter(a => a.category === tipsCategory).map(article => {
              const isExpanded = expandedTip === article.id;
              const isRead = readTips.has(article.id);
              const userAnswer = vraiFauxAnswers[article.id] ?? null;
              const hasAnswered = userAnswer !== null;

              return (
                <TouchableOpacity
                  key={article.id}
                  style={[styles.tipCard, isExpanded && styles.tipCardExpanded]}
                  onPress={() => toggleTip(article.id)}
                  activeOpacity={0.8}
                >
                  {/* Header */}
                  <View style={styles.tipCardHeader}>
                    <View style={styles.tipEmojiBox}>
                      <Text style={styles.tipEmoji}>{article.categoryEmoji}</Text>
                    </View>
                    <View style={styles.tipCardInfo}>
                      <View style={styles.tipTitleRow}>
                        <Text style={styles.tipTitle} numberOfLines={2}>
                          {article.title}
                        </Text>
                        {isRead && (
                          <View style={styles.readBadge}>
                            <Text style={styles.readBadgeText}>Lu ✓</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.tipSummary} numberOfLines={isExpanded ? undefined : 2}>
                        {article.summary}
                      </Text>
                    </View>
                    <Text style={styles.tipChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>

                  {/* Contenu déroulé */}
                  {isExpanded && (
                    <View style={styles.tipContentBox}>

                      {/* Quiz Vrai/Faux — AVANT le contenu */}
                      {article.vraiFaux && (
                        <View style={styles.vraiFauxBox}>
                          <Text style={styles.vraiFauxQuestion}>
                            🤔 {article.vraiFaux.question}
                          </Text>
                          {!hasAnswered ? (
                            <View style={styles.vraiFauxBtns}>
                              <TouchableOpacity
                                style={styles.vraiFauxBtnVrai}
                                onPress={(e) => { e.stopPropagation?.(); answerVraiFaux(article.id, true); }}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.vraiFauxBtnText}>✅ VRAI</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.vraiFauxBtnFaux}
                                onPress={(e) => { e.stopPropagation?.(); answerVraiFaux(article.id, false); }}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.vraiFauxBtnText}>❌ FAUX</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={[
                              styles.vraiFauxResult,
                              userAnswer === article.vraiFaux.answer ? styles.vraiFauxCorrect : styles.vraiFauxWrong,
                            ]}>
                              <Text style={styles.vraiFauxResultIcon}>
                                {userAnswer === article.vraiFaux.answer ? '🎉' : '😅'}
                              </Text>
                              <Text style={styles.vraiFauxResultLabel}>
                                {userAnswer === article.vraiFaux.answer
                                  ? 'Bonne réponse !'
                                  : 'Raté — la bonne réponse était : ' + (article.vraiFaux.answer ? 'VRAI' : 'FAUX')}
                              </Text>
                              <Text style={styles.vraiFauxExplanation}>
                                {article.vraiFaux.explanation}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Contenu texte — révélé seulement après quiz (ou si pas de quiz) */}
                      {(hasAnswered || !article.vraiFaux) && (
                        <Text style={styles.tipContent}>{article.content}</Text>
                      )}

                      {/* Bouton vidéo YouTube */}
                      {article.videoId && (hasAnswered || !article.vraiFaux) && (
                        <TouchableOpacity
                          style={styles.videoBtn}
                          onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${article.videoId}`)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.videoBtnText}>
                            {article.videoLabel ?? '▶ Voir la vidéo'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {!isRead && (
                        <Text style={styles.tipPointsHint}>+5 pts pour avoir lu cet article 🔥</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },

  // ── Floating badge
  floatBadge: {
    position: 'absolute',
    top: 80,
    right: 24,
    backgroundColor: Colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  floatBadgeText: {
    color: Colors.darkGreen,
    fontWeight: '900',
    fontSize: 16,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  headerStreak: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  fitBadge: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
    gap: 4,
  },
  fitBadgePts: {
    color: Colors.lime,
    fontWeight: '900',
    fontSize: 14,
  },
  fitLevelBadge: {
    backgroundColor: Colors.lime + '25',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  fitLevelText: {
    color: Colors.lime,
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Tabs
  tabsScroll: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexGrow: 0,
  },
  tabsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  tabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.darkGreen + '30',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.darkGreen,
  },

  // ── Quiz
  quizContent: {
    padding: 20,
    paddingBottom: 40,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotDone: {
    backgroundColor: Colors.lime,
  },
  dotActive: {
    backgroundColor: Colors.darkGreen,
    width: 24,
    borderRadius: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.darkGreen + '15',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: Colors.darkGreen,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  optionCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '12',
  },
  optionWrong: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '12',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  optionLetterWrong: {
    borderColor: Colors.error,
    backgroundColor: Colors.error,
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  optionLetterTextFilled: {
    color: Colors.white,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  optionTextCorrect: {
    color: Colors.success,
    fontWeight: '700',
  },
  optionTextWrong: {
    color: Colors.error,
    fontWeight: '600',
  },
  optionCheck: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: '800',
  },
  optionX: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '800',
  },
  factBox: {
    flexDirection: 'row',
    backgroundColor: Colors.darkGreen + '08',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.darkGreen + '20',
    gap: 10,
  },
  factIcon: {
    fontSize: 20,
  },
  factContent: {
    flex: 1,
    gap: 4,
  },
  factLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  factText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  nextButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Quiz result
  resultContainer: {
    alignItems: 'center',
    paddingTop: 16,
    gap: 10,
  },
  resultEmoji: {
    fontSize: 72,
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  resultScore: {
    fontSize: 52,
    fontWeight: '900',
    color: Colors.darkGreen,
    lineHeight: 56,
  },
  resultSub: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  resultPointsBox: {
    backgroundColor: Colors.lime + '30',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resultPointsLabel: {
    fontSize: 12,
    color: Colors.darkGreen,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultPointsValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.darkGreen,
  },
  resultStreakBox: {
    backgroundColor: Colors.orange + '15',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultStreakText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.orange,
  },
  shareButton: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Quiz déjà fait aujourd'hui
  quizDoneCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.lime,
    marginBottom: 16,
  },
  quizDoneEmoji: { fontSize: 56, marginBottom: 4 },
  quizDoneTitle: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  quizDoneScore: { fontSize: 48, fontWeight: '800', color: Colors.darkGreen },
  quizDonePoints: {
    fontSize: 18, fontWeight: '800', color: Colors.white,
    backgroundColor: Colors.lime, paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20,
    overflow: 'hidden', marginVertical: 4,
  },
  quizDoneComment: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
    marginTop: 4,
  },
  quizDoneSeparator: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  quizDoneNextLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  quizDoneNextTime: { fontSize: 24, fontWeight: '800', color: Colors.darkGreen },

  // ── Commentaire coach en fin de quiz
  quizCoachComment: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  quizCoachCommentText: {
    fontSize: 14, color: Colors.textPrimary, fontWeight: '600', lineHeight: 20,
    textAlign: 'center',
  },
  quizCoachReviensDemain: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic',
  },

  restartButton: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: Colors.darkGreen,
  },
  restartButtonText: {
    color: Colors.darkGreen,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Feed
  composerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    margin: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  composerPillText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textMuted,
  },
  composerPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerPlusText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  composerExpanded: {
    backgroundColor: Colors.white,
    margin: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.darkGreen + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    gap: 10,
  },
  composerInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  composerCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  composerCancelText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  postButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  postButtonDisabled: {
    opacity: 0.45,
  },
  postButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedList: {
    padding: 12,
    paddingBottom: 40,
    gap: 10,
  },
  postCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  postMeta: {
    flex: 1,
    gap: 3,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  postBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  regimeBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  regimeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postPark: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  postTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  postContent: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyFeed: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyFeedEmoji: {
    fontSize: 48,
  },
  emptyFeedText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Challenges
  challengesContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  challengeCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
    gap: 10,
  },
  challengeTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.darkGreen + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  challengeTypeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.darkGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  interGymBlock: {
    gap: 6,
  },
  interGymRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interGymTeam: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  interGymPts: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  interGymBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  interGymBarA: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 4,
  },
  interGymBarB: {
    flex: 1,
    backgroundColor: Colors.orange,
  },
  progressBlock: {
    gap: 6,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.lime,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  challengeMeta: {
    flexDirection: 'row',
    gap: 14,
  },
  challengeMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: Colors.lime,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinButtonDone: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinButtonText: {
    color: Colors.darkGreen,
    fontSize: 14,
    fontWeight: '800',
  },
  joinButtonTextDone: {
    color: Colors.textMuted,
  },
  createChallengeButton: {
    borderWidth: 2,
    borderColor: Colors.darkGreen,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  createChallengeText: {
    color: Colors.darkGreen,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Tips
  tipsFilterScroll: {
    backgroundColor: Colors.white,
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tipsFilterContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tipsFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  tipsFilterTabActive: {
    backgroundColor: Colors.darkGreen,
  },
  tipsFilterEmoji: {
    fontSize: 14,
  },
  tipsFilterText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tipsFilterTextActive: {
    color: Colors.white,
  },
  tipsContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 10,
  },
  tipCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipEmojiBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.darkGreen + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipEmoji: {
    fontSize: 22,
  },
  tipCardInfo: {
    flex: 1,
    gap: 3,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
  },
  readBadge: {
    backgroundColor: Colors.lime + '30',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  readBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.darkGreen,
  },
  tipSummary: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  tipChevron: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tipContentBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  tipContent: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 21,
  },

  // ── Tip card expanded
  tipCardExpanded: {
    borderColor: Colors.darkGreen,
    borderWidth: 1.5,
  },

  // ── Vrai/Faux quiz
  vraiFauxBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vraiFauxQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 14,
  },
  vraiFauxBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  vraiFauxBtnVrai: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  vraiFauxBtnFaux: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  vraiFauxBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  vraiFauxResult: {
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  vraiFauxCorrect: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  vraiFauxWrong: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  vraiFauxResultIcon: {
    fontSize: 24,
    textAlign: 'center',
  },
  vraiFauxResultLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  vraiFauxExplanation: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },

  // ── Bouton vidéo
  videoBtn: {
    backgroundColor: '#FF0000',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  videoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  tipPointsHint: {
    fontSize: 12,
    color: Colors.orange,
    fontWeight: '700',
  },
});
