import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface DailyQuizScreenProps {
  session: Session | null;
  onComplete: (points: number) => void;
}

interface QuizQuestion {
  id: number;
  category: string;
  emoji: string;
  question: string;
  options: string[];
  answer: number;
  fact: string;
}

type ScreenPhase = 'loading' | 'question' | 'result';

const POINTS_MAP: Record<number, number> = {
  5: 50,
  4: 35,
  3: 20,
  2: 10,
  1: 5,
  0: 5,
};

const SCORE_EMOJI: Record<number, string> = {
  5: '🏆',
  4: '🥇',
  3: '🥈',
  2: '💪',
  1: '📚',
  0: '📚',
};

// Calcule la difficulté selon les FIT Points et le mode coach
function getDifficulty(fitPoints: number, coachMode?: string): number {
  if (coachMode === 'warrior' || fitPoints >= 750) return 3;
  if (coachMode === 'challenger' || fitPoints >= 300) return 2;
  return 1;
}

export default function DailyQuizScreen({ session, onComplete }: DailyQuizScreenProps) {
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [difficultyLabel, setDifficultyLabel] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    try {
      // 1. Vérifier si le quiz a déjà été fait aujourd'hui
      if (session?.user) {
        const { data: done } = await supabase
          .rpc('has_done_quiz_today', { p_user_id: session.user.id });
        if (done === true) {
          onComplete(0); // Déjà fait aujourd'hui — skip
          return;
        }
      }

      // 2. Calculer la difficulté selon le profil
      let difficulty = 1;
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('coach_mode')
          .eq('id', session.user.id)
          .single();
        const { data: streak } = await supabase
          .from('quiz_streaks')
          .select('current_streak, best_streak')
          .eq('user_id', session.user.id)
          .single();
        const fitPoints = (streak?.current_streak ?? 0) * 10;
        difficulty = getDifficulty(fitPoints, profile?.coach_mode);
        setDifficultyLabel(
          difficulty === 3 ? '⚔️ Expert' :
          difficulty === 2 ? '🔥 Avancé' : '🌱 Débutant'
        );
      }

      // 3. Charger les questions selon la difficulté
      const { data, error } = await supabase
        .rpc('get_daily_quiz_questions', { p_difficulty: difficulty, n: 5 });

      if (error || !data || data.length === 0) {
        onComplete(0);
        return;
      }

      // Parse options if stored as JSON string
      const parsed: QuizQuestion[] = data.map((q: any) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      }));

      setQuestions(parsed);
      setPhase('question');
    } catch {
      onComplete(0);
    }
  }

  function handleOptionPress(optionIndex: number) {
    if (answered) return;
    setSelectedOption(optionIndex);
    setAnswered(true);
    if (optionIndex === questions[currentIndex].answer) {
      setScore((prev) => prev + 1);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setPhase('result');
    }
  }

  function handleSkip() {
    if (Platform.OS === 'web') {
      if (window.confirm('Passer le quiz du jour ? Tu perdras ton streak.')) {
        onComplete(0);
      }
    } else {
      Alert.alert(
        'Passer le quiz ?',
        'Tu perdras ton streak du jour.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Passer', onPress: () => onComplete(0) },
        ]
      );
    }
  }

  async function handleFinish() {
    const points = POINTS_MAP[score] ?? 5;
    // Enregistrer le quiz du jour dans Supabase
    if (session?.user) {
      try {
        await supabase.from('user_daily_quiz').upsert({
          user_id: session.user.id,
          quiz_date: new Date().toISOString().split('T')[0],
          score,
          points_earned: points,
          questions_ids: questions.map(q => q.id),
        }, { onConflict: 'user_id,quiz_date' });
      } catch (e) {
        console.log('Save quiz error:', e);
      }
    }
    onComplete(points);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const points = POINTS_MAP[score] ?? 5;
    const emoji = SCORE_EMOJI[score] ?? '📚';
    return (
      <View style={styles.fullScreen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quiz du jour 🧠</Text>
        </View>

        {/* Result content */}
        <ScrollView
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.resultEmoji}>{emoji}</Text>

          <Text style={styles.resultScore}>
            {score}/{questions.length}
          </Text>
          <Text style={styles.resultLabel}>
            {score === 5
              ? 'Parfait ! 5/5 🤯'
              : score === 4
              ? 'Excellent ! 4/5'
              : score === 3
              ? 'Très bien ! 3/5'
              : score === 2
              ? 'Pas mal ! 2/5'
              : score === 1
              ? 'Continue à apprendre !'
              : 'Allez, demain ça ira mieux !'}
          </Text>

          {/* Points badge */}
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>+{points} pts</Text>
          </View>

          {/* Streak */}
          <View style={styles.streakRow}>
            <Text style={styles.streakText}>🔥 12 jours</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
            <Text style={styles.primaryButtonText}>C'est parti ! →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Question ─────────────────────────────────────────────────────────────
  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <View style={styles.fullScreen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Quiz du jour 🧠</Text>
          {difficultyLabel ? (
            <Text style={styles.difficultyBadge}>{difficultyLabel}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Passer ›</Text>
        </TouchableOpacity>
      </View>

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {questions.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              idx < currentIndex && styles.dotDone,
              idx === currentIndex && styles.dotActive,
              idx > currentIndex && styles.dotPending,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.questionContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {current.emoji} {current.category}
          </Text>
        </View>

        {/* Question */}
        <Text style={styles.questionText}>{current.question}</Text>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {current.options.map((option, idx) => {
            const isCorrect = idx === current.answer;
            const isSelected = idx === selectedOption;

            let optionStyle = [styles.optionButton];
            let optionTextStyle = [styles.optionText];

            if (answered) {
              if (isCorrect) {
                optionStyle.push(styles.optionCorrect as any);
                optionTextStyle.push(styles.optionTextCorrect as any);
              } else if (isSelected && !isCorrect) {
                optionStyle.push(styles.optionWrong as any);
                optionTextStyle.push(styles.optionTextWrong as any);
              }
            }

            return (
              <TouchableOpacity
                key={idx}
                style={optionStyle}
                onPress={() => handleOptionPress(idx)}
                activeOpacity={answered ? 1 : 0.7}
              >
                <Text style={optionTextStyle}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fact */}
        {answered && (
          <View style={styles.factContainer}>
            <Text style={styles.factIcon}>💡</Text>
            <Text style={styles.factText}>{current.fact}</Text>
          </View>
        )}

        {/* Next button */}
        {answered && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>
              {isLast ? 'Résultat →' : 'Suivante →'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const DARK_GREEN = '#005240';
const LIME = '#A3E635';
const LIME_10 = 'rgba(163, 230, 53, 0.10)';
const ORANGE_10 = 'rgba(249, 115, 22, 0.10)';
const LIME_BORDER = '#A3E635';
const ORANGE_BORDER = '#F97316';

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    backgroundColor: DARK_GREEN,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  difficultyBadge: {
    fontSize: 11,
    color: Colors.lime,
    fontWeight: '700',
    marginTop: 2,
    opacity: 0.9,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },

  // Progress dots
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DARK_GREEN,
    paddingBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: LIME,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotDone: {
    backgroundColor: 'rgba(163,230,53,0.5)',
  },
  dotPending: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Question content
  questionContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Category badge
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  // Question
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 24,
  },

  // Options
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  optionCorrect: {
    backgroundColor: LIME_10,
    borderColor: LIME_BORDER,
  },
  optionTextCorrect: {
    color: '#166534',
    fontWeight: '600',
  },
  optionWrong: {
    backgroundColor: ORANGE_10,
    borderColor: ORANGE_BORDER,
  },
  optionTextWrong: {
    color: '#9A3412',
    fontWeight: '600',
  },

  // Fact
  factContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  factIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  // Primary button
  primaryButton: {
    backgroundColor: DARK_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Result
  resultContent: {
    padding: 24,
    paddingBottom: 60,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 72,
    marginTop: 32,
    marginBottom: 20,
    textAlign: 'center',
  },
  resultScore: {
    fontSize: 48,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 28,
  },
  pointsBadge: {
    backgroundColor: LIME,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 20,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#14532D',
  },
  streakRow: {
    backgroundColor: '#FFF7ED',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 36,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C2410C',
  },
});
