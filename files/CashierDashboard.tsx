'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { useCartStore } from '../../store/cartStore';
import { COLORS, SPACING } from '../../constants';
import { format } from 'date-fns';

export default function CashierDashboard() {
  const nav = useNavigation<any>();
  const { user, signOut } = useAuthStore();
  const { currentShift, isLoading, fetchCurrentShift, subscribeToShiftUpdates } = useShiftStore();
  const { restoreCart } = useCartStore();

  // FIX: Track whether we've already navigated to prevent re-trigger on back
  const hasNavigated = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) fetchCurrentShift(user.id);
    restoreCart();
  }, [user]);

  useEffect(() => {
    if (currentShift?.id) {
      const unsub = subscribeToShiftUpdates(currentShift.id);
      return unsub;
    }
  }, [currentShift?.id]);

  // FIX: Only auto-navigate once when status first becomes 'open'
  // Reset the flag when we return to this screen
  useEffect(() => {
    const unsubFocus = nav.addListener('focus', () => {
      hasNavigated.current = false;
    });
    return unsubFocus;
  }, [nav]);

  useEffect(() => {
    if (currentShift?.status === 'open' && !hasNavigated.current) {
      hasNavigated.current = true;
      nav.navigate('CashierTabs');
    }
  }, [currentShift?.status]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (user) await fetchCurrentShift(user.id);
    setRefreshing(false);
  }, [user]);

  const status = currentShift?.status ?? 'no_shift';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Status Badge */}
      <View style={styles.statusCard}>
        <View style={[
          styles.badge,
          status === 'open' && styles.badgeOpen,
          (status === 'pending_open' || status === 'pending_close') && styles.badgePending,
          status === 'rejected' && styles.badgeRejected,
        ]}>
          <Text style={styles.badgeText}>
            {status === 'no_shift' ? 'No Active Shift'
              : status === 'pending_open' ? '⏳ Awaiting Approval'
              : status === 'open' ? '✓ Shift Open'
              : status === 'pending_close' ? '⏳ Closing Approval'
              : status === 'rejected' ? '✗ Rejected'
              : status}
          </Text>
        </View>
      </View>

      {/* Loading */}
      {isLoading && !refreshing && (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      )}

      {/* No shift */}
      {!isLoading && status === 'no_shift' && (
        <View style={styles.actionArea}>
          <Text style={styles.actionHint}>Ready to start your day?</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => nav.navigate('OpenShift')}
            activeOpacity={0.8}
          >
            <Text style={styles.startBtnText}>Start Your Shift</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pending open */}
      {!isLoading && status === 'pending_open' && (
        <View style={styles.waitingCard}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.waitingText}>Waiting for Manager Approval</Text>
          <Text style={styles.waitingSubText}>
            Opening cash: KSh {currentShift?.opening_cash?.toLocaleString()}
          </Text>
          <Text style={styles.pullHint}>↓ Pull down to check status</Text>
        </View>
      )}

      {/* Pending close */}
      {!isLoading && status === 'pending_close' && (
        <View style={styles.waitingCard}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.waitingText}>Waiting for Closure Approval</Text>
          <Text style={styles.pullHint}>↓ Pull down to check status</Text>
        </View>
      )}

      {/* Rejected */}
      {!isLoading && status === 'rejected' && (
        <View style={styles.rejectedCard}>
          <Text style={styles.rejectedTitle}>Shift Rejected</Text>
          <Text style={styles.rejectedNotes}>
            {currentShift?.rejection_notes || 'No reason provided. Contact your manager.'}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => nav.navigate('OpenShift')}
            activeOpacity={0.8}
          >
            <Text style={styles.startBtnText}>Resubmit Shift</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 40, flexGrow: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.xxl,
  },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  date: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  signOutBtn: { padding: 8 },
  signOutText: { fontSize: 14, color: COLORS.error, fontWeight: '600' },
  statusCard: { alignItems: 'center', marginBottom: SPACING.xxl },
  badge: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  badgeOpen: { backgroundColor: COLORS.successLight },
  badgePending: { backgroundColor: COLORS.warningLight },
  badgeRejected: { backgroundColor: COLORS.errorLight },
  badgeText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  actionArea: { alignItems: 'center', marginTop: 20 },
  actionHint: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 20 },
  startBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 20,
    paddingHorizontal: 40, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  startBtnText: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  waitingCard: { alignItems: 'center', marginTop: 40, gap: 16 },
  waitingText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  waitingSubText: { fontSize: 14, color: COLORS.textSecondary },
  pullHint: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  rejectedCard: { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 20 },
  rejectedTitle: { fontSize: 18, fontWeight: '700', color: COLORS.error },
  rejectedNotes: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
});
