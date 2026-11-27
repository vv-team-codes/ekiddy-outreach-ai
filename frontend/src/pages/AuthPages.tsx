import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@ekiddy/shared';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore, type OrganizationSummary, type UserSummary } from '@/stores/appStore';

interface AuthPayload {
  token: string;
  user: UserSummary;
  organization: OrganizationSummary | null;
  organizations: Array<{ organization: OrganizationSummary; role: 'owner' | 'admin' | 'member' | 'viewer' }>;
  devVerificationToken?: string;
}

function AuthWrapper({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ekiddy-grid flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] px-4 py-10 dark:bg-[#0A0D12]">
      <Link to="/" className="mb-6 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-base font-bold text-white dark:bg-blue-600">
          E
        </div>
        <span className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">
          Ekiddy Outreach AI
        </span>
      </Link>
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="p-6">
          <h1 className="font-display text-xl font-bold text-slate-950 dark:text-white">{title}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </CardContent>
      </Card>
      <div className="mt-5 flex items-center gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          500 Free Credits
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Tenant-Isolated Workspace
        </span>
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession, addToast } = useAppStore();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setServerError('');
    try {
      const res = await apiRequest<AuthPayload>('/api/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify(values)
      });
      setSession({
        token: res.token,
        user: res.user,
        organization: res.organization,
        organizations: res.organizations,
        role: res.organizations?.[0]?.role || 'owner'
      });
      addToast({ type: 'success', title: 'Welcome back', description: `Signed in as ${res.user.email}` });
      navigate(res.organization?.onboarding?.completed ? '/app' : '/app/onboarding');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <AuthWrapper title="Sign in to your workspace" subtitle="Access your AI campaigns, inbox, and meetings.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {serverError}
          </div>
        )}
        <Input label="Work Email" type="email" placeholder="you@company.com" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" placeholder="••••••••" {...register('password')} error={errors.password?.message} />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full">
          Sign In
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-500">
        New to Ekiddy Outreach AI?{' '}
        <Link to="/register" className="font-semibold text-blue-700 hover:underline dark:text-blue-400">
          Create an account
        </Link>
      </p>
    </AuthWrapper>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { pendingWebsiteUrl, setSession, addToast } = useAppStore();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      websiteUrl: pendingWebsiteUrl || ''
    }
  });

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    setServerError('');
    try {
      const res = await apiRequest<AuthPayload>('/api/auth/register', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify(values)
      });
      setSession({
        token: res.token,
        user: res.user,
        organization: res.organization,
        organizations: res.organizations,
        role: 'owner'
      });
      addToast({
        type: 'success',
        title: 'Workspace created',
        description: '500 welcome credits added to your organization.'
      });
      navigate('/app/onboarding');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <AuthWrapper
      title="Create your Ekiddy workspace"
      subtitle="Get 500 free credits to research your market and launch your first outreach workflow."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {serverError}
          </div>
        )}
        <Input label="Full Name" placeholder="Alex Rivera" {...register('fullName')} error={errors.fullName?.message} />
        <Input label="Work Email" type="email" placeholder="alex@company.com" {...register('email')} error={errors.email?.message} />
        <Input label="Organization Name" placeholder="Acme SaaS Inc." {...register('organizationName')} error={errors.organizationName?.message} />
        <Input
          label="Company Website (optional)"
          placeholder="https://yourcompany.com"
          {...register('websiteUrl')}
          error={errors.websiteUrl?.message}
        />
        <Input label="Password" type="password" placeholder="At least 8 characters" {...register('password')} error={errors.password?.message} />

        <Button type="submit" loading={isSubmitting} className="w-full">
          Create Workspace & Continue
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-blue-700 hover:underline dark:text-blue-400">
          Sign in
        </Link>
      </p>
    </AuthWrapper>
  );
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    const res = await apiRequest<{ message: string; devResetToken?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(values)
    });
    setMessage(res.message);
    if (res.devResetToken) setDevToken(res.devResetToken);
  };

  return (
    <AuthWrapper title="Reset your password" subtitle="Enter your account email to generate a reset token.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <p>{message}</p>
            {devToken && (
              <Link
                to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                className="mt-2 inline-block font-semibold text-blue-700 underline"
              >
                Open Reset Link (Dev Preview)
              </Link>
            )}
          </div>
        )}
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Request Password Reset
        </Button>
      </form>
      <div className="mt-4 text-center text-xs">
        <Link to="/login" className="text-blue-700 hover:underline">
          Back to Sign In
        </Link>
      </div>
    </AuthWrapper>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useAppStore();
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: params.get('token') || '' }
  });

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    setErrorMsg('');
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify(values)
      });
      addToast({ type: 'success', title: 'Password updated', description: 'Please sign in with your new password.' });
      navigate('/login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <AuthWrapper title="Choose a new password" subtitle="Paste your reset token and enter a strong password.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
        <Input label="Reset Token" {...register('token')} error={errors.token?.message} />
        <Input label="New Password" type="password" {...register('newPassword')} error={errors.newPassword?.message} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Update Password
        </Button>
      </form>
    </AuthWrapper>
  );
}
