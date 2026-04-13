/**
 * purchases.ts — Gestion des achats In-App La Gamelle Fit
 *
 * Librairie : react-native-purchases (RevenueCat)
 * Installation : npx expo install react-native-purchases
 *
 * RevenueCat gère :
 * - L'essai gratuit 30 jours (configuré côté App Store Connect)
 * - La facturation automatique au 31ème jour (19,99€/mois)
 * - Les renouvellements, annulations, remboursements
 * - La synchronisation avec Supabase via webhook
 *
 * IDs à configurer dans App Store Connect + RevenueCat dashboard :
 * - Product ID : lgf_premium_monthly
 * - Offering ID : lgf_premium
 * - Trial : 30 jours gratuits
 * - Price : 19,99€/mois
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Configuration RevenueCat ──────────────────────────────────────────────────

const REVENUECAT_IOS_KEY = 'test_YmnZUrFHrGbYpGjyHpdRZSbeiDw';
const REVENUECAT_ANDROID_KEY = 'test_YmnZUrFHrGbYpGjyHpdRZSbeiDw'; // même clé en sandbox
const PRODUCT_ID = 'lgf_premium_monthly';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseResult {
  success: boolean;
  isPremium: boolean;
  trialStartDate?: Date;
  expiresDate?: Date;
  error?: string;
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * À appeler au démarrage de l'app (App.tsx) après l'authentification.
 * Configure RevenueCat avec l'ID utilisateur Supabase.
 */
export async function initPurchases(userId: string): Promise<void> {
  try {
    // Dans un vrai projet avec react-native-purchases installé :
    //
    // const Purchases = require('react-native-purchases').default;
    // await Purchases.configure({
    //   apiKey: Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY,
    //   appUserID: userId,
    // });
    //
    // Purchases.addCustomerInfoUpdateListener((info) => {
    //   updatePremiumStatusInSupabase(userId, info);
    // });

    console.log('RevenueCat initialized for user:', userId);
  } catch (e) {
    console.error('RevenueCat init error:', e);
  }
}

// ─── Vérifier le statut Premium ───────────────────────────────────────────────

/**
 * Vérifie si l'utilisateur est Premium (trial actif ou abonné payant).
 * Source de vérité : RevenueCat (pas Supabase seul).
 */
export async function checkPremiumStatus(userId: string): Promise<boolean> {
  try {
    // Avec react-native-purchases :
    //
    // const Purchases = require('react-native-purchases').default;
    // const info = await Purchases.getCustomerInfo();
    // const isPremium = info.entitlements.active['premium'] !== undefined;
    // return isPremium;

    // Fallback : vérifier Supabase
    const { data } = await supabase
      .from('profiles')
      .select('is_premium, premium_expires_at')
      .eq('id', userId)
      .single();

    if (!data) return false;
    if (!data.is_premium) return false;
    if (!data.premium_expires_at) return true;

    return new Date(data.premium_expires_at) > new Date();
  } catch {
    return false;
  }
}

// ─── Lancer l'achat (avec essai gratuit) ──────────────────────────────────────

/**
 * Lance le flow d'achat natif App Store / Google Play.
 * RevenueCat gère automatiquement l'essai 30 jours configuré dans App Store Connect.
 * La facturation commence au 31ème jour si l'utilisateur ne résilie pas.
 */
export async function purchasePremium(userId: string): Promise<PurchaseResult> {
  try {
    // Avec react-native-purchases :
    //
    // const Purchases = require('react-native-purchases').default;
    // const offerings = await Purchases.getOfferings();
    // const offering = offerings.all['default2'] ?? offerings.current;
    // const pkg = offering?.availablePackages[0];
    // if (!pkg) throw new Error('No package available');
    //
    // const { customerInfo } = await Purchases.purchasePackage(pkg);
    // const entitlement = customerInfo.entitlements.active['premium'];
    //
    // if (entitlement) {
    //   const expiresDate = new Date(entitlement.expirationDate!);
    //   const trialStart = new Date();
    //
    //   // Mettre à jour Supabase
    //   await supabase.from('profiles').update({
    //     is_premium: true,
    //     premium_since: trialStart.toISOString(),
    //     premium_trial_start: trialStart.toISOString(),
    //     premium_expires_at: expiresDate.toISOString(),
    //   }).eq('id', userId);
    //
    //   return {
    //     success: true,
    //     isPremium: true,
    //     trialStartDate: trialStart,
    //     expiresDate,
    //   };
    // }

    // ── Simulation pour le prototype ──────────────────────────────────────
    const trialStart = new Date();
    const expiresDate = new Date(trialStart);
    expiresDate.setDate(expiresDate.getDate() + 30); // 30 jours d'essai

    await supabase.from('profiles').update({
      is_premium: true,
      premium_since: trialStart.toISOString(),
      premium_trial_start: trialStart.toISOString(),
      premium_expires_at: expiresDate.toISOString(),
    }).eq('id', userId);

    return {
      success: true,
      isPremium: true,
      trialStartDate: trialStart,
      expiresDate,
    };
  } catch (e: any) {
    console.error('Purchase error:', e);
    return {
      success: false,
      isPremium: false,
      error: e.message || 'Erreur lors de l\'achat',
    };
  }
}

// ─── Restaurer les achats ──────────────────────────────────────────────────────

export async function restorePurchases(userId: string): Promise<boolean> {
  try {
    // Avec react-native-purchases :
    //
    // const Purchases = require('react-native-purchases').default;
    // const info = await Purchases.restorePurchases();
    // const isPremium = info.entitlements.active['premium'] !== undefined;
    //
    // if (isPremium) {
    //   await updatePremiumStatusInSupabase(userId, info);
    // }
    // return isPremium;

    return false;
  } catch {
    return false;
  }
}

// ─── Mettre à jour Supabase depuis RevenueCat ─────────────────────────────────

/**
 * Appelé par le listener RevenueCat ou le webhook backend.
 * Synchronise le statut premium dans Supabase.
 */
async function updatePremiumStatusInSupabase(
  userId: string,
  customerInfo: any,
): Promise<void> {
  const entitlement = customerInfo.entitlements.active['premium'];
  const isPremium = !!entitlement;

  await supabase.from('profiles').update({
    is_premium: isPremium,
    premium_expires_at: entitlement?.expirationDate ?? null,
  }).eq('id', userId);
}

// ─── Infos sur l'essai ────────────────────────────────────────────────────────

/**
 * Retourne les infos sur l'essai en cours.
 */
export function getTrialInfo(trialStartDate: Date): {
  daysUsed: number;
  daysLeft: number;
  isInTrial: boolean;
  willBeBilledOn: Date;
} {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUsed = Math.floor((now.getTime() - trialStartDate.getTime()) / msPerDay);
  const daysLeft = Math.max(0, 30 - daysUsed);
  const isInTrial = daysLeft > 0;

  const willBeBilledOn = new Date(trialStartDate);
  willBeBilledOn.setDate(willBeBilledOn.getDate() + 31); // J+31

  return { daysUsed, daysLeft, isInTrial, willBeBilledOn };
}

/**
 * Message à afficher à l'utilisateur selon son statut trial.
 */
export function getTrialMessage(trialStartDate: Date): string {
  const { daysLeft, willBeBilledOn } = getTrialInfo(trialStartDate);
  const billedStr = willBeBilledOn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  if (daysLeft > 10) return `✨ Essai gratuit — ${daysLeft} jours restants`;
  if (daysLeft > 3)  return `⏳ Plus que ${daysLeft} jours d'essai gratuit`;
  if (daysLeft > 0)  return `⚠️ Essai expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} — facturation le ${billedStr}`;
  return `👑 Abonnement actif`;
}
