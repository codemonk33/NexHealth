/**
 * DocumentListItem — Document Card Component
 * 
 * Displays:
 * - Document name + upload date
 * - File size + encryption status badge
 * - Doctors with access (shared count)
 * - Actions: share, revoke access, delete
 * 
 * Mobile-optimized for touch, shows confirmation dialogs for destructive actions.
 */

import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { useTheme } from '../../theme/useTheme';

export interface DocumentListItemProps {
  id: string;
  name: string;
  size: number; // bytes
  uploadedAt: string; // ISO 8601
  encryptionStatus: 'encrypted' | 'encrypted_shared' | 'pending';
  isEncrypted: boolean;
  sharedWith: {
    id: string;
    doctorId: string;
    doctorName: string;
    sharedAt: string;
    accessLevel: 'read' | 'read_write';
  }[];
  onShare: () => void;
  onRevokeAccess: (shareId: string, doctorName: string) => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export default function DocumentListItem({
  id,
  name,
  size,
  uploadedAt,
  encryptionStatus,
  isEncrypted,
  sharedWith,
  onShare,
  onRevokeAccess,
  onDelete,
  isLoading = false,
}: DocumentListItemProps) {
  const { colors, spacing, fonts } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeletingShareId, setIsDeletingShareId] = useState<string | null>(null);

  /**
   * Format file size to human-readable string (B, KB, MB)
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Format date to readable string
   */
  const formatDate = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  /**
   * Get encryption status display info
   */
  const getStatusInfo = () => {
    switch (encryptionStatus) {
      case 'encrypted_shared':
        return {
          color: colors.success,
          icon: 'lock-check',
          label: `Encrypted & Shared (${sharedWith.length})`,
        };
      case 'encrypted':
        return {
          color: colors.success,
          icon: 'lock',
          label: 'Encrypted',
        };
      case 'pending':
        return {
          color: colors.warning,
          icon: 'clock',
          label: 'Processing...',
        };
      default:
        return {
          color: colors.disabled,
          icon: 'alert-circle',
          label: 'Unknown',
        };
    }
  };

  const statusInfo = getStatusInfo();

  /**
   * Handle revoke access with confirmation
   */
  const handleRevokeAccess = (shareId: string, doctorName: string) => {
    Alert.alert(
      'Revoke Access',
      `Remove ${doctorName}'s access to "${name}"?`,
      [
        {
          text: 'Cancel',
          onPress: () => setIsDeletingShareId(null),
          style: 'cancel',
        },
        {
          text: 'Revoke',
          onPress: () => {
            setIsDeletingShareId(shareId);
            onRevokeAccess(shareId, doctorName);
          },
          style: 'destructive',
        },
      ]
    );
  };

  /**
   * Handle delete with confirmation
   */
  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      `Permanently delete "${name}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: onDelete,
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Main Card */}
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => setIsExpanded(!isExpanded)}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {/* Header: Icon + Name + Status */}
        <View style={styles.header}>
          <View style={styles.fileInfo}>
            <MaterialCommunityIcons
              name="file-document"
              size={24}
              color={colors.text}
            />
            <View style={styles.nameContainer}>
              <Text
                style={[
                  styles.fileName,
                  { color: colors.text, fontFamily: fonts.medium },
                ]}
                numberOfLines={2}
              >
                {name}
              </Text>
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {formatFileSize(size)} • {formatDate(uploadedAt)}
              </Text>
            </View>
          </View>

          {/* Encryption Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusInfo.color}20` },
            ]}
          >
            <MaterialCommunityIcons
              name={statusInfo.icon}
              size={14}
              color={statusInfo.color}
            />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>

          {/* Expand Arrow */}
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.textSecondary}
            style={styles.expandIcon}
          />
        </View>

        {/* Expanded Content: Shares + Actions */}
        {isExpanded && (
          <View
            style={[
              styles.expandedContent,
              { borderTopColor: colors.border },
            ]}
          >
            {/* Shares Section */}
            {sharedWith.length > 0 ? (
              <View style={styles.sharesSection}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, fontFamily: fonts.medium },
                  ]}
                >
                  Shared With ({sharedWith.length})
                </Text>

                <FlatList
                  data={sharedWith}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.shareRow,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <View style={styles.shareInfo}>
                        <Text
                          style={[
                            styles.doctorName,
                            { color: colors.text, fontFamily: fonts.medium },
                          ]}
                        >
                          Dr. {item.doctorName}
                        </Text>
                        <View style={styles.accessLevelContainer}>
                          <Text style={[styles.accessLevel, { color: colors.textSecondary }]}>
                            {item.accessLevel === 'read_write'
                              ? 'Read & Write'
                              : 'Read Only'}
                          </Text>
                          <Text style={[styles.sharedDate, { color: colors.textSecondary }]}>
                            {formatDate(item.sharedAt)}
                          </Text>
                        </View>
                      </View>

                      {/* Revoke Button */}
                      <TouchableOpacity
                        style={styles.revokeButton}
                        onPress={() =>
                          handleRevokeAccess(item.id, item.doctorName)
                        }
                        disabled={isDeletingShareId === item.id}
                      >
                        {isDeletingShareId === item.id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <Feather
                            name="x-circle"
                            size={18}
                            color={colors.error}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </View>
            ) : (
              <View style={styles.emptySharesContainer}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={[styles.emptySharesText, { color: colors.textSecondary }]}>
                  Not shared with any doctors yet
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={[styles.actionsContainer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { borderColor: colors.primary },
                ]}
                onPress={onShare}
                disabled={isLoading}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                  Share
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.deleteButton,
                  { borderColor: colors.error },
                ]}
                onPress={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={18}
                    color={colors.error}
                  />
                )}
                <Text style={[styles.actionButtonText, { color: colors.error }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  statusLabel: {
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '600',
  },
  expandIcon: {
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  sharesSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  shareInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 13,
    marginBottom: 4,
  },
  accessLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accessLevel: {
    fontSize: 11,
    marginRight: 8,
  },
  sharedDate: {
    fontSize: 11,
  },
  revokeButton: {
    padding: 6,
  },
  emptySharesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptySharesText: {
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  deleteButton: {
    // Styling applied via borderColor prop
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
