import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { getArenaFeed, createArenaPost, getChallenges, updateQuizStreak } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface ArenaScreenProps {
  session: Session | null;
}

type ArenaTab = 'quiz' | 'feed' | 'challenges';

// Static quiz questions (nutrition, sport, celebrities)
const STATIC_QUIZ: Array<{
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
}> = [
  {
    id: 'q1',
    question: 'Quelle protéine animale est la plus riche en leucine ?',
    options: ['Poulet', 'Œuf', 'Lait', 'Poisson'],
    correctIndex: 1,
    category: 'Nutrition',
  },
  {
    id: 'q2',
    question: 'Combien de grammes de protéines contient 100g de blanc de poulet ?',
    options: ['15g', '23g', '31g', '10g'],
    correctIndex: 2,
    category: 'Nutrition',
  },
  {
    id: 'q3',
    question: 'Quel exercice sollicite le plus les muscles de la chaîne postérieure ?',
    options: ['Squat', 'Soulevé de terre', 'Presse à cuisses', 'Fentes'],
    correctIndex: 1,
    category: 'Sport',
  },
  {
    id: 'q4',
    question: 'Quelle star de la Martinique est connue pour son alimentation ultra-disciplinée ?',
    options: ['Franky Vincent', 'Jocelyne Béroard', 'Jacob Desvarieux', 'Admiral T'],
    correctIndex: 2,
    category: 'Célébrités',
  },
  {
    id: 'q5',
    question: 'Combien de calories contient 1g de lipides ?',
    options: ['4 kcal', '7 kcal', '9 kcal', '12 kcal'],
    correctIndex: 2,
    category: 'Nutrition',
  },
];

const STATIC_CHALLENGES = [
  {
    id: 'c1',
    title: 'Cluny VS Ducos',
    description: 'Qui mangera le plus sain cette semaine ?',
    participants: 42,
    ends_at: '2025-07-20',
    emoji: '⚔️',
  },
  {
    id: 'c2',
    title: 'Challenge Protéines 30j',
    description: 'Atteins tes objectifs protéines 30 jours d\'affilée',
    participants: 128,
    ends_at: '2025-08-01',
    emoji: '💪',
  },
  {
    id: 'c3',
    title: 'Recettes Locales',
    description: 'Prépare 5 recettes martiniquaises cette semaine',
    participants: 67,
    ends_at: '2025-07-15',
    emoji: '🌴',
  },
];

export default function ArenaScreen({ session }: ArenaScreenProps) {
  const [activeTab, setActiveTab] = useState<ArenaTab>('quiz');

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Feed state
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [postLoading, setPostLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'feed') loadFeed();
  }, [activeTab]);

  async function loadFeed() {
    setFeedLoading(true);
    const { posts: data } = await getArenaFeed();
    setPosts(data ?? []);
    setFeedLoading(false);
    setRefreshing(false);
  }

  function handleAnswer(idx: number) {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    setShowResult(true);
    const correct = idx === STATIC_QUIZ[quizIndex].correctIndex;
    if (correct) setQuizScore((s) => s + 1);
    if (session?.user) {
      updateQuizStreak(session.user.id, correct);
    }
  }

  function nextQuestion() {
    if (quizIndex + 1 >= STATIC_QUIZ.length) {
      setQuizFinished(true);
    } else {
      setQuizIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  }

  function restartQuiz() {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
    setShowResult(false);
  }

  async function submitPost() {
    if (!newPost.trim() || !session?.user) return;
    setPostLoading(true);
    const { error } = await createArenaPost(session.user.id, newPost.trim());
    if (!error) {
      setNewPost('');
      await loadFeed();
    } else {
      Alert.alert('Erreur', 'Impossible de publier.');
    }
    setPostLoading(false);
  }

  const currentQ = STATIC_QUIZ[quizIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Arena ⚔️</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'quiz', label: '🧠 Quiz' },
          { key: 'feed', label: '📣 Feed' },
          { key: 'challenges', label: '⚔️ Défis' },
        ].map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key as ArenaTab)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quiz tab */}
      {activeTab === 'quiz' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.quizContent}>
          {quizFinished ? (
            <View style={styles.quizResult}>
              <Text style={styles.resultEmoji}>
                {quizScore >= 4 ? '🏆' : quizScore >= 2 ? '💪' : '📚'}
              </Text>
              <Text style={styles.resultTitle}>Quiz terminé !</Text>
              <Text style={styles.resultScore}>
                {quizScore} / {STATIC_QUIZ.length} bonnes réponses
              </Text>
              <Text style={styles.resultMessage}>
                {quizScore >= 4
                  ? 'Excellent ! Tu es un expert nutrition !'
                  : quizScore >= 2
                  ? 'Bien joué ! Continue à apprendre.'
                  : 'Continue à te former, tu vas t\'améliorer !'}
              </Text>
              <TouchableOpacity style={styles.restartButton} onPress={restartQuiz}>
                <Text style={styles.restartButtonText}>Recommencer le quiz</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* Progress */}
              <View style={styles.quizProgress}>
                <Text style={styles.quizProgressText}>
                  Question {quizIndex + 1} / {STATIC_QUIZ.length}
                </Text>
                <View style={styles.quizProgressBar}>
                  <View
                    style={[
                      styles.quizProgressFill,
                      { width: `${((quizIndex + 1) / STATIC_QUIZ.length) * 100}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Category badge */}
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{currentQ.category}</Text>
              </View>

              {/* Question */}
              <Text style={styles.questionText}>{currentQ.question}</Text>

              {/* Options */}
              {currentQ.options.map((opt, i) => {
                let optStyle = styles.optionButton;
                let textStyle = styles.optionText;

                if (showResult) {
                  if (i === currentQ.correctIndex) {
                    optStyle = { ...styles.optionButton, ...styles.optionCorrect };
                    textStyle = { ...styles.optionText, ...styles.optionTextCorrect };
                  } else if (i === selectedAnswer && selectedAnswer !== currentQ.correctIndex) {
                    optStyle = { ...styles.optionButton, ...styles.optionWrong };
                    textStyle = { ...styles.optionText, ...styles.optionTextWrong };
                  }
                }

                return (
                  <TouchableOpacity
                    key={i}
                    style={optStyle}
                    onPress={() => handleAnswer(i)}
                    disabled={showResult}
                  >
                    <Text style={styles.optionLetter}>
                      {String.fromCharCode(65 + i)}.
                    </Text>
                    <Text style={textStyle}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}

              {showResult && (
                <View style={styles.explanationRow}>
                  <Text style={styles.explanationText}>
                    {selectedAnswer === currentQ.correctIndex
                      ? '✅ Bonne réponse !'
                      : `❌ La bonne réponse était : ${currentQ.options[currentQ.correctIndex]}`}
                  </Text>
                  <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
                    <Text style={styles.nextButtonText}>
                      {quizIndex + 1 >= STATIC_QUIZ.length ? 'Voir le résultat' : 'Question suivante →'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <View style={styles.feedContainer}>
          {/* Post composer */}
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              value={newPost}
              onChangeText={setNewPost}
              placeholder="Partage tes résultats, progrès ou recettes... 💪"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={280}
            />
            <TouchableOpacity
              style={[styles.postButton, !newPost.trim() && styles.postButtonDisabled]}
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

          {feedLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.darkGreen} />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.feedList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); loadFeed(); }}
                  tintColor={Colors.darkGreen}
                />
              }
              renderItem={({ item }) => (
                <View style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.profiles?.first_name?.[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.postAuthor}>
                        {item.profiles?.first_name ?? 'Anonyme'}
                      </Text>
                      <View style={styles.postMeta}>
                        {item.profiles?.regime && (
                          <Text style={styles.postRegime}>
                            {item.profiles.regime === 'masse'
                              ? '💪 Masse'
                              : item.profiles.regime === 'seche'
                              ? '🔥 Sèche'
                              : '⚖️ Équilibré'}
                          </Text>
                        )}
                        {item.profiles?.fitness_park && (
                          <Text style={styles.postPark}>
                            📍 {item.profiles.fitness_park}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.postContent}>{item.content}</Text>
                  <Text style={styles.postTime}>
                    {new Date(item.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyFeed}>
                  <Text style={styles.emptyFeedEmoji}>📣</Text>
                  <Text style={styles.emptyFeedText}>Aucun post pour l'instant</Text>
                  <Text style={styles.emptyFeedSub}>Sois le premier à partager !</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Challenges tab */}
      {activeTab === 'challenges' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.challengesContent}>
          <Text style={styles.challengesTitle}>Défis en cours 🏆</Text>
          {STATIC_CHALLENGES.map((c) => (
            <View key={c.id} style={styles.challengeCard}>
              <Text style={styles.challengeEmoji}>{c.emoji}</Text>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{c.title}</Text>
                <Text style={styles.challengeDesc}>{c.description}</Text>
                <View style={styles.challengeMeta}>
                  <Text style={styles.challengeParticipants}>
                    👥 {c.participants} participants
                  </Text>
                  <Text style={styles.challengeEnds}>
                    Fin : {new Date(c.ends_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.joinButton}
                onPress={() =>
                  Alert.alert('Défi rejoint !', `Tu as rejoint "${c.title}". Bonne chance !`)
                }
              >
                <Text style={styles.joinButtonText}>Rejoindre</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  tabActive: {
    backgroundColor: Colors.darkGreen,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  quizContent: {
    padding: 20,
  },
  quizProgress: {
    marginBottom: 20,
    gap: 8,
  },
  quizProgressText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  quizProgressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  quizProgressFill: {
    height: '100%',
    backgroundColor: Colors.lime,
    borderRadius: 2,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.darkGreen + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 12,
  },
  optionCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '15',
  },
  optionWrong: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '15',
  },
  optionLetter: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMuted,
    width: 20,
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
  },
  explanationRow: {
    marginTop: 8,
    gap: 12,
  },
  explanationText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  quizResult: {
    alignItems: 'center',
    paddingTop: 20,
    gap: 12,
  },
  resultEmoji: {
    fontSize: 64,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  resultScore: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.darkGreen,
  },
  resultMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  restartButton: {
    marginTop: 12,
    backgroundColor: Colors.lime,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  restartButtonText: {
    color: Colors.darkGreen,
    fontSize: 16,
    fontWeight: '800',
  },
  feedContainer: {
    flex: 1,
  },
  composer: {
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  composerInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  feedList: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  postCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  postMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  postRegime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  postPark: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  postContent: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  postTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyFeed: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyFeedEmoji: {
    fontSize: 48,
  },
  emptyFeedText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyFeedSub: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  challengesContent: {
    padding: 20,
    gap: 12,
  },
  challengesTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  challengeCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  challengeEmoji: {
    fontSize: 32,
    width: 44,
    textAlign: 'center',
  },
  challengeInfo: {
    flex: 1,
    gap: 4,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  challengeDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  challengeMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  challengeParticipants: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  challengeEnds: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  joinButton: {
    backgroundColor: Colors.lime,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinButtonText: {
    color: Colors.darkGreen,
    fontSize: 13,
    fontWeight: '800',
  },
});
