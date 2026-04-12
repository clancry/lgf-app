import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface WalletScreenProps { session: Session | null; }
interface Transaction { id: number; amount: number; description: string; type: string; created_at: string; }

const SUPABASE_URL = 'https://dprhjwrsvixkmpwsxpuk.supabase.co';
const STRIPE_PK   = 'pk_test_51TLWgZKbvrpGq3RvLlT5Qsd9bE3NT7NY7yFmDXsKm14CCBzsWnS7vrjUeGm7jMvzYBrMh5rteFyU5iRAVzhHPBgf00Mg53Et34';

function showAlert(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
  else Alert.alert(title, msg);
}

export default function WalletScreen({ session }: WalletScreenProps) {
  const [balance, setBalance]       = useState<number>(0);
  const [loading, setLoading]       = useState(true);
  const [transactions, setTx]       = useState<Transaction[]>([]);
  const [recharging, setRecharging] = useState(false);
  const [customAmt, setCustomAmt]   = useState('');
  const [tab, setTab]               = useState<'wallet' | 'history'>('wallet');

  useEffect(() => { if (session?.user) { loadBalance(); loadTransactions(); } }, [session]);

  async function loadBalance() {
    const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', session!.user.id).single();
    if (data) setBalance(data.wallet_balance || 0);
    setLoading(false);
  }

  async function loadTransactions() {
    const { data } = await supabase.from('transactions').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false }).limit(30);
    setTx(data || []);
  }

  async function handleRecharge(amount: number) {
    if (!session?.user) return;
    setRecharging(true);
    try {
      // 1. Appel Edge Function pour créer le Payment Intent
      const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/stripe-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'create_payment_intent', amount, userId: session.user.id }),
      });
      const { clientSecret, error: fnError } = await fnRes.json();

      if (fnError || !clientSecret) throw new Error(fnError || 'Erreur de paiement');

      // 2. En mode test : simuler le paiement réussi
      // En production : utiliser @stripe/stripe-react-native pour présenter le payment sheet
      // Pour le prototype on simule directement le crédit
      await creditWallet(amount, 'Recharge wallet');
      showAlert('✓ Recharge effectuée', `${amount}€ ont été ajoutés à ton wallet.`);

    } catch (e: any) {
      showAlert('Erreur', e.message || 'Une erreur est survenue');
    }
    setRecharging(false);
  }

  async function creditWallet(amount: number, description: string) {
    const userId = session!.user.id;
    // Mettre à jour le solde
    const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single();
    const newBalance = (profile?.wallet_balance || 0) + amount;
    await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId);
    // Enregistrer la transaction
    await supabase.from('transactions').insert({
      user_id: userId, amount, description, type: 'recharge', payment_method: 'card',
    });
    setBalance(newBalance);
    await loadTransactions();
  }

  const quickAmounts = [10, 20, 50, 100];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.darkGreen} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💳 Mon Wallet</Text>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'wallet' && styles.tabActive]} onPress={() => setTab('wallet')}>
            <Text style={[styles.tabText, tab === 'wallet' && styles.tabTextActive]}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Historique</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {tab === 'wallet' ? (
          <>
            {/* Solde */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Solde disponible</Text>
              <Text style={styles.balanceAmount}>{balance.toFixed(2)}€</Text>
              <Text style={styles.balanceSub}>Utilisable dans tous les frigos La Gamelle Fit</Text>
            </View>

            {/* Recharge rapide */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recharger mon wallet</Text>
              <View style={styles.quickGrid}>
                {quickAmounts.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.quickBtn}
                    onPress={() => handleRecharge(amt)}
                    disabled={recharging}
                  >
                    <Text style={styles.quickBtnText}>{amt}€</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Montant personnalisé */}
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customAmt}
                  onChangeText={setCustomAmt}
                  placeholder="Autre montant (€)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.customBtn, (!customAmt || recharging) && { opacity: 0.5 }]}
                  onPress={() => { const a = parseFloat(customAmt); if (a > 0) { handleRecharge(a); setCustomAmt(''); } }}
                  disabled={!customAmt || recharging}
                >
                  {recharging ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.customBtnText}>⚡</Text>}
                </TouchableOpacity>
              </View>

              {/* Apple Pay / Google Pay */}
              <View style={styles.payRow}>
                <TouchableOpacity
                  style={styles.applePayBtn}
                  onPress={() => handleRecharge(20)}
                  disabled={recharging}
                >
                  <Text style={styles.applePayText}> Apple Pay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.googlePayBtn}
                  onPress={() => handleRecharge(20)}
                  disabled={recharging}
                >
                  <Text style={styles.googlePayText}>G  Google Pay</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Info sécurité */}
            <View style={styles.securityCard}>
              <Text style={styles.securityText}>🔒 Paiements sécurisés par Stripe — SSL 256 bits · PCI DSS</Text>
            </View>
          </>
        ) : (
          /* Historique */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dernières transactions</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>Aucune transaction pour le moment</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: tx.amount > 0 ? Colors.lime + '20' : Colors.orange + '20' }]}>
                    <Text>{tx.amount > 0 ? '⬆️' : '⬇️'}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.amount > 0 ? Colors.darkGreen : Colors.orange }]}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}€
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.darkGreen },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.darkGreen },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  balanceCard: { backgroundColor: Colors.darkGreen, borderRadius: 20, padding: 28, alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginBottom: 8 },
  balanceAmount: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  balanceSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 8, textAlign: 'center' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.darkGreen + '30' },
  quickBtnText: { fontSize: 16, fontWeight: '800', color: Colors.darkGreen },
  customRow: { flexDirection: 'row', gap: 10 },
  customInput: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1.5, borderColor: '#E8E8E8', color: Colors.textPrimary },
  customBtn: { backgroundColor: Colors.darkGreen, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  customBtnText: { fontSize: 20 },
  payRow: { flexDirection: 'row', gap: 10 },
  applePayBtn: { flex: 1, backgroundColor: '#000', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applePayText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  googlePayBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#E8E8E8' },
  googlePayText: { color: '#333', fontWeight: '700', fontSize: 15 },
  securityCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.lime + '30' },
  securityText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  txDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
});
