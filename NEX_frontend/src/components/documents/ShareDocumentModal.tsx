/**
 * ShareDocumentModal — Share Document with Doctor
 * 
 * Displays:
 * - Doctor selector (searchable list)
 * - Access level picker (read / read_write)
 * - Confirm / Cancel buttons
 * - Error messages with retry
 * - Loading state during API call
 * 
 * Mobile-optimized with keyboard handling and accessibility.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../../theme/useTheme';

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization?: string;
}

export interface ShareDocumentModalProps {
  visible: boolean;
  documentName: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onConfirm: (doctorId: string, accessLevel: 'read' | 'read_write') => void;
  onCancel: () => void;
  onFetchDoctors?: () => Promise<Doctor[]>;
  preloadedDoctors?: Doctor[];
}

export default function ShareDocumentModal({
  visible,
  documentName,
  isLoading = false,
  errorMessage,
  onConfirm,
  onCancel,
  onFetchDoctors,
  preloadedDoctors = [],
}: ShareDocumentModalProps) {
  const { colors, spacing, fonts } = useTheme();

  // State
  const [doctors, setDoctors] = useState<Doctor[]>(preloadedDoctors);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<'read' | 'read_write'>('read');
  const [isFetchingDoctors, setIsFetchingDoctors] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /**
   * Fetch doctors on mount
   */
  useEffect(() => {
    if (visible && doctors.length === 0 && onFetchDoctors) {
      const fetchDoctors = async () => {
        try {
          setIsFetchingDoctors(true);
          setFetchError(null);
          const result = await onFetchDoctors();
          setDoctors(result);
        } catch (err) {
          setFetchError(
            err instanceof Error ? err.message : 'Failed to load doctors'
          );
        } finally {
          setIsFetchingDoctors(false);
        }
      };

      fetchDoctors();
    }
  }, [visible, doctors.length, onFetchDoctors]);

  /**
   * Filter doctors based on search query
   */
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;

    const query = searchQuery.toLowerCase();
    return doctors.filter(
      (doctor) =>
        doctor.name.toLowerCase().includes(query) ||
        doctor.email.toLowerCase().includes(query) ||
        doctor.specialization?.toLowerCase().includes(query)
    );
  }, [doctors, searchQuery]);

  /**
   * Handle doctor selection
   */
  const handleSelectDoctor = useCallback((doctorId: string) => {
    setSelectedDoctorId(doctorId);
  }, []);

  /**
   * Handle confirm share
   */
  const handleConfirm = useCallback(() => {
    if (!selectedDoctorId) {
      setFetchError('Please select a doctor');
      return;
    }

    onConfirm(selectedDoctorId, accessLevel);
  }, [selectedDoctorId, accessLevel, onConfirm]);

  /**
   * Handle modal close
   */
  const handleCancel = useCallback(() => {
    setSearchQuery('');
    setSelectedDoctorId(null);
    setAccessLevel('read');
    setFetchError(null);
    onCancel();
  }, [onCancel]);

  /**
   * Render doctor list item
   */
  const renderDoctorItem = ({ item }: { item: Doctor }) => {
    const isSelected = selectedDoctorId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.doctorItem,
          {
            backgroundColor: isSelected ? `${colors.primary}15` : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => handleSelectDoctor(item.id)}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : 'transparent',
            },
          ]}
        >
          {isSelected && (
            <Feather name="check" size={14} color="white" />
          )}
        </View>

        {/* Doctor Info */}
        <View style={styles.doctorInfo}>
          <Text
            style={[
              styles.doctorName,
              { color: colors.text, fontFamily: fonts.medium },
            ]}
          >
            Dr. {item.name}
          </Text>
          <Text style={[styles.doctorEmail, { color: colors.textSecondary }]}>
            {item.email}
          </Text>
          {item.specialization && (
            <Text style={[styles.specialization, { color: colors.textSecondary }]}>
              {item.specialization}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.headerContent}>
            <Text
              style={[
                styles.headerTitle,
                { color: colors.text, fontFamily: fonts.bold },
              ]}
            >
              Share Document
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              "{documentName}"
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCancel}
            disabled={isLoading}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Doctor Selection Section */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.text, fontFamily: fonts.medium },
              ]}
            >
              Select Doctor
            </Text>

            {/* Search Input */}
            <View
              style={[
                styles.searchContainer,
                { borderColor: colors.border },
              ]}
            >
              <Feather
                name="search"
                size={16}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: colors.text },
                ]}
                placeholder="Search by name or email..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                editable={!isLoading}
              />
              {searchQuery && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name="x-circle"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Error Message */}
            {(fetchError || errorMessage) && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: `${colors.error}20` },
                ]}
              >
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.error}
                  style={styles.errorIcon}
                />
                <Text
                  style={[
                    styles.errorText,
                    { color: colors.error },
                  ]}
                >
                  {fetchError || errorMessage}
                </Text>
              </View>
            )}

            {/* Doctors List */}
            {isFetchingDoctors ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Loading doctors...
                </Text>
              </View>
            ) : filteredDoctors.length > 0 ? (
              <FlatList
                data={filteredDoctors}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={renderDoctorItem}
                ItemSeparatorComponent={() => (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: colors.border },
                    ]}
                  />
                )}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="account-search-outline"
                  size={32}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {searchQuery
                    ? 'No doctors found'
                    : 'No doctors available'}
                </Text>
              </View>
            )}
          </View>

          {/* Access Level Section */}
          {selectedDoctorId && (
            <View style={[styles.section, styles.accessLevelSection]}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.text, fontFamily: fonts.medium },
                ]}
              >
                Access Level
              </Text>

              {/* Read Only */}
              <TouchableOpacity
                style={[
                  styles.accessLevelButton,
                  {
                    backgroundColor:
                      accessLevel === 'read'
                        ? `${colors.primary}15`
                        : colors.surface,
                    borderColor:
                      accessLevel === 'read' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setAccessLevel('read')}
                disabled={isLoading}
              >
                <View
                  style={[
                    styles.radioButton,
                    {
                      borderColor:
                        accessLevel === 'read'
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        accessLevel === 'read'
                          ? colors.primary
                          : 'transparent',
                    },
                  ]}
                >
                  {accessLevel === 'read' && (
                    <View
                      style={[
                        styles.radioButtonInner,
                        { backgroundColor: 'white' },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.accessLevelInfo}>
                  <Text
                    style={[
                      styles.accessLevelTitle,
                      { color: colors.text, fontFamily: fonts.medium },
                    ]}
                  >
                    Read Only
                  </Text>
                  <Text
                    style={[
                      styles.accessLevelDesc,
                      { color: colors.textSecondary },
                    ]}
                  >
                    View and download only
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Read & Write */}
              <TouchableOpacity
                style={[
                  styles.accessLevelButton,
                  {
                    backgroundColor:
                      accessLevel === 'read_write'
                        ? `${colors.primary}15`
                        : colors.surface,
                    borderColor:
                      accessLevel === 'read_write'
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => setAccessLevel('read_write')}
                disabled={isLoading}
              >
                <View
                  style={[
                    styles.radioButton,
                    {
                      borderColor:
                        accessLevel === 'read_write'
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        accessLevel === 'read_write'
                          ? colors.primary
                          : 'transparent',
                    },
                  ]}
                >
                  {accessLevel === 'read_write' && (
                    <View
                      style={[
                        styles.radioButtonInner,
                        { backgroundColor: 'white' },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.accessLevelInfo}>
                  <Text
                    style={[
                      styles.accessLevelTitle,
                      { color: colors.text, fontFamily: fonts.medium },
                    ]}
                  >
                    Read & Write
                  </Text>
                  <Text
                    style={[
                      styles.accessLevelDesc,
                      { color: colors.textSecondary },
                    ]}
                  >
                    View, download, and add notes
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.cancelButton,
              { borderColor: colors.border },
            ]}
            onPress={handleCancel}
            disabled={isLoading}
          >
            <Text
              style={[
                styles.cancelButtonText,
                { color: colors.text },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.confirmButton,
              {
                backgroundColor: selectedDoctorId
                  ? colors.primary
                  : colors.disabled,
              },
            ]}
            onPress={handleConfirm}
            disabled={!selectedDoctorId || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Feather name="share-2" size={16} color="white" />
                <Text style={styles.confirmButtonText}>Share</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  closeButton: {
    padding: 8,
    marginLeft: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
  },
  doctorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 14,
    marginBottom: 2,
  },
  doctorEmail: {
    fontSize: 12,
    marginBottom: 2,
  },
  specialization: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
  },
  accessLevelSection: {
    paddingBottom: 100,
  },
  accessLevelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accessLevelInfo: {
    flex: 1,
  },
  accessLevelTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  accessLevelDesc: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  confirmButton: {
    // backgroundColor applied via style prop
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
