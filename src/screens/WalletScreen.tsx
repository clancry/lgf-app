import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { getProfile, getTransactions, supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface WalletScreenProps {
  session: Session | null;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  payment_method?: string;
  description?: string;
  created_at: string;
}

const RECHARGE_AMOUNTS = [10, 20, 50, 100];

const TRANSACTION_ICONS: Record<string, string> = {
  recharge: '💳',
  achat: '🛒',
  premium: '⭐',
  default: '💰',
};

export default function WalletScreen({ session }: WalletScreenProps) {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    try {
      const [{ profile }, { transactions: txns }] = await Promise.all([
        getProfile(session.user.id),
        getTransactions(session.user.id),
      ]);
      setBalance(profile?.wallet_balance ?? 0);
      setTransactions(txns ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function handleRecharge(amount: number) {
    if (!session?.user) return;
    // Recharge simulée — fonctionnalité paiement à venir
    showAlert('Fonctionnalité disponible prochainement', `La recharge de ${amount}€ sera bientôt disponible.`);
  }

  function formatAmount(amount: number, type: string): string {
    if (type === 'recharge') return `+${amount}€`;
    return `-${amount}€`;
  }

  function isPositive(type: string): boolean {
    return type === 'recharge';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.darkGreen} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.white}
          />
        }
        ListHeaderComponent={
          <>
            {/* Balance card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Solde Wallet</Text>
              <Text style={styles.balanceAmount}>{balance.toFixed(2)}€</Text>
              <Text style={styles.balanceSubtext}>
                Utilisable pour tes achats et abonnements
              </Text>
            </View>

            {/* Recharge section */}
            <View style={styles.rechargeSection}>
              <Text style={styles.sectionTitle}>Recharger</Text>
              <View style={styles.rechargeGrid}>
                {RECHARGE_AMOUNTS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.rechargeButton,
                      rechargeLoading === amount && styles.rechargeButtonLoading,
                    ]}
                    onPress={() => handleRecharge(amount)}
                    disabled={rechargeLoading !== null}
                    activeOpacity={0.75}
                  >
                    {rechargeLoading === amount ? (
                      <ActivityIndicator size="small" color={Colors.darkGreen} />
                    ) : (
                      <>
                        <Text style={styles.rechargeAmount}>{amount}€</Text>
                        <Text style={styles.rechargeLabel}>Recharger</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payment methods hint */}
            <TouchableOpacity style={styles.paymentMethodsRow}>
              <Text style={styles.paymentMethodsText}>💳  Gérer mes moyens de paiement</Text>
              <Text style={styles.paymentMethodsArrow}>›</Text>
            </TouchableOpacity>

            {/* Transactions header */}
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Historique</Text>
              {transactions.length > 0 && (
                <Text style={styles.transactionCount}>
                  {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.transactionCard}>
            <View style={styles.transactionIcon}>
              <Text style={styles.transactionIconText}>
                {TRANSACTION_ICONS[item.type] ?? TRANSACTION_ICONS.default}
              </Text>
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>
                {item.description ?? item.type ?? 'Transaction'}
              </Text>
              <Text style={styles.transactionDate}>{formatDate(item.created_at)}</Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                isPositive(item.type)
                  ? styles.transactionAmountPositive
                  : styles.transactionAmountNegative,
              ]}
            >
              {formatAmount(item.amount, item.type)}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>Aucune transaction</Text>
            <Text style={styles.emptySubtext}>
              Tes rechargements et achats apparaîtront ici
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.darkGreen,
  },
  balanceCard: {
    backgroundColor: Colors.darkGreen,
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.7,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 52,
    fontWeight: '900',
    color: Colors.lime,
    letterSpacing: -1,
  },
  balanceSubtext: {
    fontSize: 13,
    color: Colors.white,
    opacity: 0.6,
    textAlign: 'center',
  },
  rechargeSection: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  rechargeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  rechargeButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 4,
  },
  rechargeButtonLoading: {
    opacity: 0.6,
  },
  rechargeAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.darkGreen,
  },
  rechargeLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentMethodsText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  paymentMethodsArrow: {
    fontSize: 20,
    color: Colors.textMuted,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  transactionCount: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionIconText: {
    fontSize: 20,
  },
  transactionInfo: {
    flex: 1,
    gap: 3,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  statusCompleted: {
    backgroundColor: Colors.success + '20',
  },
  statusPending: {
    backgroundColor: Colors.warning + '20',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextCompleted: {
    color: Colors.success,
  },
  statusTextPending: {
    color: Colors.warning,
  },
  transactionAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  transactionAmountPositive: {
    color: Colors.success,
  },
  transactionAmountNegative: {
    color: Colors.error,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
