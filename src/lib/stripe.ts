// ─── STRIPE INTEGRATION ─────────────────────────────────────────────────────
// En production : utiliser @stripe/stripe-react-native
// Pour le prototype : simulation avec Supabase Edge Functions

export const STRIPE_CONFIG = {
  publishableKey: 'pk_test_XXXXX', // À remplacer par ta vraie clé Stripe
  merchantId: 'merchant.com.lagamellefit', // Pour Apple Pay
  currency: 'eur',
  country: 'MQ', // Martinique
};

// Prix Stripe (à créer dans le dashboard Stripe)
export const STRIPE_PRICES = {
  premium_monthly: 'price_XXXXX', // 19,99€/mois
  wallet_10: 'price_XXXXX',       // Recharge 10€
  wallet_20: 'price_XXXXX',       // Recharge 20€
  wallet_50: 'price_XXXXX',       // Recharge 50€
  wallet_100: 'price_XXXXX',      // Recharge 100€
};

// Simulation paiement pour le prototype
export async function simulatePayment(
  amount: number,
  description: string,
): Promise<{ success: boolean; transactionId: string }> {
  // Simule un délai de traitement
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // 95% de succès en simulation
  const success = Math.random() > 0.05;
  
  return {
    success,
    transactionId: success ? `sim_${Date.now()}` : '',
  };
}

// En production : utiliser Stripe Payment Intent
// export async function createPaymentIntent(amount: number) {
//   const response = await fetch('https://ton-backend.com/create-payment-intent', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ amount: amount * 100, currency: 'eur' }),
//   });
//   return response.json();
// }
