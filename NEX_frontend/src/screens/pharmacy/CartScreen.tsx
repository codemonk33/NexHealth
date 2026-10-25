import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useCartStore } from '../../store/cartStore';
import { usePlaceOrder } from '../../api/pharmacyApi';

export function CartScreen() {
  const navigation = useNavigation();
  const { items, addItem, removeItem, updateQuantity, clearCart } = useCartStore();
  const placeOrder = usePlaceOrder();

  const totalAmount = items.reduce(
    (sum, i) => sum + (i.medicine.discountedPrice ?? i.medicine.price) * i.quantity,
    0
  );

  const handleCheckout = async () => {
    try {
      await placeOrder.mutateAsync({
        items: items.map((i) => ({ medicineId: i.medicine.id, quantity: i.quantity })),
        deliveryAddress: '42 Health St, Medical District, Mumbai - 400001',
        paymentMethod: 'COD',
      });
      clearCart();
      navigation.goBack();
    } catch {}
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity id="btn-back-cart" onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Add medicines from the Med Order tab</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity id="btn-back-cart" onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart ({items.length})</Text>
        <TouchableOpacity id="btn-clear-cart" onPress={clearCart}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.medicine.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <Text style={styles.cartItemEmoji}>💊</Text>
            <View style={styles.cartItemInfo}>
              <Text style={styles.cartItemName}>{item.medicine.name}</Text>
              <Text style={styles.cartItemBrand}>{item.medicine.brand} · {item.medicine.packSize}</Text>
              <Text style={styles.cartItemPrice}>
                ₹{(item.medicine.discountedPrice ?? item.medicine.price) * item.quantity}
              </Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                id={`btn-dec-cart-${item.medicine.id}`}
                onPress={() => updateQuantity(item.medicine.id, item.quantity - 1)}
                style={styles.qtyBtn}
              >
                <Minus size={14} color={Colors.royalBlue} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                id={`btn-inc-cart-${item.medicine.id}`}
                onPress={() => addItem(item.medicine)}
                style={styles.qtyBtn}
              >
                <Plus size={14} color={Colors.royalBlue} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{totalAmount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>Free</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>₹{totalAmount}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.checkoutContainer}>
        <TouchableOpacity
          id="btn-place-order"
          onPress={handleCheckout}
          disabled={placeOrder.isPending}
          activeOpacity={0.85}
          style={styles.checkoutBtn}
        >
          <LinearGradient
            colors={[Colors.teal, Colors.tealDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutGradient}
          >
            {placeOrder.isPending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <ShoppingBag size={20} color={Colors.white} strokeWidth={2} />
                <Text style={styles.checkoutText}>Place Order · ₹{totalAmount}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  clearText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.error,
  },
  listContent: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 100 },
  cartItem: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cartItemEmoji: { fontSize: 32 },
  cartItemInfo: { flex: 1 },
  cartItemName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  cartItemBrand: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cartItemPrice: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.royalBlue,
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blueBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  qtyBtn: { padding: 2 },
  qtyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.royalBlue,
    minWidth: 20,
    textAlign: 'center',
  },
  summary: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  summaryTotalValue: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.teal,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyEmoji: { fontSize: 80 },
  emptyTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  checkoutContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkoutBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  checkoutGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md + 2,
  },
  checkoutText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
});
