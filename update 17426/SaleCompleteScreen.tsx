import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, CURRENCY_SYMBOL, APP_NAME } from '../../constants';

export default function SaleCompleteScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { receiptNumber, totalAmount, paymentMethod, changeDue, mpesaRef } = route.params || {};

  const paymentLabel =
    paymentMethod === 'cash' ? 'Cash'
    : paymentMethod === 'mpesa_stk' ? 'M-Pesa (STK Push)'
    : paymentMethod === 'mpesa_till' ? 'M-Pesa (Till)'
    : 'M-Pesa';

  const handleShare = async () => {
    try {
      const lines = [
        `${APP_NAME} - Receipt`,
        receiptNumber ? `Receipt: ${receiptNumber}` : '',
        `Amount: ${CURRENCY_SYMBOL} ${Number(totalAmount).toLocaleString()}`,
        `Payment: ${paymentLabel}`,
        mpesaRef ? `M-Pesa Ref: ${mpesaRef}` : '',
        paymentMethod === 'cash' && changeDue > 0 ? `Change: ${CURRENCY_SYMBOL} ${Number(changeDue).toLocaleString()}` : '',
        '',
        'Thank you for your purchase!',
      ].filter(Boolean).join('\n');

      await Share.share({ message: lines, title: 'Receipt' });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Success Icon */}
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Sale Complete!</Text>
        <Text style={styles.amount}>{CURRENCY_SYMBOL} {Number(totalAmount).toLocaleString()}</Text>

        <View style={styles.details}>
          {receiptNumber && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Receipt #</Text>
              {/* FIX: Use Platform-safe monospace font */}
              <Text style={[styles.detailValue, styles.mono]}>{receiptNumber}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={styles.detailValue}>{paymentLabel}</Text>
          </View>
          {paymentMethod === 'cash' && Number(changeDue) > 0 && (
            <View style={[styles.detailRow, styles.changeRow]}>
              <Text style={styles.changeLabel}>Change Due</Text>
              <Text style={styles.changeValue}>
                {CURRENCY_SYMBOL} {Number(changeDue).toLocaleString()}
              </Text>
            </View>
          )}
          {mpesaRef && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>M-Pesa Ref</Text>
              <Text style={[styles.detailValue, styles.mono]}>{mpesaRef}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>📤 Share Receipt</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newSaleBtn}
        onPress={() => nav.navigate('CashierTabs')}
        activeOpacity={0.8}
      >
        <Text style={styles.newSaleBtnText}>New Sale →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', padding: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 32,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.successLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  checkMark: { fontSize: 40, color: COLORS.success },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  amount: { fontSize: 36, fontWeight: '700', color: COLORS.primary, marginBottom: 24 },
  details: { width: '100%', gap: 2 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 14, color: COLORS.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  // FIX: Platform-safe monospace
  mono: {
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
    letterSpacing: 1,
  },
  changeRow: {
    backgroundColor: COLORS.successLight, borderRadius: 10,
    paddingHorizontal: 12, borderBottomWidth: 0, marginTop: 4,
  },
  changeLabel: { fontSize: 16, fontWeight: '600', color: COLORS.success },
  changeValue: { fontSize: 22, fontWeight: '700', color: COLORS.success },
  shareBtn: {
    backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  shareBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  newSaleBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  newSaleBtnText: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
});
