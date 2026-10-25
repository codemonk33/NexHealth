import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ShoppingCart, Plus, Minus, Camera, Upload } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useCartStore } from '../../store/cartStore';
import { useMedicineSearch , MOCK_CATEGORIES , MOCK_MEDICINES } from '../../api/pharmacyApi';
import type { Medicine } from '../../api/types';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function RecordsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { addItem, removeItem, items } = useCartStore();
  const cartTotal = items.reduce((s, i) => s + i.quantity, 0);

  const { data: medicines, isLoading } = useMedicineSearch(search);

  const getQuantity = (medicineId: string) => {
    return items.find((i) => i.medicine.id === medicineId)?.quantity ?? 0;
  };

  const displayMeds = medicines ?? MOCK_MEDICINES;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Med Order</Text>
        <TouchableOpacity
          id="btn-cart-from-records"
          onPress={() => navigation.navigate('Cart')}
          style={styles.cartBtn}
        >
          <ShoppingCart size={22} color={Colors.royalBlue} strokeWidth={2} />
          {cartTotal > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartTotal}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={16} color={Colors.textMuted} strokeWidth={2} />
        <TextInput
          id="input-medicine-search"
          style={styles.searchInput}
          placeholder='Search for medicines (e.g. "Dolo 650")'
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {isLoading && <ActivityIndicator size="small" color={Colors.royalBlue} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Upload Prescription Banner */}
        <TouchableOpacity id="btn-upload-rx" activeOpacity={0.88} style={styles.rxBanner}>
          <LinearGradient
            colors={[Colors.orange, Colors.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rxGradient}
          >
            <Camera size={24} color={Colors.white} strokeWidth={2} />
            <View>
              <Text style={styles.rxTitle}>Upload Prescription</Text>
              <Text style={styles.rxSub}>Camera · Gallery · PDF · Max 10MB</Text>
            </View>
            <Upload size={20} color={Colors.white} strokeWidth={2} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            {MOCK_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                id={`btn-med-category-${cat.id}`}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, selectedCategory === cat.id && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Medicine Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {search ? `Results for "${search}"` : 'Popular Medicines'}
          </Text>
          <View style={styles.medicineGrid}>
            {displayMeds.map((med) => {
              const qty = getQuantity(med.id);
              return (
                <View key={med.id} style={styles.medicineCard}>
                  {med.requiresPrescription && (
                    <View style={styles.rxTag}>
                      <Text style={styles.rxTagText}>Rx</Text>
                    </View>
                  )}
                  {med.discountPercent && (
                    <View style={styles.discountTag}>
                      <Text style={styles.discountTagText}>{med.discountPercent}% OFF</Text>
                    </View>
                  )}
                  <Text style={styles.medicineEmoji}>💊</Text>
                  <Text style={styles.medicineName} numberOfLines={2}>{med.name}</Text>
                  <Text style={styles.medicineBrand}>{med.brand}</Text>
                  <Text style={styles.medicinePackSize}>{med.packSize}</Text>
                  <View style={styles.medicinePriceRow}>
                    {med.discountedPrice && (
                      <Text style={styles.medicineOriginalPrice}>₹{med.price}</Text>
                    )}
                    <Text style={styles.medicinePrice}>₹{med.discountedPrice ?? med.price}</Text>
                  </View>
                  {qty === 0 ? (
                    <TouchableOpacity
                      id={`btn-add-${med.id}`}
                      onPress={() => addItem(med)}
                      style={styles.addBtn}
                    >
                      <LinearGradient
                        colors={[Colors.royalBlue, Colors.royalBlueDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.addBtnGradient}
                      >
                        <Text style={styles.addBtnText}>Add to Cart</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        id={`btn-dec-${med.id}`}
                        onPress={() => removeItem(med.id)}
                        style={styles.qtyBtn}
                      >
                        <Minus size={14} color={Colors.royalBlue} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity
                        id={`btn-inc-${med.id}`}
                        onPress={() => addItem(med)}
                        style={styles.qtyBtn}
                      >
                        <Plus size={14} color={Colors.royalBlue} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  cartBtn: { position: 'relative', padding: 4 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: Colors.orange, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: Colors.white, fontSize: 9, fontFamily: Typography.fontFamily.bold },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    margin: Spacing.base,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textPrimary,
  },
  scrollContent: { paddingBottom: Spacing['4xl'] },
  rxBanner: { marginHorizontal: Spacing.base, marginBottom: Spacing.base, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  rxGradient: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.base,
    padding: Spacing.base, justifyContent: 'space-between',
  },
  rxTitle: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.white },
  rxSub: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.8)' },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  categoriesRow: { gap: Spacing.sm },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  categoryChipActive: { borderColor: Colors.royalBlue, backgroundColor: Colors.blueBg },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  categoryLabelActive: { color: Colors.royalBlue },
  medicineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  medicineCard: {
    width: '48%', backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    position: 'relative', ...Shadows.sm,
  },
  rxTag: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: Colors.royalBlue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  rxTagText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: Colors.white },
  discountTag: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.successBg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  discountTagText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: Colors.success },
  medicineEmoji: { fontSize: 36, marginTop: Spacing.sm, marginBottom: 4 },
  medicineName: {
    fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary, marginBottom: 2,
  },
  medicineBrand: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textMuted },
  medicinePackSize: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textMuted, marginBottom: 6 },
  medicinePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: Spacing.sm },
  medicineOriginalPrice: {
    fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted, textDecorationLine: 'line-through',
  },
  medicinePrice: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  addBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  addBtnGradient: { alignItems: 'center', paddingVertical: 6 },
  addBtnText: { color: Colors.white, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.semiBold },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.blueBg, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4,
  },
  qtyBtn: { padding: 2 },
  qtyText: { fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.bold, color: Colors.royalBlue },
});
