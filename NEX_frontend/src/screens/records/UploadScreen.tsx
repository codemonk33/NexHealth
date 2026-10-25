import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, FileText, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useUploadRecord } from '../../api/recordsApi';

const MAX_SIZE_MB = 10;

export function UploadScreen() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const uploadRecord = useUploadRecord();

  const simulateUpload = async (file: { uri: string; name: string; type: string; size: number }) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      Alert.alert('File too large', `Maximum allowed file size is ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadState('uploading');
    setUploadProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + 10;
      });
    }, 200);

    try {
      await uploadRecord.mutateAsync({ file, recordType: 'LAB_RESULT' });
      clearInterval(interval);
      setUploadProgress(100);
      setUploadState('success');
      setTimeout(() => setUploadState('idle'), 3000);
    } catch {
      clearInterval(interval);
      setUploadState('error');
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      simulateUpload({ uri: asset.uri, name: 'capture.jpg', type: 'image/jpeg', size: asset.fileSize ?? 500000 });
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      simulateUpload({ uri: asset.uri, name: asset.fileName ?? 'image.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? 500000 });
    }
  };

  const handleDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      simulateUpload({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf', size: asset.size ?? 1000000 });
    }
  };

  const OPTIONS = [
    { id: 'camera', label: 'Camera Capture', sub: 'With edge detection', emoji: '📷', onPress: handleCamera, color: Colors.royalBlue },
    { id: 'gallery', label: 'Photo Library', sub: 'JPG, PNG up to 10MB', emoji: '🖼️', onPress: handleGallery, color: Colors.teal },
    { id: 'document', label: 'PDF / Document', sub: 'Discharge, Lab Reports', emoji: '📄', onPress: handleDocument, color: Colors.orange },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[Colors.white, Colors.background]} style={styles.header}>
        <Text style={styles.headerTitle}>Upload Record</Text>
        <Text style={styles.headerSub}>Scan or upload your medical documents</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Options */}
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            id={`btn-upload-${opt.id}`}
            onPress={opt.onPress}
            disabled={uploadState === 'uploading'}
            activeOpacity={0.85}
            style={styles.optionCard}
          >
            <View style={[styles.optionIconBg, { backgroundColor: opt.color + '20' }]}>
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionSub}>{opt.sub}</Text>
            </View>
            <View style={[styles.optionArrow, { backgroundColor: opt.color }]}>
              <Text style={styles.optionArrowText}>→</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Progress */}
        {uploadState === 'uploading' && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Uploading & Processing...</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Success */}
        {uploadState === 'success' && (
          <View style={styles.successContainer}>
            <CheckCircle2 size={40} color={Colors.success} strokeWidth={2} />
            <Text style={styles.successTitle}>Upload Complete!</Text>
            <Text style={styles.successSub}>Your record has been processed with AI analysis.</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            🔒 All files are encrypted end-to-end and stored in your private ABHA-linked health locker.
            Supported: PDF, JPG, PNG · Max 10MB
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  content: { padding: Spacing.xl, gap: Spacing.md },
  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    ...Shadows.sm,
  },
  optionIconBg: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: { fontSize: 28 },
  optionText: { flex: 1 },
  optionLabel: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  optionSub: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  optionArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionArrowText: { color: Colors.white, fontSize: 18, fontFamily: Typography.fontFamily.bold },
  progressContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  progressLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.teal,
    textAlign: 'right',
  },
  successContainer: {
    backgroundColor: Colors.successBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.success,
  },
  successSub: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  infoBanner: {
    backgroundColor: Colors.tealBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.tealDark,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
});
