import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { COLORS, SPACING, CURRENCY_SYMBOL } from '../../constants';
import type { Product, StockCountEntry } from '../../types';

export default function OpenShiftScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuthStore();
  const { openShift, isLoading } = useShiftStore();

  const [openingCash, setOpeningCash] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [skipStockCount, setSkipStockCount] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, current_stock, barcode')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    const prods = (data as Product[]) || [];
    setProducts(prods);
    setLoadingProducts(false);
    // FIX: Auto quick-fill from system on load — testers don't need to manually enter all counts
    const filled: Record<string, string> = {};
    prods.forEach(p => { filled[p.id] = String(p.current_stock); });
    setCounts(filled);
  };

  const quickFillFromSystem = () => {
    const filled: Record<string, string> = {};
    products.forEach(p => { filled[p.id] = String(p.current_stock); });
    setCounts(filled);
  };

  const clearAllCounts = () => {
    setCounts({});
  };

  const handleSubmit = async () => {
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) {
      Alert.alert('Invalid', 'Please enter a valid opening cash amount.');
      return;
    }

    let stockCounts: StockCountEntry[] = [];

    if (!skipStockCount) {
      // FIX: Missing counts default to system quantity (not blocked)
      stockCounts = products.map(p => ({
        product_id: p.id,
        product_name: p.name,
        system_quantity: p.current_stock,
        counted_quantity: counts[p.id] !== undefined && counts[p.id] !== ''
          ? parseInt(counts[p.id], 10)
          : p.current_stock, // default to system if not counted
      }));
    }

    const { error } = await openShift(user!.id, cash, stockCounts);
    if (error) {
      Alert.alert('Error', error);
    } else {
      nav.goBack();
    }
  };

  // Count how many are still at system default (uncounted) vs changed
  const changedCount = products.filter(p =>
    counts[p.id] !== undefined &&
    counts[p.id] !== '' &&
    counts[p.id] !== String(p.current_stock)
  ).length;

  const renderProduct = ({ item }: { item: Product }) => {
    const val = counts[item.id] ?? String(item.current_stock);
    const isChanged = val !== String(item.current_stock) && val !== '';
    return (
      <View style={[styles.productRow, isChanged && styles.productRowChanged]}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.systemStock}>System: {item.current_stock}</Text>
        </View>
        <TextInput
          style={[styles.countInput, isChanged && styles.countInputChanged]}
          value={counts[item.id] ?? String(item.current_stock)}
          onChangeText={v => setCounts(prev => ({ ...prev, [item.id]: v.replace(/[^0-9]/g, '') }))}
          keyboardType="number-pad"
          selectTextOnFocus
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Opening Cash */}
      <View style={styles.cashSection}>
        <Text style={styles.sectionTitle}>Opening Cash Float</Text>
        <View style={styles.cashInputWrap}>
          <Text style={styles.currencyLabel}>{CURRENCY_SYMBOL}</Text>
          <TextInput
            style={styles.cashInput}
            value={openingCash}
            onChangeText={setOpeningCash}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={COLORS.textLight}
            autoFocus
          />
        </View>
      </View>

      {/* Stock Count Section */}
      <View style={styles.stockHeader}>
        <View>
          <Text style={styles.sectionTitle}>Opening Stock Count</Text>
          {changedCount > 0 && (
            <Text style={styles.changedNote}>{changedCount} item{changedCount !== 1 ? 's' : ''} adjusted</Text>
          )}
        </View>
        <View style={styles.stockActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={clearAllCounts}>
            <Text style={styles.actionBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={quickFillFromSystem}>
            <Text style={styles.actionBtnTextPrimary}>From System</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.skipRow}>
        <TouchableOpacity
          style={[styles.skipChip, skipStockCount && styles.skipChipActive]}
          onPress={() => setSkipStockCount(!skipStockCount)}
        >
          <Text style={[styles.skipChipText, skipStockCount && styles.skipChipTextActive]}>
            {skipStockCount ? '✓ Stock count skipped (using system values)' : 'Skip stock count'}
          </Text>
        </TouchableOpacity>
      </View>

      {!skipStockCount && (
        <>
          {loadingProducts ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={products}
              keyExtractor={p => p.id}
              renderItem={renderProduct}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </>
      )}

      {skipStockCount && (
        <View style={styles.skipPlaceholder}>
          <Text style={styles.skipPlaceholderText}>
            Stock will be recorded as system values.{'\n'}You can adjust individual products later.
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (isLoading || !openingCash.trim()) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading || !openingCash.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit for Approval</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  cashSection: {
    padding: SPACING.lg, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  cashInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12,
  },
  currencyLabel: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginRight: 8 },
  cashInput: { flex: 1, fontSize: 28, fontWeight: '700', color: COLORS.text, paddingVertical: 12 },
  stockHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 4,
  },
  changedNote: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  stockActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnPrimary: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  actionBtnTextPrimary: { fontSize: 12, fontWeight: '600', color: '#fff' },
  skipRow: { paddingHorizontal: SPACING.lg, paddingVertical: 8 },
  skipChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  skipChipActive: { backgroundColor: COLORS.infoLight, borderColor: COLORS.info },
  skipChipText: { fontSize: 13, color: COLORS.textSecondary },
  skipChipTextActive: { color: COLORS.info, fontWeight: '600' },
  list: { flex: 1 },
  productRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  productRowChanged: { backgroundColor: '#E8F5E9' },
  productInfo: { flex: 1, marginRight: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  systemStock: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  countInput: {
    width: 80, backgroundColor: COLORS.background, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8,
    paddingVertical: 8, fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center',
  },
  countInputChanged: { borderColor: COLORS.primary, color: COLORS.primary },
  skipPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl,
  },
  skipPlaceholderText: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22,
  },
  footer: {
    padding: SPACING.lg, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
