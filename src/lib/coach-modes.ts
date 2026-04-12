// ─── MODES COACH ─────────────────────────────────────────────────────────────

export type CoachMode = 'soft' | 'sportif' | 'challenger' | 'warrior';

export interface CoachModeConfig {
  id: CoachMode;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  color: string;
  tolerance: number; // 0-100 (100 = très tolérant)
}

export const COACH_MODES: CoachModeConfig[] = [
  {
    id: 'soft',
    name: 'Soft',
    emoji: '🌱',
    tagline: 'Bienveillant & encourageant',
    description: 'Ton coach est là pour t\'accompagner en douceur. Il te félicite pour chaque progrès et ne te juge jamais.',
    color: '#22C55E',
    tolerance: 90,
  },
  {
    id: 'sportif',
    name: 'Sportif',
    emoji: '💪',
    tagline: 'Motivant & régulier',
    description: 'Sérieux mais bienveillant. Il cherche ta régularité et ta progression. Pas de place pour l\'approximation.',
    color: '#3B82F6',
    tolerance: 60,
  },
  {
    id: 'challenger',
    name: 'Challenger',
    emoji: '🔥',
    tagline: 'Exigeant & poussant',
    description: 'Il te pousse dans tes retranchements. Peu tolérant aux écarts, il attend l\'excellence à chaque session.',
    color: '#F59E0B',
    tolerance: 25,
  },
  {
    id: 'warrior',
    name: 'Warrior',
    emoji: '⚔️',
    tagline: 'Zéro tolérance · Punitions · Compèt',
    description: 'Pour les compétiteurs. Aucune excuse acceptée. Les écarts se paient cash — burpees, sprints, cardio.',
    color: '#EF4444',
    tolerance: 0,
  },
];

// ─── MESSAGES STOP CHEAT MEAL ──────────────────────────────────────────────────

export interface CheatMealResponse {
  intro: string;
  consequences: string[];
  rattrapage: string[];
  punishment?: string; // Warrior only
  closing: string;
}

export function getCheatMealResponse(
  mode: CoachMode,
  food: string,
  regime: string,
  dailyCalories: number,
): CheatMealResponse {
  const isSeche = regime === 'seche';
  const isMasse = regime === 'masse';

  const estimatedCals = 600; // calories estimées d'un écart typique
  const daysToRecover = Math.ceil(estimatedCals / (dailyCalories * 0.1));

  switch (mode) {
    case 'soft':
      return {
        intro: `Hey, je vois que tu hésites 😊 C'est humain d'avoir des envies !`,
        consequences: [
          `${food} représente environ ${estimatedCals} kcal — soit environ ${Math.round(estimatedCals / dailyCalories * 100)}% de ton objectif journalier.`,
          isSeche
            ? "En sèche, ça peut ralentir ta progression de quelques jours — mais ça ne détruit pas ton travail."
            : "En prise de masse, un écart ponctuel n'a presque aucun impact sur tes résultats.",
          "Un écart isolé n'a jamais ruiné des semaines d'efforts sérieux.",
        ],
        rattrapage: [
          "Si tu crèques, reviens simplement à ton plan demain — sans culpabilité.",
          "Tu peux réduire légèrement les glucides sur le prochain repas.",
          isSeche ? "30 min de cardio léger demain matin t'aidera à rééquilibrer." : "Continue ton plan normalement.",
        ],
        closing: "Tu fais du super travail. Une décision à la fois 💚",
      };

    case 'sportif':
      return {
        intro: `Stop. Avant de craquer, prends 5 secondes. 💪`,
        consequences: [
          `${food} = environ ${estimatedCals} kcal. C'est réel.`,
          isSeche
            ? `En sèche à ${dailyCalories} kcal/jour, cet écart représente ${Math.round(estimatedCals / dailyCalories * 100)}% de ton objectif — tu vas te bloquer pour ${daysToRecover} jour(s).`
            : `Ça va au-delà de ton objectif calorique. Sur une semaine, les petits écarts s'accumulent.`,
          "La régularité c'est 80% de tes résultats. Cet écart casse ton élan.",
        ],
        rattrapage: [
          isSeche
            ? `Demain : réduire les glucides de 50g et ajouter 20 min de cardio.`
            : "Ajuste le prochain repas pour compenser.",
          "Reprends exactement ton plan le lendemain. Pas de régime de punition.",
          "Hydrate-toi bien ce soir pour limiter la rétention.",
        ],
        closing: "Tu peux faire mieux. Tu le sais. 🔵",
      };

    case 'challenger':
      return {
        intro: `Tu es vraiment sur le point de faire ça ? Sérieusement ? 🔥`,
        consequences: [
          `${food} — environ ${estimatedCals} kcal que tu n'aurais pas dû consommer.`,
          isSeche
            ? `Tu viens de compromettre ${daysToRecover} jour(s) de déficit calorique. Ton objectif recule d'autant.`
            : `${estimatedCals} kcal en dehors du plan = muscle water retention, digestion lente, performance en berne demain.`,
          "Chaque écart dit à ton cerveau que tes objectifs ne sont pas vraiment importants.",
          "Les champions font des choix difficiles. Les autres font des excuses.",
        ],
        rattrapage: [
          "Demain matin : 30 min de HIIT à jeun. Sans négo.",
          isSeche ? "Journée à -200 kcal supplémentaires pendant 2 jours." : "Ton prochain repas = protéines + légumes uniquement.",
          "Note cet écart dans ton journal. Analyse pourquoi. Évite la prochaine fois.",
          "Recommence proprement dans la prochaine heure — repas protéiné.",
        ],
        closing: "Soit l'athlète que tu veux être. Maintenant. 🔥",
      };

    case 'warrior':
      return {
        intro: `NON. ⚔️ Tu n'as pas travaillé aussi dur pour ça.`,
        consequences: [
          `${food} = ${estimatedCals} kcal de trahison envers tes objectifs.`,
          isSeche
            ? `${daysToRecover} jour(s) de sèche partent à la poubelle. Ta composition corporelle en souffre directement.`
            : `Ton cortisol monte, ton anabolisme chute, ta récupération est compromise.`,
          "Les warriors ne cèdent pas. Les perdants trouvent des excuses.",
          "Chaque compromis aujourd'hui, c'est une défaite demain sur la scène ou le terrain.",
        ],
        rattrapage: [
          "MAINTENANT : 50 burpees. Pas demain. Maintenant.",
          "Demain matin : 45 min de cardio à jeun. Pas négociable.",
          isSeche ? "3 jours à -300 kcal pour récupérer le déficit perdu." : "Repas suivant : 0 glucides. Protéines + légumes uniquement.",
          "Reprends l'entraînement ce soir si tu peux. Tu dois mériter tes résultats.",
        ],
        punishment: "⚔️ PUNITION WARRIOR : 100 burpees + 50 jumping squats. Maintenant. Prouve que tu mérites tes objectifs.",
        closing: "Les warriors ne tombent pas. Ils se relèvent plus forts. ⚔️",
      };
  }
}

// ─── NOTIFICATIONS PAR MODE ────────────────────────────────────────────────────

export function getCoachMessage(mode: CoachMode, type: 'morning' | 'miss_meal' | 'well_done' | 'streak'): string {
  const messages = {
    soft: {
      morning: "Bonjour ! Belle journée devant toi 🌱 N'oublie pas ton petit-déj !",
      miss_meal: "Hé, tu as manqué un repas. Ce n'est pas grave — essaie de rattraper au prochain.",
      well_done: "Bravo ! Tu as atteint ton objectif du jour 🎉 Continue comme ça !",
      streak: "7 jours consécutifs ! Tu es fantastique 💚",
    },
    sportif: {
      morning: "C'est l'heure. Ton plan du jour t'attend. Lance-toi 💪",
      miss_meal: "Repas manqué détecté. Ajuste le prochain pour rester dans les clous.",
      well_done: "Objectif atteint. Bien joué. Même chose demain.",
      streak: "7 jours de régularité. C'est ça la différence entre les bons et les excellents.",
    },
    challenger: {
      morning: "Debout. Ton plan t'attend. Les excuses restent au lit, toi non. 🔥",
      miss_meal: "Repas manqué. Non acceptable. Rattrape-le MAINTENANT.",
      well_done: "Bien. Pas parfait, bien. Tu peux faire encore mieux demain.",
      streak: "7 jours. C'est un début. Les vrais athlètes font ça 365 jours.",
    },
    warrior: {
      morning: "⚔️ Lève-toi. Mange. Entraîne-toi. Répète. Pas de discussion.",
      miss_meal: "⚔️ REPAS MANQUÉ. Inacceptable. 30 burpees maintenant. Puis mange.",
      well_done: "⚔️ Objectif atteint. C'est le minimum. Reste concentré.",
      streak: "⚔️ 7 jours. Les faibles s'arrêtent ici. Les warriors continuent.",
    },
  };
  return messages[mode][type];
}
