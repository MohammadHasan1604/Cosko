'use client';
import React from 'react';
import { useApp } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import Modal from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function UserProfileModal() {
  const { userProfileOpen, setUserProfileOpen, currentUser, logoutUser, toggleCurrentUserShift, updateProfileAvatar, branding, selectedStore, addAuditLog } = useApp();
  const router = useRouter();

  if (!userProfileOpen) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid format! Upload a PNG, JPG, WebP, or SVG profile picture.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit! Upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      updateProfileAvatar(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    updateProfileAvatar(null);
  };

  const handleLogout = () => {
    addAuditLog('Authentication', 'User Logout', `${currentUser.name} logged out of session`);
    setUserProfileOpen(false);
    logoutUser();
    toast.success('Logged out successfully');
    router.push('/sign-up-login');
  };

  return (
    <Modal
      open={userProfileOpen}
      onClose={() => setUserProfileOpen(false)}
      title="User Account & Security Profile"
      subtitle={`${branding.appName} — Personal account profile, shift status, and security credentials.`}
      size="md"
    >
      <div className="space-y-6 py-2">
        {/* Business Header Banner */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="w-9 h-9 object-contain rounded-lg border border-border" />
            ) : (
              <AppLogo size={32} />
            )}
            <div>
              <h4 className="text-xs font-bold text-foreground">{branding.appName}</h4>
              <p className="text-3xs text-muted-foreground">{branding.tagline}</p>
            </div>
          </div>
          <span className="badge-primary text-2xs font-bold font-mono">Location: {selectedStore}</span>
        </div>

        {/* User Profile Card & Profile Photo Uploader */}
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar Display with Photo Upload Trigger */}
            <div className="relative group">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-primary shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-xl font-extrabold shadow-md">
                  {currentUser.avatar}
                </div>
              )}

              {/* Upload Trigger overlay */}
              <label className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
                <Icon name="CameraIcon" size={20} />
                <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">{currentUser.name}</h3>
              <p className="text-xs text-muted-foreground">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="badge-info text-2xs font-bold">{currentUser.role}</span>
                <span className="badge-neutral text-2xs">{currentUser.store} Store</span>
              </div>
            </div>
          </div>

          {/* Profile Photo Actions */}
          <div className="space-y-2 text-right">
            <label className="btn-secondary text-2xs py-1.5 px-3 gap-1.5 inline-flex items-center cursor-pointer">
              <Icon name="ArrowUpTrayIcon" size={13} />
              Upload Profile Photo
              <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleAvatarUpload} className="hidden" />
            </label>
            {currentUser.avatarUrl && (
              <button onClick={handleRemoveAvatar} className="text-3xs text-danger hover:underline block ml-auto font-semibold">
                Remove Photo
              </button>
            )}
          </div>
        </div>

        {/* Shift Status Toggle Card */}
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground">Duty Shift Status</p>
            <p className="text-2xs text-muted-foreground">Toggle whether you are actively on shift or on leave</p>
          </div>

          <button
            onClick={toggleCurrentUserShift}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              currentUser.shiftStatus === 'On Shift'
                ? 'bg-success text-white shadow-xs hover:bg-success/90'
                : 'bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${currentUser.shiftStatus === 'On Shift' ? 'bg-white animate-pulse' : 'bg-warning'}`} />
            {currentUser.shiftStatus}
          </button>
        </div>

        {/* Security Credentials */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security & Access Credentials</h4>
          <div className="p-3.5 rounded-xl border border-border space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Assigned Role:</span>
              <span className="font-bold text-foreground">{currentUser.role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Assigned Store Location:</span>
              <span className="font-bold text-foreground">{currentUser.store}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Multi-Factor Auth (MFA):</span>
              <span className="text-success font-semibold flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={14} /> Enabled
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Active Session IP:</span>
              <span className="font-mono text-xs text-muted-foreground">192.168.1.14</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <button onClick={() => setUserProfileOpen(false)} className="btn-ghost text-sm">
            Close
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-danger text-white hover:bg-danger/90 transition-colors shadow-sm"
          >
            <Icon name="ArrowRightOnRectangleIcon" size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </Modal>
  );
}
