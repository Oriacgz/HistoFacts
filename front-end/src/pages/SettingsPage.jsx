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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  updateProfileApi,
  uploadAvatarApi,
  changePasswordApi,
  requestEmailChangeApi,
  confirmEmailChangeApi,
} from '../api/auth';

const allCountries = countries.getData().sort((a, b) => a.name.localeCompare(b.name));

const getAvatarSrc = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${baseUrl}${url}`;
};

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
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

  // Avatar Upload State
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security Form State - Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Security Form State - Email
  const [newEmail, setNewEmail] = useState('');
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  // URL Email Confirm Token State
  const confirmToken = searchParams.get('confirm_email_token');
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [emailConfirmResult, setEmailConfirmResult] = useState(null);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setBio(user.bio || '');
      setCountryCode(user.country_code || '');
      setPronouns(user.pronouns || '');
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setShowOnlineStatus(user.show_online_status ?? true);
    }
  }, [user]);

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
          // Clean up query param
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

  // Auto-detect timezone
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

    // Local preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    // Auto-upload
    setUploadingAvatar(true);
    try {
      const res = await uploadAvatarApi(file);
      updateUser({ avatar_url: res.avatar_url });
      toast.success('Avatar updated successfully!');
    } catch (err) {
      setAvatarPreview(null);
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
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
                Scholar Profile & Settings
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-histo-gold/20 text-histo-gold border border-histo-gold/40">
                #{user?.tag || '0000'}
              </span>
            </div>
            <p className="font-ui text-sm text-histo-paper/70 mt-1">
              Personalize your public academy identity, secure your credentials, and govern online visibility.
            </p>
          </div>
        </div>

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
                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-histo-gold/60 shadow-lg bg-histo-dark flex items-center justify-center">
                  {avatarPreview || user?.avatar_url ? (
                    <img
                      src={avatarPreview || getAvatarSrc(user?.avatar_url)}
                      alt={user?.username || 'Avatar'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display font-bold text-3xl text-histo-gold">
                      {user?.username ? user.username[0].toUpperCase() : 'U'}
                    </span>
                  )}
                </div>

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
                <h3 className="font-display text-lg font-bold text-histo-paper">Academy Avatar</h3>
                <p className="font-ui text-xs text-histo-paper/60">
                  Upload a high-resolution portrait. JPEG, PNG, GIF, or WEBP up to 5MB. Images are automatically
                  centered, optimized, and converted to WEBP format.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-3.5 py-1.5 text-xs font-ui font-semibold text-histo-gold bg-histo-gold/10 hover:bg-histo-gold/20 border border-histo-gold/30 rounded-md transition-all cursor-pointer"
                  >
                    {uploadingAvatar ? 'Optimizing & Uploading...' : 'Choose New Photo'}
                  </button>
                </div>
              </div>
            </div>

            {/* Profile Fields Form */}
            <form onSubmit={handleSaveProfile} className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-5">
              {/* Username + Tag Notice */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Scholar Username
                  </label>
                  <span className="text-xs font-mono text-histo-gold/70">Tag: #{user?.tag || '0000'}</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors"
                  />
                </div>
                <div className="flex items-start gap-2 text-xs text-histo-paper/60 mt-1 bg-white/5 p-2.5 rounded-md border border-white/5">
                  <Info className="h-4 w-4 text-histo-gold shrink-0 mt-0.5" />
                  <span>
                    Your existing friends and conversations won't be affected by a username change. Your numeric
                    #tag will remain the same unless there is a collision with another scholar of the exact same name.
                  </span>
                </div>
              </div>

              {/* Pronouns & Country Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="space-y-1.5">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Country / Region
                  </label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2.5 text-sm font-ui text-histo-paper outline-none transition-colors cursor-pointer"
                  >
                    <option value="">-- Not specified --</option>
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.code} className="bg-histo-dark text-histo-paper">
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bio Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                    Scholar Biography
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      bio.length > 280 ? 'text-amber-400 font-bold' : 'text-histo-paper/50'
                    }`}
                  >
                    {bio.length} / 300
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={300}
                  placeholder="Tell fellow historians about your research focus, favorite historical periods, and academic interests..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md p-3.5 text-sm font-ui text-histo-paper outline-none transition-colors resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
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
            {/* Email Address Section */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-histo-gold">
                <Mail className="h-5 w-5" />
                <h3 className="font-display text-lg font-bold">Email Address</h3>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-ui text-histo-paper/60 uppercase tracking-wider">Current Email</span>
                <p className="font-mono text-sm text-histo-paper bg-histo-dark/80 px-3.5 py-2 rounded-md border border-white/10 w-fit">
                  {user?.email}
                </p>
              </div>

              <form onSubmit={handleRequestEmailChange} className="space-y-3 pt-2">
                <label className="block font-ui text-xs font-semibold tracking-wider text-histo-gold uppercase">
                  Change Email Address
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    required
                    placeholder="Enter new email address..."
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 bg-histo-dark/80 border border-white/15 focus:border-histo-gold rounded-md px-3.5 py-2 text-sm font-ui text-histo-paper outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={requestingEmail}
                    className="px-4 py-2 bg-histo-gold/20 hover:bg-histo-gold/30 border border-histo-gold/50 text-histo-gold font-ui font-semibold text-sm rounded-md transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {requestingEmail ? 'Sending Link...' : 'Request Verification Link'}
                  </button>
                </div>
                <p className="text-xs text-histo-paper/60 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-histo-gold/80 shrink-0" />
                  <span>
                    For security, your email will not update immediately. A confirmation link is dispatched to your new
                    address and must be clicked within 24 hours.
                  </span>
                </p>
                {emailConfirmationSent && (
                  <div className="p-3 rounded-md bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-ui flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>Confirmation dispatched! Please check your new inbox to complete the switch.</span>
                  </div>
                )}
              </form>
            </div>

            {/* Password Change Section */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-histo-gold">
                <KeyRound className="h-5 w-5" />
                <h3 className="font-display text-lg font-bold">Change Password</h3>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
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
            {/* Online Status Toggle */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 flex items-start justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-histo-gold" />
                  <h3 className="font-display text-base font-bold text-histo-paper">Online Presence Visibility</h3>
                </div>
                <p className="font-ui text-xs text-histo-paper/70">
                  When enabled, your friends and academy peers can see when you are currently online and your recent activity
                  timestamp.
                </p>
                <p className="font-ui text-xs text-amber-300/80">
                  When turned off, you appear offline to everyone, even when actively taking quizzes or exploring notes.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={showOnlineStatus}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setShowOnlineStatus(val);
                    updateProfileApi({ show_online_status: val })
                      .then((updated) => {
                        updateUser(updated);
                        toast.success(`Online status visibility set to ${val ? 'Online' : 'Stealth (Offline)'}`);
                      })
                      .catch((err) => toast.error(err.message));
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-histo-gold"></div>
              </label>
            </div>

            {/* Timezone Preference */}
            <div className="bg-histo-medium/40 border border-white/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-histo-gold">
                <Clock className="h-5 w-5" />
                <h3 className="font-display text-base font-bold">Academic Timezone</h3>
              </div>

              <p className="font-ui text-xs text-histo-paper/70">
                Your preferred IANA timezone is used to calibrate daily challenge cutoffs, study streaks, and activity
                notifications.
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
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    updateProfileApi({ timezone })
                      .then((updated) => {
                        updateUser(updated);
                        toast.success('Timezone updated successfully');
                      })
                      .catch((err) => toast.error(err.message));
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-histo-gold hover:bg-amber-400 text-histo-dark font-ui font-bold text-sm rounded-md shadow-md transition-all cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Timezone</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
