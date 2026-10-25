// ─── Auth Types ─────────────────────────────────────────────────────────────

// Backend response types (snake_case as per FastAPI)
export interface TokenResponseBackend {
  access_token: string;
  refresh_token?: string;
  token_type: 'bearer';
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  requires_2fa?: boolean;
}

// Patient profile response from /api/v1/patients/me
export interface PatientOut {
  model_config?: { from_attributes: boolean };
  id: string;
  user_id: string;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_at: string;
  updated_at?: string;
}

// User profile response from /api/v1/patients/me merged with UserOut
export interface UserOut {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  is_active: boolean;
  is_locked: boolean;
  is_2fa_enabled: boolean;
  created_at: string;
  // Patient fields (from merged endpoint)
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

// Frontend authentication request/response (camelCase, transformed)
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  email?: string;
  abhaId?: string;
  abhaAddress?: string;
  avatar?: string;
  dob?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  is2faEnabled?: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  requires2fa?: boolean;
  txnId?: string;
}

// Login/Register request payloads
export interface LoginRequest {
  phone: string; // E.164 format: +919876543210
  password: string;
}

export interface RegisterRequest {
  name: string;
  phone: string; // E.164 format: +919876543210
  password: string;
  email?: string;
  role?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}

// OTP-based auth (Phase 2/3)
export interface RequestAbhaOtpPayload {
  abhaId: string;
}

export interface VerifyAbhaOtpPayload {
  abhaId: string;
  otp: string;
  txnId: string;
}

export interface LoginWithPhonePayload {
  phone: string;
}

export interface VerifyPhoneOtpPayload {
  phone: string;
  otp: string;
  txnId: string;
}

export interface OtpResponse {
  txnId: string;
  message: string;
  expiresIn: number; // seconds
}

// ─── Vitals / Wearable Types ─────────────────────────────────────────────────
export interface VitalMetric {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  timestamp: string;
}

export interface HealthScore {
  score: number;
  maxScore: number;
  label: string;
  lastUpdated: string;
}

export interface WearableDevice {
  id: string;
  name: string;
  type: 'APPLE_HEALTH' | 'GOOGLE_HEALTH' | 'FITBIT' | 'SAMSUNG' | 'GARMIN' | 'OTHER';
  connected: boolean;
  lastSync?: string;
}

export interface HealthData {
  score: HealthScore;
  steps: VitalMetric;
  heartRate: VitalMetric;
  sleep: VitalMetric;
  bloodOxygen?: VitalMetric;
  calories?: VitalMetric;
  history: HealthHistoryPoint[];
}

export interface HealthHistoryPoint {
  date: string;
  steps: number;
  heartRate: number;
  sleepHours: number;
}

// ─── Records Types ────────────────────────────────────────────────────────────
export type RecordType = 'LAB_RESULT' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'RADIOLOGY' | 'VACCINATION';

export interface MedicalRecord {
  id: string;
  title: string;
  type: RecordType;
  date: string;
  doctor?: string;
  hospital?: string;
  thumbnailUrl?: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  tags?: string[];
}

export interface UploadRecordPayload {
  file: {
    uri: string;
    name: string;
    type: string;
    size: number;
  };
  recordType: RecordType;
}

export interface UploadRecordResponse {
  recordId: string;
  status: 'QUEUED' | 'UPLOADING' | 'PROCESSING' | 'DONE';
  progress: number;
}

export interface OcrParseStatus {
  recordId: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  extractedText?: string;
  summary?: string;
}

// ─── Diagnostics / Lab Tests Types ───────────────────────────────────────────
export type TestCategory =
  | 'FULL_BODY'
  | 'FEVER'
  | 'THYROID'
  | 'DIABETES'
  | 'CARDIAC'
  | 'ALLERGY'
  | 'HAIR_SKIN'
  | 'WOMENS_HEALTH'
  | 'KIDNEY'
  | 'LIVER';

export interface LabTest {
  id: string;
  name: string;
  category: TestCategory;
  description: string;
  price: number;
  discountedPrice?: number;
  fasting: boolean;
  sampleType: 'BLOOD' | 'URINE' | 'STOOL' | 'SWAB' | 'MULTIPLE';
  turnaroundHours: number;
  includes?: string[];
  aiPowered: boolean;
  popular?: boolean;
}

export interface LabPartner {
  id: string;
  name: string;
  logo?: string;
  rating: number;
  reviewCount: number;
  address: string;
  timings: string;
  nabl: boolean;
  cap: boolean;
  homeCollection: boolean;
  price: number;
  discountedPrice?: number;
}

export interface LabSearchResult {
  test: LabTest;
  labs: LabPartner[];
}

export interface BookLabTestPayload {
  testId: string;
  labId: string;
  date: string;
  timeSlot: string;
  address?: string;
  homeCollection: boolean;
  patientName: string;
  patientAge: number;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
}

export interface BookingConfirmation {
  bookingId: string;
  status: 'CONFIRMED' | 'PENDING';
  date: string;
  timeSlot: string;
  labName: string;
  testName: string;
  totalAmount: number;
}

// ─── Pharmacy / Medicine Types ────────────────────────────────────────────────
export type MedicineCategory =
  | 'VITAMINS'
  | 'DAILY_ESSENTIALS'
  | 'CARDIAC'
  | 'DIABETES'
  | 'PAIN_RELIEF'
  | 'ANTIBIOTICS'
  | 'COLD_FLU'
  | 'DIGESTIVE';

export interface Medicine {
  id: string;
  name: string;
  brand: string;
  generic?: string;
  category: MedicineCategory;
  packSize: string;
  price: number;
  discountedPrice?: number;
  discountPercent?: number;
  imageUrl?: string;
  requiresPrescription: boolean;
  inStock: boolean;
  description?: string;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
}

export interface PlaceOrderPayload {
  items: { medicineId: string; quantity: number }[];
  prescriptionId?: string;
  deliveryAddress: string;
  paymentMethod: 'COD' | 'UPI' | 'CARD';
}

export interface Order {
  orderId: string;
  status: 'PLACED' | 'CONFIRMED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  items: CartItem[];
  totalAmount: number;
  estimatedDelivery: string;
  trackingUrl?: string;
  createdAt: string;
}

// ─── Smart Reminders Types ────────────────────────────────────────────────────
export interface MedicationReminder {
  id: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  status: 'UPCOMING' | 'TAKEN' | 'MISSED' | 'SKIPPED';
  refillLeft?: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  abhaId?: string;
  alertActive?: boolean;
  alertMessage?: string;
}

// ─── API Generic Wrappers ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, string>;
}

// ─── Encryption / Keypair Types ───────────────────────────────────────────────

/**
 * Response from GET /encryption/keypairs/registration-challenge
 *
 * The nonce must be signed with the private key being registered
 * (proof of possession) and included in POST /keypairs/register.
 * It is single-use and expires after `expires_in` seconds.
 */
export interface RegistrationChallenge {
  /** 64-char lowercase hex nonce generated by the server CSPRNG */
  nonce: string;
  /** Seconds until this nonce expires (typically 60) */
  expires_in: number;
  /** ISO timestamp when the nonce was created */
  issued_at: string;
}

/**
 * Response from GET /encryption/keypairs/me and POST /encryption/keypairs/register.
 * Contains ONLY the public key metadata — private key is NEVER returned by the server.
 */
export interface KeypairResponse {
  id: string;
  user_id: string;
  /**
   * SHA-256 hex of the public key DER bytes — 64 hex chars.
   * Returned for UI display only. Server-side lookups use the keyed HMAC commitment.
   */
  public_key_fingerprint: string;
  key_algorithm: 'ECDH_P256';
  created_at: string;
  is_revoked: boolean;
  revoked_at?: string | null;
}

/**
 * Payload for POST /encryption/keypairs/register
 *
 * Includes a challenge-response proof-of-possession to prevent key substitution:
 *   1. Client calls GET /keypairs/registration-challenge to get a server nonce
 *   2. Client signs the nonce with the private key being registered (ECDSA-SHA-256)
 *   3. Backend verifies the signature against the submitted public key
 *      → confirms caller holds the corresponding private key
 *
 * The private key itself is NEVER transmitted.
 */
export interface RegisterPublicKeyPayload {
  /** SPKI PEM-encoded ECDH P-256 public key — device-generated */
  publicKeyPEM: string;
  /**
   * SHA-256 hex fingerprint (unkeyed) — for UI display only.
   * Backend stores a keyed HMAC commitment, not this raw value.
   */
  displayFingerprint: string;
  /** Single-use nonce from GET /keypairs/registration-challenge */
  nonce: string;
  /**
   * ECDSA-SHA-256 signature of nonce bytes (UTF-8 encoded), base64url.
   * Web Crypto output format: IEEE P1363 (raw r∥s, 64 bytes for P-256).
   * Server must verify: ECDSA.verify(public_key, nonce.encode('utf-8'), signature)
   */
  nonceSignature: string;
}

/**
 * Response from POST /encryption/sessions
 * Session key itself is never returned — only metadata and its hash.
 */
export interface SessionKeyResponse {
  id: string;
  patient_id: string;
  doctor_id: string;
  /** SHA-256 hex of the plaintext session key — for integrity verification */
  session_key_hash: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
}

/** Single item in GET /encryption/sessions and GET /encryption/sessions/as-doctor */
export interface SessionListItem {
  id: string;
  patient_id: string;
  doctor_id?: string;
  session_key_hash: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
}

/** Input for POST /encryption/sessions */
export interface CreateSessionPayload {
  doctor_id: string;
  /** Access duration in days — backend enforces 1–90 range */
  ttl_days: number;
}

/**
 * Full response from GET /encryption/sessions/{id}/encrypted-key
 * This is the payload the client decrypts locally (Phase 3A — zero-knowledge).
 */
export interface EncryptedSessionKeyPayload {
  session_id: string;
  patient_id: string;
  doctor_id: string;
  /** Base64-encoded ChaCha20-Poly1305 ciphertext (NOT including the auth tag) */
  encrypted_key: string;
  /** Base64-encoded 12-byte ChaCha20 nonce */
  nonce: string;
  /** Base64-encoded 16-byte Poly1305 authentication tag */
  auth_tag: string;
  /** PEM-encoded ephemeral ECDH P-256 public key used during encryption */
  ephemeral_public_key: string;
  /** SHA-256 hex of the plaintext session key — 64 chars — for client-side integrity check */
  session_key_hash: string;
  expires_at: string;
}

/**
 * Encrypted public key blob from GET /encryption/doctors/{doctor_id}/public-key
 * This is an encrypted PEM stored server-side that the client must decrypt.
 *
 * Format: {"v": 1, "ct": "base64url", "n": "base64url", "a": "AES-256-GCM"}
 *   • v  — version (1)
 *   • ct — base64url-encoded AES-256-GCM ciphertext
 *   • n  — base64url-encoded 12-byte nonce
 *   • a  — algorithm name ("AES-256-GCM")
 *
 * Decryption uses HKDF-SHA256(ikm=registration_signature, salt=doctor_id_bytes)
 * to derive the encryption key on-device.
 */
export interface EncryptedPublicKeyBlob {
  v: number;  // version
  ct: string; // base64url ciphertext
  n: string;  // base64url nonce
  a: string;  // algorithm (AES-256-GCM)
}

/** Audit log entry from GET /encryption/audit/logs */
export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_type: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';
  action: string;
  resource_type: string;
  resource_id: string;
  status: 'SUCCESS' | 'FAILED' | 'DENIED';
  status_message?: string | null;
  ip_address?: string;
  event_data?: Record<string, unknown>;
  created_at: string;
}


// ─── Phase 2: Health Data Integration Types ─────────────────────────────────

// Backend daily health record (raw response from /api/v1/daily-health)
export interface DailyHealthRecord {
  record_date: string;  // YYYY-MM-DD
  health_score: number | null;
  step_count: number | null;
  sleep_hours: number | null;
  heart_rate: number | null;
  blood_oxygen: number | null;
}

// Wearable device from backend (/api/v1/wearables)
export interface WearableDeviceBackend {
  id: string;
  user_id: string;
  name: string;
  type: 'APPLE_HEALTH' | 'GOOGLE_HEALTH' | 'FITBIT' | 'SAMSUNG' | 'GARMIN' | 'OTHER';
  connected: boolean;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

// Step log for ingestion (to POST /api/v1/steps)
export interface StepLog {
  step_count: number;  // ≥ 0
  date_time_from: string;  // ISO8601
  date_time_to: string;    // ISO8601
}

// Sleep record for ingestion (to POST /api/v1/sleep)
export interface SleepRecord {
  period_from: string;  // ISO8601 (alias: "from")
  period_to: string;    // ISO8601 (alias: "to")
  sleep_type?: 'main' | 'nap';  // default: "main"
}

// Medication info nested in reminder
export interface MedicationInfo {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
}

// Reminder with computed status and medication details
export interface MedicationReminder {
  id: string;
  medication_id: string;
  medication: MedicationInfo;
  time: string;  // HH:MM:SS
  frequency: string;  // DAILY, WEEKLY, CUSTOM
  days_of_week: string | null;
  priority: 'ROUTINE' | 'NORMAL' | 'URGENT';
  is_active: boolean;
  status: 'UPCOMING' | 'OVERDUE' | 'DONE' | 'MISSED' | 'SKIPPED' | null;
  created_at: string;
  updated_at: string;
}

// Reminder log entry
export interface ReminderLogEntry {
  id: string;
  reminder_id: string;
  scheduled_date: string;  // YYYY-MM-DD
  status: 'TAKEN' | 'MISSED' | 'SKIPPED';
  logged_at: string | null;
}
