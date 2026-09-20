import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import countries from 'country-list';
import {
  User,
  Mail,
  Lock,
  Shield,
  Globe,
  Clock,
  Camera,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Sparkles,
  Info,
  KeyRound,
  Smartphone,
  Laptop,
  Trash2,
  Download,
  UserX,
  Copy,
  CheckCheck,
  QrCode,
  AlertTriangle,
  Bell,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import UserAvatar from '../components/UserAvatar';
import BlobatarPicker from '../components/BlobatarPicker';
import {
  updateProfileApi,
  uploadAvatarApi,
  setAvatarSeedApi,
  changePasswordApi,
  requestEmailChangeApi,
  confirmEmailChangeApi,
  getSessionsApi,
  revokeSessionApi,
  setup2FAApi,
  enable2FAApi,
  disable2FAApi,
  getPreferencesApi,
  updatePreferencesApi,
  getBlockedUsersApi,
  unblockUserApi,
  scheduleAccountDeletionApi,
  cancelAccountDeletionApi,
  exportUserDataApi,
} from '../api/auth';

const allCountries = countries.getData().sort((a, b) => a.name.localeCompare(b.name));

const languageOptions = [
  { code: 'en', label: 'English (Academic Standard)' },
  { code: 'es', label: 'Español (Historia)' },
  { code: 'fr', label: 'Français (Histoire)' },
  { code: 'de', label: 'Deutsch (Geschichte)' },
  { code: 'it', label: 'Italiano (Storia)' },
  { code: 'la', label: 'Latina (Classical Antiquity)' },
];

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'privacy'

  // Profile Form State
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [countryCode, setCountryCode] = useState(user?.country_code || '');
  const [pronouns, setPronouns] = useState(user?.pronouns || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.show_online_status ?? true);
  const [profileVisibility, setProfileVisibility] = useState(user?.profile_visibility || 'public');

  // Avatar Upload State
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingSeed, setSavingSeed] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security - Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Security - Email
  const [newEmail, setNewEmail] = useState('');
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  // URL Email Confirm Token State
  const confirmToken = searchParams.get('confirm_email_token');
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [emailConfirmResult, setEmailConfirmResult] = useState(null);

  // Security - Active Sessions
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  // Security - 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled ?? false);
  const [settingUp2FA, setSettingUp2FA] = useState(false);
  const [setupData2FA, setSetupData2FA] = useState(null); // { secret, otpauth_url, backup_codes }
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [enabling2FA, setEnabling2FA] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disablePasswordInput, setDisablePasswordInput] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);

  // Privacy & Preferences
  const [theme, setTheme] = useState(user?.preferences?.theme || 'system');
  const [language, setLanguage] = useState(user?.preferences?.language || 'en');
  const [notificationPrefs, setNotificationPrefs] = useState({
    friend_requests: true,
    quiz_challenges: true,
    group_discussions: true,
    daily_fact: true,
    system: true,
    ...(user?.preferences?.notification_prefs || {}),
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Blocked Users
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // Data Export & Deletion
  const [exportingData, setExportingData] = useState(false);
  const [schedulingDeletion, setSchedulingDeletion] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [deletionScheduledAt, setDeletionScheduledAt] = useState(user?.deletion_scheduled_at || null);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setBio(user.bio || '');
      setCountryCode(user.country_code || '');
      setPronouns(user.pronouns || '');
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setShowOnlineStatus(user.show_online_status ?? true);
      setProfileVisibility(user.profile_visibility || 'public');
      setTwoFactorEnabled(user.two_factor_enabled ?? false);
      setDeletionScheduledAt(user.deletion_scheduled_at || null);
      if (user.preferences) {
        if (user.preferences.theme) setTheme(user.preferences.theme);
        if (user.preferences.language) setLanguage(user.preferences.language);
        if (user.preferences.notification_prefs) {
          setNotificationPrefs((prev) => ({ ...prev, ...user.preferences.notification_prefs }));
        }
      }
    }
  }, [user]);

  // Load active sessions when Security tab is active
  useEffect(() => {
    if (activeTab === 'security') {
      fetchSessions();
    } else if (activeTab === 'privacy') {
      fetchBlockedUsers();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await getSessionsApi();
      setSessions(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load active sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const data = await getBlockedUsersApi();
      setBlockedUsers(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load blocked scholars');
    } finally {
      setLoadingBlocked(false);
    }
  };

  // Handle auto-confirmation if arrived with token in query params
  useEffect(() => {
    if (confirmToken && !emailConfirmResult && !confirmingEmail) {
      async function runConfirmation() {
        setConfirmingEmail(true);
        try {
          const res = await confirmEmailChangeApi(confirmToken);
          setEmailConfirmResult({ success: true, message: `Email successfully updated to ${res.email}` });
          updateUser({ email: res.email });
          toast.success('Email confirmed and updated!');
          searchParams.delete('confirm_email_token');
          setSearchParams(searchParams, { replace: true });
        } catch (err) {
          setEmailConfirmResult({ success: false, message: err.message || 'Verification token is invalid or expired' });
          toast.error(err.message || 'Failed to verify email token');
        } finally {
          setConfirmingEmail(false);
        }
      }
      runConfirmation();
    }
  }, [confirmToken]);

  const detectTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      setTimezone(detected);
      toast.info(`Timezone detected: ${detected}`);
    }
  };

  // Avatar select & upload
  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar file exceeds 5MB limit');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setUploadingAvatar(true);
    try {
      const res = await uploadAvatarApi(file);
      // Server clears avatar_seed on upload — the two avatar paths are mutually exclusive
      updateUser({ avatar_url: res.avatar_url, avatar_seed: null });
      toast.success('Avatar updated successfully!');
    } catch (err) {
      setAvatarPreview(null);
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Blobatar selection — no backend call happens until a candidate is actually chosen
  const handleSeedSelect = async (seed) => {
    setSavingSeed(true);
    try {
      const res = await setAvatarSeedApi(seed);
      updateUser({ avatar_seed: res.avatar_seed, avatar_url: res.avatar_url });
      setAvatarPreview(null);
      toast.success('Blobatar chosen! Your uploaded photo was replaced.');
    } catch (err) {
      toast.error(err.message || 'Failed to choose a Blobatar');
    } finally {
      setSavingSeed(false);
    }
  };

  // Online status visibility toggle (auto-saves on change)
  const handleToggleOnlineStatus = async (e) => {
    const next = e.target.checked;
    setShowOnlineStatus(next);
    try {
      await updateProfileApi({ show_online_status: next });
      updateUser({ show_online_status: next });
      toast.success(next ? 'You now appear online to friends.' : 'You now appear offline to everyone.');
    } catch (err) {
      setShowOnlineStatus(!next);
      toast.error(err.message || 'Failed to update online status');
    }
  };

  // Save timezone from the privacy tab
  const handleSaveTimezone = async () => {
    try {
      const updated = await updateProfileApi({ timezone });
      updateUser(updated);
      toast.success('Timezone saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to save timezone');
    }
  };

  // Save General Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = {
        username: username.trim(),
        bio: bio.trim(),
        country_code: countryCode || null,
        pronouns: pronouns.trim() || null,
        timezone,
        show_online_status: showOnlineStatus,
        profile_visibility: profileVisibility,
      };
      const updated = await updateProfileApi(payload);
      updateUser(updated);
      toast.success('Profile details saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await changePasswordApi({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully!');
    } catch (err) {
      toast.error(err.message || 'Current password incorrect or change failed');
    } finally {
      setChangingPassword(false);
    }
  };

  // Request Email Change
  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('New email is identical to current email');
      return;
    }

    setRequestingEmail(true);
    try {
      await requestEmailChangeApi({ new_email: newEmail.trim() });
      setEmailConfirmationSent(true);
      toast.success('Confirmation link sent! Check your inbox to confirm the change.');
    } catch (err) {
      toast.error(err.message || 'Failed to request email change');
    } finally {
      setRequestingEmail(false);
    }
  };

  // Session Revoke
  const handleRevokeSession = async (sessionId) => {
    setRevokingSessionId(sessionId);
    try {
      await revokeSessionApi(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to revoke session');
    } finally {
      setRevokingSessionId(null);
    }
  };

  // 2FA Setup
  const handleStart2FASetup = async () => {
    setSettingUp2FA(true);
    try {
      const data = await setup2FAApi();
      setSetupData2FA(data);
    } catch (err) {
      toast.error(err.message || 'Failed to initialize 2FA setup');
    } finally {
      setSettingUp2FA(false);
    }
  };

  // 2FA Enable
  const handleEnable2FA = async (e) => {
    e.preventDefault();
    if (!totpVerifyCode.trim() || totpVerifyCode.trim().length !== 6) {
      toast.error('Please enter a 6-digit authenticator code');
      return;
    }

    setEnabling2FA(true);
    try {
      await enable2FAApi(totpVerifyCode.trim());
      setTwoFactorEnabled(true);
      updateUser({ two_factor_enabled: true });
      setSetupData2FA(null);
      setTotpVerifyCode('');
      toast.success('Two-factor authentication successfully enabled!');
    } catch (err) {
      toast.error(err.message || 'Invalid verification code. Please check your authenticator app.');
    } finally {
      setEnabling2FA(false);
    }
  };

  // 2FA Disable
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setDisabling2FA(true);
    try {
      await disable2FAApi({ password: disablePasswordInput });
      setTwoFactorEnabled(false);
      updateUser({ two_factor_enabled: false });
      setShowDisableModal(false);
      setDisablePasswordInput('');
      toast.success('Two-factor authentication has been disabled.');
    } catch (err) {
      toast.error(err.message || 'Failed to disable 2FA. Verify your password.');
    } finally {
      setDisabling2FA(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      const prefs = {
        theme,
        language,
        notification_prefs: notificationPrefs,
      };
      const updated = await updatePreferencesApi(prefs);
      updateUser({ preferences: updated });
      toast.success('Preferences saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Unblock User
  const handleUnblockUser = async (blockedUserId) => {
    setUnblockingId(blockedUserId);
    try {
      await unblockUserApi(blockedUserId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedUserId));
      toast.success('Scholar unblocked successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to unblock scholar');
    } finally {
      setUnblockingId(null);
    }
  };

  // Export Data
  const handleExportData = async () => {
    setExportingData(true);
    try {
      const blob = await exportUserDataApi();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `histofacts-academic-chronicle-${user?.username || 'user'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Academic Chronicle data archive downloaded!');
    } catch (err) {
      toast.error(err.message || 'Failed to export account data');
    } finally {
      setExportingData(false);
    }
  };

  // Schedule Account Deletion
  const handleScheduleDeletion = async () => {
    if (!window.confirm('Are you sure you want to schedule your account for deletion? You will have a 30-day grace period to log back in and cancel this action.')) {
      return;
    }

    setSchedulingDeletion(true);
    try {
      const res = await scheduleAccountDeletionApi();
      setDeletionScheduledAt(res.deletion_scheduled_at);
      updateUser({ deletion_scheduled_at: res.deletion_scheduled_at });
      toast.warning('Account deletion scheduled. You have 30 days to cancel before permanent purge.');
    } catch (err) {
      toast.error(err.message || 'Failed to schedule account deletion');
    } finally {
      setSchedulingDeletion(false);
    }
  };

  // Cancel Account Deletion
  const handleCancelDeletion = async () => {
    setCancellingDeletion(true);
    try {
      await cancelAccountDeletionApi();
      setDeletionScheduledAt(null);
      updateUser({ deletion_scheduled_at: null });
      toast.success('Account deletion cancelled! Your scholar credentials are restored.');
    } catch (err) {
      toast.error(err.message || 'Failed to cancel deletion');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Identity & Profile', icon: User },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'privacy', label: 'Privacy & Preferences', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-histo-dark/95 text-histo-paper py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-histo-gold">
                User Profile & Settings
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-histo-gold/20 text-histo-gold border border-histo-gold/40">
                #{user?.tag || '0000'}
              </span>
            </div>
            <p className="font-ui text-sm text-histo-paper/70 mt-1">
              Personalize your public identity, secure your credentials, and edit online visibility.
            </p>
          </div>
        </div>

        {/* Scheduled Deletion Warning Banner */}
        {deletionScheduledAt && (
          <div className="p-4 rounded-lg bg-red-950/60 border border-red-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-display font-bold text-red-200 text-sm">Account Deletion Scheduled</h4>
                <p className="font-ui text-xs text-red-300/80 mt-0.5">
                  Your account is scheduled for permanent purge on{' '}
                  <span className="font-semibold text-white">
                    {new Date(deletionScheduledAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </span>
                  . You can cancel this anytime during the 30-day grace period.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={cancellingDeletion}
              onClick={handleCancelDeletion}
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-ui font-semibold text-xs shadow transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {cancellingDeletion ? 'Cancelling...' : 'Cancel Deletion'}
            </button>
          </div>
        )}

        {/* Email Confirm Alert (if verifying via link) */}
        {confirmingEmail && (
          <div className="p-4 rounded-md bg-histo-gold/15 border border-histo-gold/40 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-histo-gold animate-spin" />
            <p className="text-sm font-ui text-histo-gold font-medium">
              Verifying and confirming your new email address...
            </p>
          </div>
        )}
        {emailConfirmResult && (
          <div
            className={`p-4 rounded-md border flex items-center gap-3 ${
              emailConfirmResult.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}
          >
            {emailConfirmResult.success ? (
              <Check className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            )}
            <p className="text-sm font-ui">{emailConfirmResult.message}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 gap-2 sm:gap-4 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-ui font-medium rounded-t-md transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white/10 text-histo-gold border-b-2 border-histo-gold shadow-sm'
                    : 'text-histo-paper/70 hover:text-histo-paper hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile & Identity */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Avatar Section */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <UserAvatar
                  user={user}
                  avatarUrl={avatarPreview || user?.avatar_url}
                  size="2xl"
                  className="ring-2 ring-histo-gold/60"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-histo-gold text-histo-dark hover:bg-amber-400 transition-colors shadow-md cursor-pointer disabled:opacity-50"
                  title="Upload new avatar"
                >
                  {uploadingAvatar ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <h3 className="font-display text-lg font-bold text-histo-paper">User Avatar</h3>
                <p className="font-ui text-xs text-histo-paper/60">
                  Upload a custom portrait or pick a Blobatar crest below. Images are automatically centered,
                  optimized, and converted to WEBP format. Max 5MB.
                </p>
                <div className="pt-2 flex items-center justify-center sm:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-4 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-histo-paper font-ui text-xs font-semibold border border-white/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {uploadingAvatar ? 'Optimizing & Uploading...' : 'Choose Photo'}
                  </button>
                </div>
              </div>
            </div>

            {/* Blobatar Picker */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-histo-paper">Pick a Blobatar</h3>
              <p className="font-ui text-xs text-histo-paper/60">
                Geometric crests generated from a seed — no upload needed. Choosing one replaces your uploaded
                photo. Nothing is saved until you select one.
              </p>
              <BlobatarPicker
                baseSeed={user?.id || 'scholar'}
                currentSeed={user?.avatar_seed}
                onSelect={handleSeedSelect}
                disabled={savingSeed}
              />
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile} className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                  />
                  <p className="font-ui text-[11px] text-white/40">
                    Your existing friends and conversations won't be affected — only new searches need your
                    updated Name#Tag. Your #tag may re-roll if the new name is already taken with it.
                  </p>
                </div>

                {/* Pronouns */}
                <div className="space-y-1.5">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Pronouns
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="e.g. they/them, she/her, he/him"
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    About Me
                  </label>
                  <span className="text-[11px] font-mono text-white/40">{bio.length}/300</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Share historical interests, eras of specialization, or research topics..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Country */}
                <div className="space-y-1.5">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Country of Origin
                  </label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                  >
                    <option value="">-- Select a Country --</option>
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Profile Visibility */}
                <div className="space-y-1.5">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Profile Visibility
                  </label>
                  <select
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                  >
                    <option value="public">Public (Everyone can view bio & achievements)</option>
                    <option value="friends_only">Friends Only (Only accepted peers view bio & stats)</option>
                    <option value="private">Private (Only you can see profile records)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2.5 bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-sm rounded-md shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Tab 2: Security & Access */}
        {activeTab === 'security' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Two-Factor Authentication (TOTP) Section */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-histo-gold" />
                    <h3 className="font-display text-base font-bold text-histo-paper">Two-Factor Authentication (2FA)</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                        twoFactorEnabled
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {twoFactorEnabled ? 'Active / Protected' : 'Disabled'}
                    </span>
                  </div>
                  <p className="font-ui text-xs text-histo-paper/70">
                    Require a 6-digit verification code from Google Authenticator, Authy, or 1Password when signing in.
                  </p>
                </div>

                <div>
                  {twoFactorEnabled ? (
                    <button
                      type="button"
                      onClick={() => setShowDisableModal(true)}
                      className="px-4 py-2 rounded-md bg-red-900/30 hover:bg-red-900/50 border border-red-500/40 text-red-300 font-ui font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Disable 2FA
                    </button>
                  ) : (
                    !setupData2FA && (
                      <button
                        type="button"
                        onClick={handleStart2FASetup}
                        disabled={settingUp2FA}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        {settingUp2FA ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        <span>Set Up 2FA</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* 2FA Setup Panel */}
              {setupData2FA && !twoFactorEnabled && (
                <div className="bg-histo-dark/80 border border-histo-gold/40 rounded-lg p-5 space-y-4">
                  <div className="flex items-center gap-2 text-histo-gold">
                    <Sparkles className="h-5 w-5" />
                    <h4 className="font-display font-bold text-sm">Step 1: Scan QR or Enter Secret Key</h4>
                  </div>

                  <p className="font-ui text-xs text-histo-paper/80">
                    Add this account to your authenticator app by scanning or entering the secret key below:
                  </p>

                  <div className="p-3 bg-histo-dark border border-white/10 rounded font-mono text-sm text-histo-gold select-all flex items-center justify-between">
                    <span>{setupData2FA.secret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(setupData2FA.secret);
                        toast.success('Secret key copied!');
                      }}
                      className="text-xs text-histo-paper/60 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-display font-bold text-xs text-amber-300">
                        Step 2: Save One-Time Backup Recovery Codes
                      </h5>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(setupData2FA.backup_codes.join('\n'));
                          setCopiedCodes(true);
                          toast.success('10 backup codes copied to clipboard');
                          setTimeout(() => setCopiedCodes(false), 3000);
                        }}
                        className="text-xs text-histo-gold hover:underline flex items-center gap-1 cursor-pointer font-ui"
                      >
                        {copiedCodes ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedCodes ? 'Copied!' : 'Copy All Codes'}</span>
                      </button>
                    </div>
                    <p className="font-ui text-[11px] text-histo-paper/60">
                      If you ever lose access to your device, each code can be used exactly once to log in. Store these safely:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-histo-dark/90 rounded border border-white/10 font-mono text-xs text-center text-white/90">
                      {setupData2FA.backup_codes.map((code, idx) => (
                        <span key={idx} className="p-1 bg-white/5 rounded select-all">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleEnable2FA} className="space-y-3 pt-2">
                    <h5 className="font-display font-bold text-xs text-histo-paper">
                      Step 3: Enter 6-digit Code from Authenticator
                    </h5>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        required
                        placeholder="000000"
                        value={totpVerifyCode}
                        onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                        className="w-40 bg-histo-dark border border-white/20 focus:border-histo-gold rounded-md px-3.5 py-2 text-center font-mono text-lg tracking-widest text-histo-paper outline-none"
                      />
                      <button
                        type="submit"
                        disabled={enabling2FA || totpVerifyCode.length !== 6}
                        className="px-5 py-2 rounded-md bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {enabling2FA ? 'Verifying...' : 'Verify & Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSetupData2FA(null)}
                        className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-histo-paper font-ui text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Disable 2FA Modal */}
              {showDisableModal && (
                <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-5 space-y-3">
                  <h4 className="font-display font-bold text-sm text-red-200">Disable Two-Factor Authentication</h4>
                  <p className="font-ui text-xs text-red-300/80">
                    To disable 2FA protection, please confirm your current account password:
                  </p>
                  <form onSubmit={handleDisable2FA} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      required
                      placeholder="Current Password"
                      value={disablePasswordInput}
                      onChange={(e) => setDisablePasswordInput(e.target.value)}
                      className="flex-1 bg-histo-dark/80 border border-red-500/30 focus:border-red-400 rounded-md px-3.5 py-2 text-sm text-histo-paper outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={disabling2FA}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-ui font-bold text-xs rounded-md shadow transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {disabling2FA ? 'Disabling...' : 'Confirm Disable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDisableModal(false)}
                        className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white font-ui text-xs rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Active Sessions Management */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-5 w-5 text-histo-gold" />
                    <h3 className="font-display text-base font-bold text-histo-paper">Active Scholar Sessions</h3>
                  </div>
                  <p className="font-ui text-xs text-histo-paper/70">
                    Devices and locations where your credentials have an active refresh token.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchSessions}
                  disabled={loadingSessions}
                  className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Refresh sessions"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingSessions ? (
                <div className="py-6 text-center font-ui text-xs text-white/50 flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-histo-gold" />
                  <span>Loading active sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-4 text-center font-ui text-xs text-white/50">
                  No active session records found.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 bg-histo-dark/80 border border-white/10 rounded-md flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-white/5 text-histo-gold">
                          {sess.device_label?.toLowerCase().includes('mobile') ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <Laptop className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-ui font-semibold text-xs text-histo-paper">
                              {sess.device_label || 'Unknown Browser / Client'}
                            </span>
                            {sess.is_current && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                                This Device
                              </span>
                            )}
                          </div>
                          <div className="font-ui text-[11px] text-white/50 mt-0.5 space-x-2">
                            <span>IP: {sess.ip_address || '127.0.0.1'}</span>
                            <span>•</span>
                            <span>
                              Active:{' '}
                              {sess.last_active_at
                                ? new Date(sess.last_active_at).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Just now'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!sess.is_current && (
                        <button
                          type="button"
                          disabled={revokingSessionId === sess.id}
                          onClick={() => handleRevokeSession(sess.id)}
                          className="px-3 py-1.5 rounded bg-white/10 hover:bg-red-950/50 hover:text-red-300 border border-white/10 hover:border-red-500/30 text-xs font-ui transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {revokingSessionId === sess.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email Change Section */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-histo-gold">
                <Mail className="h-5 w-5" />
                <h3 className="font-display text-base font-bold text-histo-paper">Primary User Email</h3>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-histo-dark/80 border border-white/10">
                <div>
                  <p className="font-ui text-xs text-histo-paper/60 uppercase tracking-wider">Current Address</p>
                  <p className="font-mono text-sm text-histo-gold">{user?.email}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-ui bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
                  Verified
                </span>
              </div>

              {emailConfirmationSent ? (
                <div className="p-4 rounded-md bg-histo-gold/15 border border-histo-gold/40 text-histo-paper space-y-2">
                  <div className="flex items-center gap-2 text-histo-gold font-semibold text-xs uppercase tracking-wider">
                    <Check className="h-4 w-4" />
                    <span>Confirmation Link Dispatched</span>
                  </div>
                  <p className="font-ui text-xs text-histo-paper/80">
                    We sent a confirmation link to <strong className="text-white">{newEmail}</strong>. Click the link to
                    verify and complete the email transition.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestEmailChange} className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                      New Email Address
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        required
                        placeholder="scholar@university.edu"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="flex-1 bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={requestingEmail}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-histo-paper font-ui font-semibold text-xs rounded-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {requestingEmail ? 'Sending...' : 'Request Email Change'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Change Password Form */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-histo-gold">
                <Lock className="h-5 w-5" />
                <h3 className="font-display text-base font-bold text-histo-paper">Change Access Password</h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Verify current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                      New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="flex items-center gap-2 px-5 py-2.5 bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-sm rounded-md shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {changingPassword ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {/* Tab 3: Privacy & Preferences */}
        {activeTab === 'privacy' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Academic Preferences (Theme & Language) */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-5">
              <div className="flex items-center gap-2 text-histo-gold">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-display text-base font-bold text-histo-paper">Display / Language Preferences</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Theme Selector */}
                <div className="space-y-2">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Interface Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map((t) => {
                      const Icon = t.icon;
                      const selected = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-xs font-ui transition-all cursor-pointer ${
                            selected
                              ? 'bg-histo-gold/20 border-histo-gold text-histo-gold font-bold shadow'
                              : 'bg-histo-dark/80 border-white/10 text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Language Selector */}
                <div className="space-y-2">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Interface Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                  >
                    {languageOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Per-Notification-Type Toggles */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-2 text-histo-gold">
                  <Bell className="h-4 w-4" />
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-histo-paper">
                    User Notification Preferences
                  </h4>
                </div>
                <p className="font-ui text-xs text-histo-paper/70">
                  Control which notifications you receive from the platform. You can toggle each type on or off below.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { key: 'friend_requests', label: 'Friend & Peer Inquiries', desc: 'Alert when a scholar sends a request' },
                    { key: 'quiz_challenges', label: 'Quiz & Arena Duels', desc: 'Challenges from peers or daily trivia' },
                    { key: 'group_discussions', label: 'Guild & Group Discussions', desc: 'Mentions and new replies in forums' },
                    { key: 'daily_fact', label: 'Daily Historical Milestone', desc: 'Morning chronicle drops and fun facts' },
                  ].map((item) => {
                    const enabled = notificationPrefs[item.key] !== false;
                    return (
                      <div
                        key={item.key}
                        className="p-3 rounded-md bg-histo-dark/70 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <p className="font-ui text-xs font-semibold text-histo-paper">{item.label}</p>
                          <p className="font-ui text-[11px] text-white/50">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => {
                              setNotificationPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-histo-gold"></div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={savingPreferences}
                  onClick={handleSavePreferences}
                  className="flex items-center gap-2 px-5 py-2 bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-xs rounded-md shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingPreferences ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>

            {/* Blocked Scholars Section */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-histo-gold">
                  <UserX className="h-5 w-5" />
                  <h3 className="font-display text-base font-bold text-histo-paper">Blocked Users</h3>
                </div>
                <button
                  type="button"
                  onClick={fetchBlockedUsers}
                  disabled={loadingBlocked}
                  className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  title="Refresh list"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingBlocked ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <p className="font-ui text-xs text-histo-paper/70">
                Blocked users cannot view your profile, send messages, or issue friend requests.
              </p>

              {loadingBlocked ? (
                <div className="py-4 text-center font-ui text-xs text-white/50 flex items-center justify-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-histo-gold" />
                  <span>Loading blocked users...</span>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="py-4 text-center font-ui text-xs text-white/40 bg-histo-dark/50 rounded border border-white/5">
                  You have not blocked any users.
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((bUser) => (
                    <div
                      key={bUser.id}
                      className="p-3 bg-histo-dark/80 border border-white/10 rounded-md flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar user={bUser} size="sm" />
                        <div>
                          <p className="font-ui text-xs font-semibold text-histo-paper">
                            {bUser.username}{' '}
                            <span className="font-mono text-histo-gold/70 text-[10px]">#{bUser.tag}</span>
                          </p>
                          <p className="font-ui text-[11px] text-white/40">{bUser.bio || 'Scholar'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={unblockingId === bUser.id}
                        onClick={() => handleUnblockUser(bUser.id)}
                        className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-ui text-histo-paper border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {unblockingId === bUser.id ? 'Unblocking...' : 'Unblock'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Academic Timezone Calibration */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-histo-gold">
                <Clock className="h-5 w-5" />
                <h3 className="font-display text-base font-bold text-histo-paper">User Timezone</h3>
              </div>

              <p className="font-ui text-xs text-histo-paper/70">
                Calibrates challenge cutoffs, study streaks, and activity notifications.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. UTC, Asia/Kolkata, America/New_York"
                  className="flex-1 bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={detectTimezone}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-histo-paper font-ui font-medium text-xs rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-histo-gold" />
                  <span>Auto-Detect</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTimezone}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-xs rounded-md shadow transition-all cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Timezone</span>
                </button>
              </div>

              {/* Privacy: show online status */}
              <div className="p-3 rounded-md bg-histo-dark/70 border border-white/10 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-ui text-xs font-semibold text-histo-paper">Show online status</p>
                  <p className="font-ui text-[11px] text-white/50">
                    When off, you appear offline to everyone — regardless of your actual activity.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={showOnlineStatus}
                    onChange={handleToggleOnlineStatus}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-histo-gold"></div>
                </label>
              </div>
            </div>

            {/* Danger Zone: Data Export & Account Deletion */}
            <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-display text-base font-bold text-red-200">User Data & Account Management</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Export Data Archive */}
                <div className="p-4 bg-histo-dark/80 border border-white/10 rounded-lg flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-display font-bold text-sm text-histo-paper flex items-center gap-2">
                      <Download className="h-4 w-4 text-histo-gold" />
                      <span>Download Chronicle (ZIP)</span>
                    </h4>
                    <p className="font-ui text-xs text-histo-paper/60">
                      Export your comprehensive history, quiz attempts, forum posts, notes, and profile records in a
                      portable JSON archive.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={exportingData}
                    onClick={handleExportData}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 text-histo-paper font-ui font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {exportingData ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    <span>{exportingData ? 'Generating Archive...' : 'Download My Data (.zip)'}</span>
                  </button>
                </div>

                {/* Account Deletion */}
                <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-lg flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-display font-bold text-sm text-red-300 flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-400" />
                      <span>Schedule Deletion</span>
                    </h4>
                    <p className="font-ui text-xs text-red-300/70">
                      Initiates a 30-day grace period. Discussion posts remain intact with anonymized authorship; private
                      notes and tokens are permanently purged.
                    </p>
                  </div>
                  {deletionScheduledAt ? (
                    <button
                      type="button"
                      disabled={cancellingDeletion}
                      onClick={handleCancelDeletion}
                      className="px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-ui font-semibold text-xs shadow transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {cancellingDeletion ? 'Restoring...' : 'Cancel Scheduled Deletion'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={schedulingDeletion}
                      onClick={handleScheduleDeletion}
                      className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 text-white font-ui font-semibold text-xs shadow transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {schedulingDeletion ? 'Scheduling...' : 'Schedule Account Deletion'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
