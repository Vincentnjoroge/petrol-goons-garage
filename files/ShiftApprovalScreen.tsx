import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet,
  Alert, ActivityIndicator, Switch, ScrollView,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { COLORS, SPACING, CURRENCY_SYMBOL } from '../../constants';
import { format } from 'date-fns';

export default function ShiftApprovalScreen() {
  const { user } = useAuthStore();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [ackDiscrepancies, setAckDiscrepancies] = useState(false);
  const [stockCounts, setStockCounts] = useState<any[]>([]);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadShifts(); }, []);

  const loadShifts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shifts')
      .select('*, cashier:users!cashier_id(full_name)')
      .in('status', ['pending_open', 'pending_close'])
      .order('created_at', { ascending: false });
    setShifts(data || []);
    setLoading(false);
  };

  const loadDetails = async (shift: any) => {
    const type = shift.status === 'pending_open' ? 'opening' : 'closing';
    const [countsRes, salesRes] = await Promise.all([
      supabase
        .from('shift_stock_counts')
        .select('*, product:products!product_id(name)')
        .eq('shift_id', shift.id)
        .eq('count_type', type),
      shift.status === 'pending_close'
        ? supabase
            .from('sales')
            .select('total_amount, payment_method')
            .eq('shift_id', shift.id)
            .eq('status', 'completed')
        : Promise.resolve({ data: null }),
    ]);

    setStockCounts(countsRes.data || []);

    if (salesRes.data) {
      const sales = salesRes.data;
      const total = sales.reduce((s: number, r: any) => s + Number(r.total_amount), 0);
      const cash = sales.filter((s: any) => s.payment_method === 'cash')
        .reduce((s: number, r: any) => s + Number(r.total_amount), 0);
      setSalesSummary({
        count: sales.length, total, cash, mpesa: total - cash,
      });
    } else {
      setSalesSummary(null);
    }
  };

  const toggleExpand = async (shift: any) => {
    if (expanded === shift.id) { setExpanded(null); return; }
    setExpanded(shift.id);
    setRejectReason('');
    setAckDiscrepancies(false);
    await loadDetails(shift);
  };

  const approveOpen = async (shift: any) => {
    setProcessing(true);
    try {
      await supabase.from('shifts').update({
        status: 'open',
        approved_by: user!.id,
        opened_at: new Date().toISOString(),
      }).eq('id', shift.id);
      await supabase.from('audit_log').insert({
        user_id: user!.id, action: 'shift_open_approved',
        entity_type: 'shift', entity_id: shift.id,
      });
      loadShifts();
      setExpanded(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setProcessing(false);
  };

  const approveClose = async (shift: any) => {
    // FIX: null-safe discrepancy check
    const cashDisc = Number(shift.cash_discrepancy || 0);
    const stockDisc = stockCounts.some((c: any) => c.difference !== 0);
    const hasDisc = cashDisc !== 0 || stockDisc;

    if (hasDisc && !ackDiscrepancies) {
      Alert.alert('Discrepancies Found', 'Please acknowledge all discrepancies before approving.');
      return;
    }
    setProcessing(true);
    try {
      await supabase.from('shifts').update({
        status: 'closed',
        close_approved_by: user!.id,
        closed_at: new Date().toISOString(),
      }).eq('id', shift.id);
      await supabase.from('audit_log').insert({
        user_id: user!.id, action: 'shift_close_approved',
        entity_type: 'shift', entity_id: shift.id,
      });
      loadShifts();
      setExpanded(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setProcessing(false);
  };

  const rejectShift = async (shift: any) => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejection.');
      return;
    }
    setProcessing(true);
    try {
      await supabase.from('shifts').update({
        status: 'rejected',
        rejection_notes: rejectReason.trim(),
      }).eq('id', shift.id);
      loadShifts();
      setExpanded(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setProcessing(false);
  };

  const renderShift = ({ item }: { item: any }) => {
    const isOpen = item.status === 'pending_open';
    const isExpanded = expanded === item.id;
    // FIX: null-safe check
    const cashDisc = Number(item.cash_discrepancy || 0);
    const hasDisc = cashDisc !== 0;

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item)}>
          <View style={styles.cardLeft}>
            <Text style={styles.cashierName}>{item.cashier?.full_name}</Text>
            <Text style={styles.cardTime}>{format(new Date(item.created_at), 'MMM d, HH:mm')}</Text>
          </View>
          <View style={styles.right}>
            <View style={[styles.typeBadge, isOpen ? styles.openBadge : styles.closeBadge]}>
              <Text style={styles.typeBadgeText}>{isOpen ? 'Open Request' : 'Close Request'}</Text>
            </View>
            <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <ScrollView
            style={styles.expandedContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {/* Opening cash */}
            {isOpen && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Opening Cash</Text>
                <Text style={styles.detailValue}>{CURRENCY_SYMBOL} {Number(item.opening_cash).toLocaleString()}</Text>
              </View>
            )}

            {/* Closing summary */}
            {!isOpen && salesSummary && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Shift Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Sales</Text>
                  <Text style={styles.summaryValue}>{salesSummary.count}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Revenue</Text>
                  <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {salesSummary.total.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cash</Text>
                  <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {salesSummary.cash.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>M-Pesa</Text>
                  <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {salesSummary.mpesa.toLocaleString()}</Text>
                </View>
              </View>
            )}

            {/* Cash discrepancy */}
            {!isOpen && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expected Cash</Text>
                  <Text style={styles.detailValue}>{CURRENCY_SYMBOL} {Number(item.expected_cash || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cashier Counted</Text>
                  <Text style={styles.detailValue}>{CURRENCY_SYMBOL} {Number(item.closing_cash || 0).toLocaleString()}</Text>
                </View>
                {hasDisc && (
                  <View style={[styles.detailRow, styles.discRow]}>
                    <Text style={styles.discLabel}>Cash Discrepancy</Text>
                    <Text style={styles.discValue}>
                      {cashDisc > 0 ? '+' : ''}{CURRENCY_SYMBOL} {cashDisc.toLocaleString()}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Stock counts */}
            {stockCounts.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Stock Counts</Text>
                {stockCounts.map(sc => (
                  <View
                    key={sc.id}
                    style={[styles.stockRow, sc.difference !== 0 && styles.stockRowDisc]}
                  >
                    <Text style={styles.stockName} numberOfLines={1}>{sc.product?.name}</Text>
                    <Text style={styles.stockNum}>Sys: {sc.system_quantity}</Text>
                    <Text style={styles.stockNum}>Count: {sc.counted_quantity}</Text>
                    {sc.difference !== 0 && (
                      <Text style={styles.stockDiff}>
                        {sc.difference > 0 ? '+' : ''}{sc.difference}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Acknowledge discrepancies */}
            {!isOpen && (hasDisc || stockCounts.some((c: any) => c.difference !== 0)) && (
              <View style={styles.ackRow}>
                <Switch
                  value={ackDiscrepancies}
                  onValueChange={setAckDiscrepancies}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                />
                <Text style={styles.ackText}>I acknowledge the discrepancies above</Text>
              </View>
            )}

            {/* Rejection reason */}
            <TextInput
              style={styles.notesInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Rejection reason (required to reject)"
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => rejectShift(item)}
                disabled={processing}
              >
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.approveBtn, processing && { opacity: 0.5 }]}
                onPress={() => isOpen ? approveOpen(item) : approveClose(item)}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.approveBtnText}>✓ Approve</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <FlatList
      style={styles.container}
      data={shifts}
      keyExtractor={s => s.id}
      renderItem={renderShift}
      contentContainerStyle={{ padding: SPACING.lg }}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyText}>No pending approvals</Text>
          <Text style={styles.emptySubText}>All shifts are up to date</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, color: COLORS.text, fontWeight: '600' },
  emptySubText: { fontSize: 14, color: COLORS.textSecondary },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    marginBottom: 12, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  cardLeft: { flex: 1 },
  cashierName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  cardTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  openBadge: { backgroundColor: COLORS.infoLight },
  closeBadge: { backgroundColor: COLORS.warningLight },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  chevron: { fontSize: 12, color: COLORS.textSecondary, width: 16, textAlign: 'center' },
  expandedContent: {
    paddingHorizontal: 16, paddingBottom: 16, maxHeight: 500,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  summaryBox: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginVertical: 10,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  discRow: { backgroundColor: COLORS.discrepancyBg, borderRadius: 8, paddingHorizontal: 10, borderBottomWidth: 0, marginVertical: 4 },
  discLabel: { fontSize: 13, fontWeight: '600', color: COLORS.error },
  discValue: { fontSize: 16, fontWeight: '700', color: COLORS.error },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  stockRowDisc: { backgroundColor: COLORS.discrepancyBg, borderRadius: 6, paddingHorizontal: 6 },
  stockName: { flex: 1, fontSize: 12, color: COLORS.text },
  stockNum: { fontSize: 12, color: COLORS.textSecondary, width: 65, textAlign: 'right' },
  stockDiff: { fontSize: 12, fontWeight: '700', color: COLORS.error, width: 36, textAlign: 'right' },
  ackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12, backgroundColor: COLORS.warningLight, borderRadius: 10,
  },
  ackText: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },
  notesInput: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    fontSize: 14, color: COLORS.text, marginTop: 12,
    borderWidth: 1, borderColor: COLORS.border, minHeight: 48,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: {
    flex: 1, backgroundColor: COLORS.errorLight, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
  approveBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
