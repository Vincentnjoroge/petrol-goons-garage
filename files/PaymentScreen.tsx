import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Platform, Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useCartStore } from '../../store/cartStore';
import { useShiftStore } from '../../store/shiftStore';
import { useAuthStore } from '../../store/authStore';
import {
  COLORS, SPACING, CURRENCY_SYMBOL,
  MPESA_STK_TIMEOUT_MS, MPESA_PHONE_PREFIX,
} from '../../constants';

type Tab = 'cash' | 'mpesa';
type MpesaMode = 'stk' | 'till';

// Numpad for cash entry
function CashNumpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) return;
    if (key === '.' && value === '') { onChange('0.'); return; }
    // Max 2 decimal places
    if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
    onChange(value + key);
  };

  const keys = [['7','8','9'],['4','5','6'],['1','2','3'],['.',  '0','⌫']];

  return (
    <View style={numStyles.pad}>
      {keys.map((row, ri) => (
        <View key={ri} style={numStyles.row}>
          {row.map(k => (
            <TouchableOpacity
              key={k}
              style={[numStyles.key, k === '⌫' && numStyles.delKey]}
              onPress={() => handleKey(k)}
              activeOpacity={0.6}
            >
              <Text style={[numStyles.keyText, k === '⌫' && numStyles.delText]}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const numStyles = StyleSheet.create({
  pad: { marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  key: {
    flex: 1, marginHorizontal: 4, paddingVertical: 16, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  delKey: { backgroundColor: COLORS.errorLight, borderColor: COLORS.errorLight },
  keyText: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  delText: { fontSize: 16, color: COLORS.error },
});

export default function PaymentScreen() {
  const nav = useNavigation<any>();
  const { items, total, subtotal, discountTotal, clearCart } = useCartStore();
  const { currentShift } = useShiftStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>('cash');
  const [mpesaMode, setMpesaMode] = useState<MpesaMode>('stk');

  // Cash
  const [amountReceived, setAmountReceived] = useState('');
  const totalAmount = total();
  const receivedNum = parseFloat(amountReceived || '0');
  const changeDue = Math.max(0, receivedNum - totalAmount);

  // Quick cash amounts
  const quickAmounts = [totalAmount, 500, 1000, 2000, 5000].filter(
    (v, i, arr) => arr.indexOf(v) === i && v >= totalAmount
  ).slice(0, 4);

  // M-Pesa STK
  const [phone, setPhone] = useState(MPESA_PHONE_PREFIX);
  const [stkLoading, setStkLoading] = useState(false);
  const [stkWaiting, setStkWaiting] = useState(false);
  const [stkTimeout, setStkTimeout] = useState(false);
  const [manualRefMode, setManualRefMode] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null);
  const [tillWaiting, setTillWaiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Realtime payment listener
  useEffect(() => {
    if (!pendingSaleId) return;
    const channel = supabase
      .channel(`sale-${pendingSaleId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sales',
        filter: `id=eq.${pendingSaleId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.payment_status === 'completed') {
          if (timerRef.current) clearTimeout(timerRef.current);
          setStkWaiting(false);
          setTillWaiting(false);
          clearCart();
          nav.navigate('SaleComplete', {
            saleId: pendingSaleId,
            receiptNumber: updated.receipt_number,
            totalAmount: updated.total_amount,
            paymentMethod: updated.payment_method,
            mpesaRef: updated.mpesa_ref,
          });
        } else if (updated.payment_status === 'failed') {
          setStkWaiting(false);
          Alert.alert('Payment Failed', 'M-Pesa payment was not completed. Try again or use cash.');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pendingSaleId]);

  const createSaleRecord = async (paymentMethod: string) => {
    const { data: sale, error } = await supabase
      .from('sales')
      .insert({
        shift_id: currentShift!.id,
        cashier_id: user!.id,
        subtotal: subtotal(),
        discount_amount: discountTotal(),
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: 'pending',
        status: 'draft',
      })
      .select()
      .single();

    if (error || !sale) throw new Error(error?.message || 'Failed to create sale');

    const itemRows = items.map(i => ({
      sale_id: sale.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount_amount: i.discount_amount,
      line_total: i.line_total,
    }));
    const { error: itemError } = await supabase.from('sale_items').insert(itemRows);
    if (itemError) throw new Error(itemError.message);

    return sale;
  };

  const handleCashPayment = async () => {
    if (receivedNum < totalAmount) {
      Alert.alert('Insufficient', 'Amount received must be at least the total.');
      return;
    }
    try {
      const sale = await createSaleRecord('cash');
      const { data: updated } = await supabase
        .from('sales')
        .update({ payment_status: 'completed', status: 'completed' })
        .eq('id', sale.id)
        .select()
        .single();

      supabase.functions.invoke('send-receipt-email', { body: { sale_id: sale.id } }).catch(() => {});
      clearCart();
      nav.navigate('SaleComplete', {
        saleId: sale.id,
        receiptNumber: updated?.receipt_number || sale.receipt_number,
        totalAmount,
        paymentMethod: 'cash',
        changeDue: receivedNum - totalAmount,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSTKPush = async () => {
    const cleanPhone = phone.replace(/\s/g, '');
    if (cleanPhone.length < 12) {
      Alert.alert('Invalid Phone', 'Enter a valid number e.g. 254712345678');
      return;
    }
    setStkLoading(true);
    try {
      const sale = await createSaleRecord('mpesa_stk');
      setPendingSaleId(sale.id);

      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: { phone: cleanPhone, amount: totalAmount, sale_id: sale.id, receipt_number: sale.receipt_number },
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message || 'STK Push failed');

      setStkLoading(false);
      setStkWaiting(true);

      timerRef.current = setTimeout(() => {
        setStkWaiting(false);
        setStkTimeout(true);
      }, MPESA_STK_TIMEOUT_MS);
    } catch (err: any) {
      setStkLoading(false);
      Alert.alert('M-Pesa Error', err.message);
    }
  };

  const handleManualConfirm = async () => {
    if (!manualRef.trim()) { Alert.alert('Required', 'Enter the M-Pesa reference code.'); return; }
    if (!pendingSaleId) return;
    try {
      await supabase.from('sales').update({
        payment_status: 'completed', status: 'completed',
        mpesa_ref: manualRef.trim().toUpperCase(),
        mpesa_phone: phone,
        completed_at: new Date().toISOString(),
      }).eq('id', pendingSaleId);

      await supabase.from('audit_log').insert({
        user_id: user!.id, action: 'mpesa_manual_confirm',
        entity_type: 'sale', entity_id: pendingSaleId,
        new_values: { mpesa_ref: manualRef.trim(), phone },
      });

      supabase.functions.invoke('send-receipt-email', { body: { sale_id: pendingSaleId } }).catch(() => {});
      clearCart();
      nav.navigate('SaleComplete', {
        saleId: pendingSaleId, totalAmount,
        paymentMethod: 'mpesa_stk', mpesaRef: manualRef.trim().toUpperCase(),
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleTillPayment = async () => {
    try {
      const sale = await createSaleRecord('mpesa_till');
      setPendingSaleId(sale.id);
      setTillWaiting(true);
      timerRef.current = setTimeout(() => {
        setTillWaiting(false);
        setStkTimeout(true);
      }, MPESA_STK_TIMEOUT_MS * 2);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const resetMpesa = () => {
    setStkWaiting(false);
    setStkTimeout(false);
    setManualRefMode(false);
    setTillWaiting(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {/* Total */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Due</Text>
        <Text style={styles.totalAmount}>{CURRENCY_SYMBOL} {totalAmount.toLocaleString()}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['cash', 'mpesa'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); resetMpesa(); }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'cash' ? '💵 Cash' : '📱 M-Pesa'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CASH TAB */}
      {tab === 'cash' && (
        <View style={styles.section}>
          {/* Amount display */}
          <Text style={styles.inputLabel}>Amount Received</Text>
          <View style={styles.amountDisplay}>
            <Text style={styles.amountCurrency}>{CURRENCY_SYMBOL}</Text>
            <Text style={[styles.amountText, !amountReceived && styles.amountPlaceholder]}>
              {amountReceived || '0'}
            </Text>
          </View>

          {/* Change due */}
          {receivedNum > 0 && (
            <View style={[styles.changeRow, changeDue > 0 && styles.changeRowPositive]}>
              <Text style={styles.changeLabel}>Change Due</Text>
              <Text style={[styles.changeAmount, changeDue > 0 && styles.changeAmountPositive]}>
                {CURRENCY_SYMBOL} {changeDue.toLocaleString()}
              </Text>
            </View>
          )}

          {/* Quick amounts */}
          <View style={styles.quickRow}>
            {quickAmounts.map(amt => (
              <TouchableOpacity
                key={amt}
                style={[styles.quickBtn, amountReceived === String(amt) && styles.quickBtnActive]}
                onPress={() => setAmountReceived(String(amt))}
              >
                <Text style={[styles.quickBtnText, amountReceived === String(amt) && styles.quickBtnTextActive]}>
                  {amt >= 1000 ? `${amt/1000}K` : amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Numpad */}
          <CashNumpad value={amountReceived} onChange={setAmountReceived} />

          {/* Confirm */}
          <TouchableOpacity
            style={[styles.confirmBtn, receivedNum < totalAmount && styles.btnDisabled]}
            onPress={handleCashPayment}
            disabled={receivedNum < totalAmount}
          >
            <Text style={styles.confirmBtnText}>
              {receivedNum >= totalAmount ? '✓ Confirm Cash Payment' : `Enter at least ${CURRENCY_SYMBOL} ${totalAmount.toLocaleString()}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* M-PESA TAB */}
      {tab === 'mpesa' && !stkWaiting && !stkTimeout && !manualRefMode && !tillWaiting && (
        <View style={styles.section}>
          <View style={styles.mpesaTabs}>
            {(['stk', 'till'] as MpesaMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.mpesaTab, mpesaMode === m && styles.mpesaTabActive]}
                onPress={() => setMpesaMode(m)}
              >
                <Text style={[styles.mpesaTabText, mpesaMode === m && styles.mpesaTabTextActive]}>
                  {m === 'stk' ? 'STK Push' : 'Till/Paybill'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mpesaMode === 'stk' && (
            <>
              <Text style={styles.inputLabel}>Customer Phone Number</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="254712345678"
                placeholderTextColor={COLORS.textLight}
                maxLength={13}
              />
              <TouchableOpacity
                style={[styles.confirmBtn, styles.mpesaBtn, stkLoading && styles.btnDisabled]}
                onPress={handleSTKPush}
                disabled={stkLoading}
              >
                {stkLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>Send M-Pesa Request</Text>}
              </TouchableOpacity>
            </>
          )}

          {mpesaMode === 'till' && (
            <>
              <View style={styles.tillBox}>
                <Text style={styles.tillInstruction}>Ask customer to pay:</Text>
                <Text style={styles.tillAmount}>{CURRENCY_SYMBOL} {totalAmount.toLocaleString()}</Text>
                <Text style={styles.tillNote}>To your Till/Paybill number</Text>
              </View>
              <TouchableOpacity style={[styles.confirmBtn, styles.mpesaBtn]} onPress={handleTillPayment}>
                <Text style={styles.confirmBtnText}>I've told the customer — Wait for payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.manualLink} onPress={() => { setPendingSaleId(null); setManualRefMode(true); }}>
                <Text style={styles.manualLinkText}>Customer already paid? Enter ref manually</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* STK / Till Waiting */}
      {tab === 'mpesa' && (stkWaiting || tillWaiting) && !manualRefMode && (
        <View style={styles.waitingSection}>
          <ActivityIndicator size="large" color={COLORS.mpesa} />
          <Text style={styles.waitingTitle}>
            {tillWaiting ? 'Waiting for Till Payment...' : 'Waiting for Customer...'}
          </Text>
          <Text style={styles.waitingSubText}>
            {tillWaiting
              ? 'The payment will confirm automatically when received.'
              : 'Customer should enter their M-Pesa PIN on their phone.'}
          </Text>
          <TouchableOpacity style={styles.manualLink} onPress={() => { setStkWaiting(false); setTillWaiting(false); setManualRefMode(true); }}>
            <Text style={styles.manualLinkText}>Customer says they paid? Enter ref manually</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.manualLink, { marginTop: 4 }]} onPress={resetMpesa}>
            <Text style={[styles.manualLinkText, { color: COLORS.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Timeout */}
      {tab === 'mpesa' && stkTimeout && !manualRefMode && (
        <View style={styles.waitingSection}>
          <Text style={styles.timeoutTitle}>No Response</Text>
          <Text style={styles.waitingSubText}>
            The request timed out. The customer may have cancelled or had poor signal.
          </Text>
          <TouchableOpacity style={[styles.confirmBtn, styles.mpesaBtn, { alignSelf: 'stretch' }]} onPress={() => { setStkTimeout(false); }}>
            <Text style={styles.confirmBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualLink} onPress={() => { setStkTimeout(false); setManualRefMode(true); }}>
            <Text style={styles.manualLinkText}>Customer has confirmation? Enter ref manually</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualLink} onPress={() => { setTab('cash'); setStkTimeout(false); }}>
            <Text style={[styles.manualLinkText, { color: COLORS.error }]}>Switch to Cash</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Ref */}
      {manualRefMode && (
        <View style={styles.section}>
          <Text style={styles.inputLabel}>M-Pesa Reference Code</Text>
          <Text style={styles.manualHint}>Ask customer to show their M-Pesa confirmation SMS</Text>
          <TextInput
            style={styles.phoneInput}
            value={manualRef}
            onChangeText={v => setManualRef(v.toUpperCase())}
            placeholder="e.g. SHK7A1B2C3"
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="characters"
            autoFocus
          />
          <TouchableOpacity style={[styles.confirmBtn, styles.mpesaBtn]} onPress={handleManualConfirm}>
            <Text style={styles.confirmBtnText}>Confirm by Reference</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualLink} onPress={() => setManualRefMode(false)}>
            <Text style={styles.manualLinkText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  totalSection: {
    alignItems: 'center', paddingVertical: 20, backgroundColor: COLORS.surface,
    borderRadius: 16, marginBottom: 14,
  },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary },
  totalAmount: { fontSize: 36, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  section: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, gap: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  amountDisplay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background, borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: COLORS.primary, gap: 6,
  },
  amountCurrency: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  amountText: { fontSize: 40, fontWeight: '700', color: COLORS.text },
  amountPlaceholder: { color: COLORS.textLight },
  changeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
  },
  changeRowPositive: { backgroundColor: COLORS.successLight },
  changeLabel: { fontSize: 14, color: COLORS.textSecondary },
  changeAmount: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  changeAmountPositive: { color: COLORS.success },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickBtn: {
    flex: 1, minWidth: 64, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  quickBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  quickBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  quickBtnTextActive: { color: '#fff' },
  confirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  mpesaBtn: { backgroundColor: COLORS.mpesa },
  btnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  mpesaTabs: { flexDirection: 'row', gap: 8 },
  mpesaTab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  mpesaTabActive: { backgroundColor: COLORS.mpesa, borderColor: COLORS.mpesa },
  mpesaTabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  mpesaTabTextActive: { color: '#fff' },
  phoneInput: {
    backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 20, fontWeight: '700', color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, textAlign: 'center',
    letterSpacing: 2,
  },
  tillBox: {
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 20, alignItems: 'center', gap: 4,
  },
  tillInstruction: { fontSize: 14, color: COLORS.textSecondary },
  tillAmount: { fontSize: 32, fontWeight: '700', color: COLORS.primary },
  tillNote: { fontSize: 13, color: COLORS.textSecondary },
  waitingSection: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  waitingTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  waitingSubText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  timeoutTitle: { fontSize: 18, fontWeight: '700', color: COLORS.warning },
  manualLink: { marginTop: 8, padding: 8, alignItems: 'center' },
  manualLinkText: { fontSize: 14, color: COLORS.primaryLight, fontWeight: '600', textDecorationLine: 'underline' },
  manualHint: { fontSize: 12, color: COLORS.textSecondary },
});
