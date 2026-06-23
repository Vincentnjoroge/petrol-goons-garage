import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Alert, Modal, Pressable, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useCartStore } from '../../store/cartStore';
import { useShiftStore } from '../../store/shiftStore';
import { COLORS, SPACING, CURRENCY_SYMBOL, PRESET_QUANTITIES, MIN_SEARCH_CHARS } from '../../constants';
import type { Product } from '../../types';

export default function POSScreen() {
  const nav = useNavigation<any>();
  const {
    items, addItem, removeItem, updateQuantity,
    subtotal, discountTotal, total, recentProducts,
  } = useCartStore();
  const { currentShift } = useShiftStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [recentProductsList, setRecentProductsList] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [discountModal, setDiscountModal] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [presetQtyItem, setPresetQtyItem] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // FIX: Debounce search ref
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (recentProducts.length > 0) loadRecentProducts();
  }, [recentProducts]);

  const loadRecentProducts = async () => {
    if (recentProducts.length === 0) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .in('id', recentProducts)
      .eq('is_active', true);
    if (data) {
      const sorted = recentProducts
        .map(id => data.find((p: Product) => p.id === id))
        .filter(Boolean) as Product[];
      setRecentProductsList(sorted);
    }
  };

  // FIX: Debounced search — only fires 300ms after user stops typing
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (query.length < MIN_SEARCH_CHARS) {
      setSearchResults([]);
      setShowSearch(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .or(`name.ilike.%${query}%,barcode.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(20);
      setSearchResults((data as Product[]) || []);
      setShowSearch(true);
      setSearching(false);
    }, 300);
  }, []);

  const handleAddProduct = (product: Product) => {
    if (product.current_stock <= 0) {
      Alert.alert(
        'Out of Stock',
        `${product.name} has 0 stock. Add anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: () => { addItem(product); clearSearch(); } },
        ]
      );
      return;
    }
    addItem(product);
    clearSearch();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleCharge = () => {
    if (items.length === 0) { Alert.alert('Empty Cart', 'Add products before charging.'); return; }
    nav.navigate('Payment');
  };

  const applyDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0 || val > 100) {
      Alert.alert('Invalid', 'Enter a discount between 1 and 100%.');
      return;
    }
    const discAmt = (val / 100) * subtotal();
    items.forEach(item => {
      const itemShare = (item.line_total / subtotal()) * discAmt;
      useCartStore.getState().applyItemDiscount(item.product_id, Math.round(itemShare * 100) / 100);
    });
    setDiscountModal(false);
    setDiscountValue('');
  };

  const renderCartItem = ({ item }: { item: typeof items[0] }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.cartItemPrice}>
          {CURRENCY_SYMBOL} {item.unit_price.toLocaleString()}
          {item.discount_amount > 0 && (
            <Text style={styles.discountTag}> (-{CURRENCY_SYMBOL} {item.discount_amount.toLocaleString()})</Text>
          )}
        </Text>
      </View>
      <View style={styles.qtyControls}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product_id, item.quantity - 1)}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Pressable onLongPress={() => setPresetQtyItem(item.product_id)}>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
        </Pressable>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product_id, item.quantity + 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cartItemRight}>
        <Text style={styles.lineTotal}>{CURRENCY_SYMBOL} {item.line_total.toLocaleString()}</Text>
        <TouchableOpacity onPress={() => removeItem(item.product_id)} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => Alert.alert('Barcode Scanner', 'Point camera at barcode to scan product.', [{ text: 'OK' }])}
        >
          <Text style={styles.scanBtnText}>⊞ SCAN</Text>
        </TouchableOpacity>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {searching && (
            <Text style={styles.searchingDot}>...</Text>
          )}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results Dropdown */}
      {showSearch && searchResults.length > 0 && (
        <View style={styles.searchDropdown}>
          {searchResults.map(p => (
            <TouchableOpacity key={p.id} style={styles.searchResultRow} onPress={() => handleAddProduct(p)}>
              <View style={styles.searchResultLeft}>
                <Text style={styles.searchResultName}>{p.name}</Text>
                <Text style={styles.searchResultSku}>{p.barcode || p.sku}</Text>
              </View>
              <View style={styles.searchResultRight}>
                <Text style={styles.searchResultPrice}>{CURRENCY_SYMBOL} {p.selling_price.toLocaleString()}</Text>
                <Text style={[styles.searchResultStock, p.current_stock <= 0 && styles.outOfStock]}>
                  {p.current_stock <= 0 ? 'Out' : `${p.current_stock} left`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showSearch && searchResults.length === 0 && !searching && searchQuery.length >= MIN_SEARCH_CHARS && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No products found for "{searchQuery}"</Text>
        </View>
      )}

      {/* Recent Products */}
      {!showSearch && recentProductsList.length > 0 && items.length === 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent</Text>
          <FlatList
            horizontal
            data={recentProductsList}
            keyExtractor={p => p.id}
            renderItem={({ item: p }) => (
              <TouchableOpacity style={styles.recentChip} onPress={() => handleAddProduct(p)}>
                <Text style={styles.recentChipText} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.recentChipPrice}>{CURRENCY_SYMBOL} {p.selling_price.toLocaleString()}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Cart */}
      <FlatList
        data={items}
        keyExtractor={i => i.product_id}
        renderItem={renderCartItem}
        style={styles.cartList}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartIcon}>🛒</Text>
            <Text style={styles.emptyCartText}>Cart is empty</Text>
            <Text style={styles.emptyCartSub}>Search or scan products to add</Text>
          </View>
        }
      />

      {/* Preset Qty Modal */}
      <Modal visible={!!presetQtyItem} transparent animationType="fade" onRequestClose={() => setPresetQtyItem(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPresetQtyItem(null)}>
          <View style={styles.presetModal}>
            <Text style={styles.presetTitle}>Quick Quantity</Text>
            <View style={styles.presetRow}>
              {PRESET_QUANTITIES.map(q => (
                <TouchableOpacity
                  key={q}
                  style={styles.presetBtn}
                  onPress={() => { if (presetQtyItem) updateQuantity(presetQtyItem, q); setPresetQtyItem(null); }}
                >
                  <Text style={styles.presetBtnText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Discount Modal */}
      <Modal visible={discountModal} transparent animationType="slide" onRequestClose={() => setDiscountModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDiscountModal(false)}>
          <View style={styles.discountModal}>
            <Text style={styles.discountTitle}>Apply Discount (%)</Text>
            <TextInput
              style={styles.discountInput}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="numeric"
              placeholder="e.g. 10"
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <TouchableOpacity style={styles.discountApplyBtn} onPress={applyDiscount}>
              <Text style={styles.discountApplyText}>Apply Discount</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Footer */}
      <View style={styles.cartFooter}>
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{CURRENCY_SYMBOL} {subtotal().toLocaleString()}</Text>
          </View>
          {discountTotal() > 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalLabel, { color: COLORS.secondary }]}>Discount</Text>
              <Text style={[styles.totalValue, { color: COLORS.secondary }]}>
                − {CURRENCY_SYMBOL} {discountTotal().toLocaleString()}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{CURRENCY_SYMBOL} {total().toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.discountBtn, items.length === 0 && { opacity: 0.4 }]}
            onPress={() => setDiscountModal(true)}
            disabled={items.length === 0}
          >
            <Text style={styles.discountBtnText}>% Disc</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chargeBtn, items.length === 0 && styles.chargeBtnDisabled]}
            onPress={handleCharge}
            disabled={items.length === 0}
          >
            <Text style={styles.chargeBtnText}>
              Charge {CURRENCY_SYMBOL} {total().toLocaleString()}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.endShiftLink} onPress={() => nav.navigate('CloseShift')}>
          <Text style={styles.endShiftText}>End Shift</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchSection: {
    flexDirection: 'row', padding: SPACING.md, gap: 8,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  scanBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center',
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', position: 'relative' as any },
  searchInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, paddingRight: 40,
  },
  searchingDot: { position: 'absolute' as any, right: 36, fontSize: 18, color: COLORS.textLight },
  clearBtn: { position: 'absolute' as any, right: 10, padding: 4 },
  clearBtnText: { fontSize: 14, color: COLORS.textLight, fontWeight: '600' },
  searchDropdown: {
    position: 'absolute' as any, top: 64, left: 0, right: 0, zIndex: 1000,
    backgroundColor: COLORS.surface, maxHeight: 320,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchResultLeft: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  searchResultSku: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  searchResultRight: { alignItems: 'flex-end' },
  searchResultPrice: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  searchResultStock: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  outOfStock: { color: COLORS.error },
  noResults: { padding: 16, alignItems: 'center' },
  noResultsText: { fontSize: 14, color: COLORS.textSecondary },
  recentSection: {
    padding: SPACING.md, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  recentTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  recentChip: {
    backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: COLORS.border, minWidth: 100,
  },
  recentChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  recentChipPrice: { fontSize: 11, color: COLORS.primary, marginTop: 2 },
  cartList: { flex: 1 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cartItemPrice: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  discountTag: { color: COLORS.secondary },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  qtyBtnText: { fontSize: 20, fontWeight: '700', color: COLORS.primary, lineHeight: 24 },
  qtyValue: { fontSize: 16, fontWeight: '700', color: COLORS.text, minWidth: 28, textAlign: 'center' },
  cartItemRight: { alignItems: 'flex-end', gap: 4 },
  lineTotal: { fontSize: 14, fontWeight: '700', color: COLORS.text, minWidth: 70, textAlign: 'right' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 13, color: COLORS.error, fontWeight: '700' },
  emptyCart: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyCartIcon: { fontSize: 48 },
  emptyCartText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '600' },
  emptyCartSub: { fontSize: 14, color: COLORS.textLight },
  cartFooter: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md, paddingBottom: SPACING.lg,
    borderTopWidth: 2, borderTopColor: COLORS.primary,
  },
  totalsSection: { gap: 2, marginBottom: SPACING.md },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary },
  totalValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  grandTotalLabel: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  footerActions: { flexDirection: 'row', gap: 10 },
  discountBtn: {
    paddingHorizontal: 16, backgroundColor: COLORS.background, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  discountBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  chargeBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  chargeBtnDisabled: { backgroundColor: COLORS.disabled },
  chargeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  endShiftLink: { alignItems: 'center', marginTop: 10, padding: 4 },
  endShiftText: { fontSize: 13, color: COLORS.error, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  presetModal: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, width: '85%' as any },
  presetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  presetRow: { flexDirection: 'row', justifyContent: 'space-around' },
  presetBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  presetBtnText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  discountModal: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, width: '85%' as any },
  discountTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  discountInput: {
    backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 28, fontWeight: '700', textAlign: 'center',
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  discountApplyBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  discountApplyText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
