/**
 * UploadProgressModal — Document Upload Progress Display
 * 
 * Displays:
 * - File name and size
 * - Upload progress bar (0-100%)
 * - Current stage (preparing → encrypting → uploading → processing)
 * - Stage timeline with icons
 * - Cancel button (if cancelable)
 * - Error state with retry option
 * 
 * Mobile-optimized modal overlay with clear visual feedback.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Progress from 'react-native-progress';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../../theme/useTheme';

type UploadStage = 'preparing' | 'encrypting' | 'uploading' | 'processing' | 'complete' | 'error';

export interface UploadProgressModalProps {
  visible: boolean;
  fileName: string;
  fileSize: number;
  progress: number; // 0-100
  stage: UploadStage;
  errorMessage?: string | null;
  isCancelable?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}

export default function UploadProgressModal({
  visible,
  fileName,
  fileSize,
  progress,
  stage,
  errorMessage,
  isCancelable = true,
  onCancel,
  onRetry,
}: UploadProgressModalProps) {
  const { colors, fonts } = useTheme();

  /**
   * Format file size to human-readable string
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Get stage display info
   */
  const getStageInfo = (s: UploadStage) => {
    switch (s) {
      case 'preparing':
        return {
          icon: 'file-document',
          label: 'Preparing file...',
          color: colors.textSecondary,
        };
      case 'encrypting':
        return {
          icon: 'lock',
          label: 'Encrypting with ChaCha20-Poly1305...',
          color: colors.warning,
        };
      case 'uploading':
        return {
          icon: 'cloud-upload',
          label: 'Uploading to secure server...',
          color: colors.primary,
        };
      case 'processing':
        return {
          icon: 'server',
          label: 'Processing on server...',
          color: colors.primary,
        };
      case 'complete':
        return {
          icon: 'check-circle',
          label: 'Upload complete!',
          color: colors.success,
        };
      case 'error':
        return {
          icon: 'alert-circle',
          label: 'Upload failed',
          color: colors.error,
        };
      default:
        return {
          icon: 'help-circle',
          label: 'Unknown stage',
          color: colors.textSecondary,
        };
    }
  };

  const stageInfo = getStageInfo(stage);

  /**
   * Stages timeline data
   */
  const stages: { id: UploadStage; label: string; icon: string }[] = [
    { id: 'preparing', label: 'Preparing', icon: 'file-document' },
    { id: 'encrypting', label: 'Encrypting', icon: 'lock' },
    { id: 'uploading', label: 'Uploading', icon: 'cloud-upload' },
    { id: 'processing', label: 'Processing', icon: 'server' },
  ];

  /**
   * Get progress percentage for each stage
   */
  const getStageProgress = (stageId: UploadStage): number => {
    const stageIndex = stages.findIndex((s) => s.id === stageId);
    if (stageIndex === -1) return 0;

    // Each stage gets roughly 25% of total progress
    const stageStart = (stageIndex / stages.length) * 100;
    const stageEnd = ((stageIndex + 1) / stages.length) * 100;
    const stageDuration = stageEnd - stageStart;

    if (stage === stageId) {
      // Current stage: use actual progress within this stage
      const currentStageProgress = progress - stageStart;
      return Math.min(
        100,
        (currentStageProgress / stageDuration) * 100
      );
    } else if (stageIndex < stages.findIndex((s) => s.id === stage)) {
      // Completed stages: 100%
      return 100;
    } else {
      // Future stages: 0%
      return 0;
    }
  };

  /**
   * Determine if error state
   */
  const isError = stage === 'error';
  const isComplete = stage === 'complete';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            {isError ? (
              <MaterialCommunityIcons
                name="alert-circle"
                size={28}
                color={colors.error}
              />
            ) : isComplete ? (
              <MaterialCommunityIcons
                name="check-circle"
                size={28}
                color={colors.success}
              />
            ) : (
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
            )}

            <View style={styles.headerText}>
              <Text
                style={[
                  styles.fileName,
                  { color: colors.text, fontFamily: fonts.medium },
                ]}
                numberOfLines={1}
              >
                {fileName}
              </Text>
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {formatFileSize(fileSize)}
              </Text>
            </View>
          </View>

          {/* Status Message */}
          <View
            style={[
              styles.statusContainer,
              {
                backgroundColor: isError
                  ? `${colors.error}15`
                  : isComplete
                    ? `${colors.success}15`
                    : `${colors.primary}15`,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={stageInfo.icon}
              size={16}
              color={stageInfo.color}
              style={styles.statusIcon}
            />
            <Text
              style={[
                styles.statusText,
                { color: stageInfo.color },
              ]}
            >
              {stageInfo.label}
            </Text>
          </View>

          {/* Error Message */}
          {isError && errorMessage && (
            <View
              style={[
                styles.errorBox,
                { borderColor: colors.error },
              ]}
            >
              <Text
                style={[
                  styles.errorMessageText,
                  { color: colors.error },
                ]}
              >
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          {!isComplete && !isError && (
            <View style={styles.progressContainer}>
              <Progress.Bar
                progress={progress / 100}
                width={null}
                height={6}
                color={colors.primary}
                unfilledColor={colors.border}
                borderWidth={0}
                borderRadius={3}
              />
              <Text
                style={[
                  styles.progressText,
                  { color: colors.textSecondary },
                ]}
              >
                {Math.round(progress)}%
              </Text>
            </View>
          )}

          {/* Stages Timeline */}
          {!isError && !isComplete && (
            <View style={styles.stagesContainer}>
              {stages.map((s, index) => {
                const stageProgress = getStageProgress(s.id);
                const isCurrentStage = stage === s.id;
                const isCompletedStage = 
                  stages.findIndex((st) => st.id === stage) > index;

                return (
                  <View key={s.id} style={styles.stageItem}>
                    {/* Stage Circle */}
                    <View
                      style={[
                        styles.stageCircle,
                        {
                          borderColor: isCurrentStage
                            ? colors.primary
                            : isCompletedStage
                              ? colors.success
                              : colors.border,
                          backgroundColor: isCompletedStage
                            ? colors.success
                            : colors.surface,
                        },
                      ]}
                    >
                      {isCompletedStage ? (
                        <Feather
                          name="check"
                          size={12}
                          color="white"
                        />
                      ) : isCurrentStage ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name={s.icon}
                          size={12}
                          color={colors.textSecondary}
                        />
                      )}
                    </View>

                    {/* Stage Label & Progress */}
                    <View style={styles.stageInfo}>
                      <Text
                        style={[
                          styles.stageLabel,
                          {
                            color: isCurrentStage
                              ? colors.primary
                              : colors.text,
                            fontFamily: isCurrentStage
                              ? fonts.medium
                              : fonts.regular,
                          },
                        ]}
                      >
                        {s.label}
                      </Text>
                      {isCurrentStage && (
                        <Text
                          style={[
                            styles.stageProgress,
                            { color: colors.primary },
                          ]}
                        >
                          {Math.round(stageProgress)}%
                        </Text>
                      )}
                    </View>

                    {/* Connecting Line */}
                    {index < stages.length - 1 && (
                      <View
                        style={[
                          styles.stageLine,
                          {
                            backgroundColor: isCompletedStage
                              ? colors.success
                              : colors.border,
                          },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isError && onRetry ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={onRetry}
              >
                <Feather name="refresh-cw" size={16} color="white" />
                <Text style={styles.actionButtonText}>Retry</Text>
              </TouchableOpacity>
            ) : isComplete ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.success },
                ]}
                onPress={onCancel}
              >
                <Feather name="check" size={16} color="white" />
                <Text style={styles.actionButtonText}>Done</Text>
              </TouchableOpacity>
            ) : isCancelable ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={onCancel}
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
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    minWidth: 280,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorMessageText: {
    fontSize: 11,
    lineHeight: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    marginTop: 6,
    fontSize: 11,
    textAlign: 'right',
  },
  stagesContainer: {
    marginBottom: 16,
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageInfo: {
    flex: 1,
    marginLeft: 10,
  },
  stageLabel: {
    fontSize: 12,
  },
  stageProgress: {
    fontSize: 10,
    marginTop: 2,
  },
  stageLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    width: 1,
    height: 8,
  },
  actions: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
