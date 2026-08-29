'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useApp } from '@/context/AppContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginForm() {
  const router = useRouter();
  const { usersList, setCurrentUser, addAuditLog, branding } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    clearErrors();

    try {
      // 1. Production Supabase Auth Authentication
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (authErr) {
          setError('root', {
            message: authErr.message || 'Invalid email or password. Please verify your login credentials.',
          });
          setIsLoading(false);
          return;
        }

        if (authData.user) {
          // Fetch user profile record
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          const userObj = {
            id: authData.user.id,
            name: profile?.name || authData.user.user_metadata?.name || data.email.split('@')[0],
            email: authData.user.email || data.email,
            role: (profile?.role || authData.user.user_metadata?.role || 'Store Manager') as any,
            store: profile?.store_scope || authData.user.user_metadata?.store_code || 'BLR',
            avatar: (profile?.name || data.email).substring(0, 2).toUpperCase(),
            shiftStatus: (profile?.shift_status || 'On Shift') as any,
            avatarUrl: profile?.avatar_url || undefined,
          };

          setCurrentUser(userObj);
          addAuditLog('Authentication', 'User Login', `Signed in as ${userObj.role} (${userObj.email})`);
          toast.success(`Welcome back, ${userObj.name}! Signed in as ${userObj.role}`);
          router.push('/dashboard');
          return;
        }
      }

      // 2. Demo / Standalone Mode Authentication (against provisioned user accounts list)
      const match = usersList.find(
        (u) => u.email.toLowerCase() === data.email.toLowerCase() && u.password === data.password
      );

      if (match) {
        setCurrentUser({
          id: match.id,
          name: match.name,
          email: match.email,
          role: match.role,
          store: match.store,
          avatar: match.name.substring(0, 2).toUpperCase(),
          shiftStatus: match.shiftStatus || 'On Shift',
          avatarUrl: (match as any).avatarUrl,
        });
        addAuditLog('Authentication', 'User Login', `Signed in as ${match.role} (${match.email})`);
        toast.success(`Welcome back, ${match.name}! Signed in as ${match.role}`);
        router.push('/dashboard');
      } else {
        setError('root', {
          message: 'Invalid email or password. Please verify your login credentials.',
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      setError('root', {
        message: err.message || 'An unexpected authentication error occurred.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="fade-in">
      {/* Mobile logo */}
      <div className="flex items-center gap-2.5 mb-8 lg:hidden">
        <AppLogo size={32} />
        <span className="font-bold text-lg text-foreground">{branding.appName}</span>
      </div>

      {/* Header */}
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-foreground">Sign In to {branding.appName}</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          {branding.tagline || 'Access your multi-store POS & enterprise dashboard'}
        </p>
      </div>

      {/* Clean Sign In Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Root error */}
        {errors.root && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border" style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'var(--danger-border)' }}>
            <Icon name="ExclamationCircleIcon" size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{errors.root.message}</p>
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="email" className="label-text">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            className={`input-field ${errors.email ? 'border-danger ring-1 ring-danger' : ''}`}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
          />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="label-text mb-0">Password</label>
            <button type="button" className="text-xs text-primary hover:underline font-medium">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={`input-field pr-10 ${errors.password ? 'border-danger ring-1 ring-danger' : ''}`}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
            </button>
          </div>
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="rememberMe"
            type="checkbox"
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
            {...register('rememberMe')}
          />
          <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
            Keep me signed in for 30 days
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-3 text-base"
          style={{ minWidth: '100%' }}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
              </svg>
              Signing in...
            </>
          ) : (
            <>
              Sign In to Dashboard
              <Icon name="ArrowRightIcon" size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}