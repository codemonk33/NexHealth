/**
 * Encryption Visualization Component
 * 
 * Shows real-time encryption progress with visual effects:
 * - Document preparation animation
 * - Encryption algorithm flow visualization
 * - Upload progress bar
 * - Status indicators and icons
 * - Cancel/retry options on error
 */

import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Progress from 'react-native-progress';
import { MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface UploadingDocument {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'preparing' | 'encrypting' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface Props {
  uploadingDocument: UploadingDocument;
  onClose: () => void;
}

const STAGES = [
  { key: 'preparing', label: 'Preparing', icon: 'file-document' },
  { key: 'encrypting', label: 'Encrypting', icon: 'lock' },
  { key: 'uploading', label: 'Uploading', icon: 'cloud-upload' },
  { key: 'processing', label: 'Processing', icon: 'server' },
  { key: 'complete', label: 'Complete', icon: 'check-circle' },
];

export default function EncryptionVisualization({
  uploadingDocument,
  onClose,
}: Props) {
  const [animatedValue] = useState(new Animated.Value(0));
  const [particles, setParticles] = useState<{ id: number; x: Animated.Value; opacity: Animated.Value }[]>([]);

  // Generate encryption particle animation
  useEffect(() => {
    if (uploadingDocument.status === 'encrypting') {
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: new Animated.Value(0),
        opacity: new Animated.Value(1),
      }));

      setParticles(newParticles);

      // Animate particles
      newParticles.forEach((particle, index) => {
        Animated.sequence([
          Animated.delay(index * 30),
          Animated.parallel([
            Animated.timing(particle.x, {
              toValue: width - 32,
              duration: 2000,
              useNativeDriver: false,
            }),
            Animated.sequence([
              Animated.timing(particle.opacity, {
                toValue: 0,
                duration: 1500,
                delay: 500,
                useNativeDriver: false,
              }),
            ]),
          ]),
        ]).start();
      });
    }
  }, [uploadingDocument.status]);

  /**
   * Determine if a stage is active
   */
  const isStageActive = (stageKey: string): boolean => {
    const stages = STAGES.map((s) => s.key);
    const currentStageIndex = stages.indexOf(uploadingDocument.status);
    const stageIndex = stages.indexOf(stageKey);

    return stageIndex <= currentStageIndex;
  };

  /**
   * Determine if a stage is completed
   */
  const isStageCompleted = (stageKey: string): boolean => {
    const stages = STAGES.map((s) => s.key);
    const currentStageIndex = stages.indexOf(uploadingDocument.status);
    const stageIndex = stages.indexOf(stageKey);

    return stageIndex < currentStageIndex;
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * Get stage status color
   */
  const getStageColor = (stageKey: string): string => {
    if (isStageCompleted(stageKey)) return '#4CAF50';
    if (isStageActive(stageKey)) return '#2196F3';
    return '#CCC';
  };

  /**
   * Get status message
   */
  const getStatusMessage = (): string => {
    switch (uploadingDocument.status) {
      case 'preparing':
        return 'Preparing your document...';
      case 'encrypting':
        return 'Encrypting with ChaCha20-Poly1305...';
      case 'uploading':
        return `Uploading encrypted file (${Math.round(uploadingDocument.progress * 100)}%)...`;
      case 'processing':
        return 'Server processing...';
      case 'complete':
        return 'Upload complete!';
      case 'error':
        return uploadingDocument.error || 'An error occurred';
      default:
        return 'Processing...';
    }
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" />

        {/* Semi-transparent background */}
        <View style={styles.backdrop} />

        {/* Modal Content */}
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Encrypting Your Document</Text>
            <Text style={styles.subtitle}>
              🔐 Zero-knowledge encryption in progress
            </Text>
          </View>

          {/* Document Info */}
          <View style={styles.documentInfo}>
            <MaterialCommunityIcons
              name="file-document"
              size={32}
              color="#2196F3"
            />
            <View style={styles.documentDetails}>
              <Text
                style={styles.documentName}
                numberOfLines={1}
              >
                {uploadingDocument.name}
              </Text>
              <Text style={styles.documentSize}>
                {formatFileSize(uploadingDocument.size)}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <Progress.Bar
              progress={uploadingDocument.progress}
              width={width - 64}
              height={8}
              color="#2196F3"
              borderColor="#E0E0E0"
              borderRadius={4}
              unfilledColor="#F0F0F0"
            />
            <Text style={styles.progressText}>
              {Math.round(uploadingDocument.progress * 100)}%
            </Text>
          </View>

          {/* Encryption Visualization */}
          {uploadingDocument.status === 'encrypting' && (
            <View style={styles.encryptionContainer}>
              {/* Particle effect */}
              {particles.map((particle) => (
                <Animated.View
                  key={particle.id}
                  style={[
                    styles.particle,
                    {
                      left: particle.x,
                      opacity: particle.opacity,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={12}
                    color="#2196F3"
                  />
                </Animated.View>
              ))}
            </View>
          )}

          {/* Stage Timeline */}
          <View style={styles.timeline}>
            {STAGES.map((stage, index) => (
              <View key={stage.key} style={styles.stageContainer}>
                {/* Stage Dot and Icon */}
                <View
                  style={[
                    styles.stageDot,
                    {
                      borderColor: getStageColor(stage.key),
                      backgroundColor: isStageCompleted(stage.key)
                        ? getStageColor(stage.key)
                        : isStageActive(stage.key)
                        ? '#E3F2FD'
                        : '#F5F5F5',
                    },
                  ]}
                >
                  {isStageCompleted(stage.key) ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={16}
                      color="#FFF"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={stage.icon}
                      size={14}
                      color={getStageColor(stage.key)}
                    />
                  )}
                </View>

                {/* Stage Label */}
                <Text
                  style={[
                    styles.stageLabel,
                    {
                      color: getStageColor(stage.key),
                      fontWeight: isStageActive(stage.key) ? '600' : '400',
                    },
                  ]}
                >
                  {stage.label}
                </Text>

                {/* Connector Line */}
                {index < STAGES.length - 1 && (
                  <View
                    style={[
                      styles.connector,
                      {
                        backgroundColor: isStageCompleted(stage.key)
                          ? '#4CAF50'
                          : '#E0E0E0',
                      },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Status Message */}
          <View style={styles.statusSection}>
            <Text style={styles.statusMessage}>{getStatusMessage()}</Text>

            {/* Encryption Algorithm Info */}
            {uploadingDocument.status === 'encrypting' && (
              <View style={styles.algorithmInfo}>
                <Text style={styles.algorithmLabel}>Using:</Text>
                <View style={styles.algorithmBadge}>
                  <Text style={styles.algorithmBadgeText}>ECDH P-256</Text>
                </View>
                <View style={styles.algorithmBadge}>
                  <Text style={styles.algorithmBadgeText}>ChaCha20-Poly1305</Text>
                </View>
              </View>
            )}
          </View>

          {/* Error State */}
          {uploadingDocument.status === 'error' && (
            <View style={styles.errorSection}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={48}
                color="#D32F2F"
              />
              <Text style={styles.errorTitle}>Upload Failed</Text>
              <Text style={styles.errorMessage}>
                {uploadingDocument.error}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onClose}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Success State */}
          {uploadingDocument.status === 'complete' && (
            <View style={styles.successSection}>
              <MaterialCommunityIcons
                name="check-circle"
                size={64}
                color="#4CAF50"
              />
              <Text style={styles.successTitle}>Upload Successful!</Text>
              <Text style={styles.successMessage}>
                Your document has been encrypted and uploaded securely
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel Button (during upload) */}
          {uploadingDocument.status !== 'complete' &&
            uploadingDocument.status !== 'error' && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <AntDesign name="close" size={20} color="#999" />
              </TouchableOpacity>
            )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: width - 32,
    padding: 24,
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F9FF',
    borderRadius: 8,
    marginBottom: 20,
    gap: 12,
  },
  documentDetails: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  documentSize: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  progressSection: {
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  encryptionContainer: {
    height: 60,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 24,
  },
  timeline: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stageContainer: {
    alignItems: 'center',
    flex: 1,
  },
  stageDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  connector: {
    position: 'absolute',
    height: 2,
    top: 18,
    left: '50%',
    right: '-50%',
    width: '100%',
    zIndex: -1,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statusMessage: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  algorithmInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  algorithmLabel: {
    fontSize: 12,
    color: '#999',
  },
  algorithmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  algorithmBadgeText: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: '600',
  },
  errorSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#D32F2F',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  successMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#D32F2F',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  closeButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
