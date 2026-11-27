import React, { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { forgotPasswordSchema, isWorkEmail, loginSchema, registerSchema, resetPasswordSchema, WORK_EMAIL_ONLY_MESSAGE } from '@ekiddy/shared';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { apiRequest, isBackendConfigured } from '@/lib/api';
import {
  confirmReset,
  friendlyFirebaseError,
  getGoogleRedirectResult,
  isNetworkError,
  sendResetEmail,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
  signUpWithEmail,
  verifyResetCode,
  auth
} from '@/lib/firebase';
import { exchangeFirebaseSession, isBackendUnavailableError, type AuthPayload } from '@/lib/firebaseSession';
import { useAppStore } from '@/stores/appStore';

const RESET_SENT_MESSAGE = 'If an account matches that email, reset instructions have been sent.';

// Shown when Firebase sign-in succeeded but there is no workspace backend
// to provision the workspace yet (e.g. the static GitHub Pages host).
const backendNotConnectedMessage = (email: string) =>
  `Signed in as ${email}. The workspace service is not connected yet — your account is created and your workspace will be ready once it is connected.`;

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
          e
        </div>
        <span className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">
          ekiddy Outreach AI
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

function GoogleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button type="button" variant="primary" size="lg" loading={loading} onClick={onClick} className="w-full">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-900 ring-1 ring-stone-200">
        G
      </span>
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400">
      <span className="h-px flex-1 bg-stone-200 dark:bg-slate-800" />
      or continue with email
      <span className="h-px flex-1 bg-stone-200 dark:bg-slate-800" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      {message}
    </div>
  );
}

function goToApp(navigate: (to: string) => void, res: AuthPayload) {
  navigate(res.organization?.onboarding?.completed ? '/app' : '/app/onboarding');
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession, addToast } = useAppStore();
  const [serverError, setServerError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const redirectHandled = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema)
  });

  const completeGoogleSignIn = async (credential: Awaited<ReturnType<typeof signInWithGoogle>>) => {
    if (!credential) return;
    const email = credential.user.email || '';
    if (!isWorkEmail(email)) {
      await signOutFirebase();
      setServerError(WORK_EMAIL_ONLY_MESSAGE);
      return;
    }
    let res: AuthPayload;
    try {
      res = await exchangeFirebaseSession(await credential.user.getIdToken());
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        // Firebase sign-in succeeded; only the workspace backend is missing.
        setServerError(backendNotConnectedMessage(email));
        return;
      }
      throw err;
    }
    setSession({
      token: res.token,
      user: res.user,
      organization: res.organization,
      organizations: res.organizations,
      role: res.organizations?.[0]?.role || 'owner'
    });
    addToast({ type: 'success', title: 'Welcome back', description: `Signed in as ${res.user.email}` });
    goToApp(navigate, res);
  };

  // Pick up a Google sign-in that finished via redirect after a page reload.
  useEffect(() => {
    if (redirectHandled.current) return;
    redirectHandled.current = true;
    getGoogleRedirectResult()
      .then(async (credential) => {
        if (!credential) return;
        setGoogleBusy(true);
        try {
          await completeGoogleSignIn(credential);
        } catch (err) {
          setServerError(friendlyFirebaseError(err));
        } finally {
          setGoogleBusy(false);
        }
      })
      .catch(() => {
        // No redirect result pending — normal login page load.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onGoogleClick = async () => {
    setServerError('');
    setGoogleBusy(true);
    try {
      const credential = await signInWithGoogle();
      // null means the browser was redirected to Google; the result is
      // handled by the redirect effect above after the page reloads.
      if (credential) await completeGoogleSignIn(credential);
    } catch (err) {
      setServerError(friendlyFirebaseError(err));
    } finally {
      setGoogleBusy(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setServerError('');
    if (!isWorkEmail(values.email)) {
      setServerError(WORK_EMAIL_ONLY_MESSAGE);
      return;
    }
    try {
      const credential = await signInWithEmail(values.email, values.password);
      let res: AuthPayload;
      try {
        res = await exchangeFirebaseSession(await credential.user.getIdToken());
      } catch (exchangeErr) {
        if (isBackendUnavailableError(exchangeErr)) {
          // Firebase sign-in succeeded; only the workspace backend is missing.
          setServerError(backendNotConnectedMessage(values.email));
          return;
        }
        throw exchangeErr;
      }
      setSession({
        token: res.token,
        user: res.user,
        organization: res.organization,
        organizations: res.organizations,
        role: res.organizations?.[0]?.role || 'owner'
      });
      addToast({ type: 'success', title: 'Welcome back', description: `Signed in as ${res.user.email}` });
      goToApp(navigate, res);
    } catch (err) {
      // Fallback: backend password login, only when Firebase itself is
      // unreachable (network error) AND a backend is configured. It is not
      // used for wrong passwords or unknown accounts, and never on a
      // static host with no backend behind /api/*.
      if (isNetworkError(err) && isBackendConfigured) {
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
          goToApp(navigate, res);
          return;
        } catch (fallbackErr) {
          setServerError(fallbackErr instanceof Error ? fallbackErr.message : 'Login failed');
          return;
        }
      }
      setServerError(friendlyFirebaseError(err));
    }
  };

  return (
    <AuthWrapper title="Sign in to your workspace" subtitle="Access your AI campaigns, inbox, and meetings.">
      <GoogleButton onClick={onGoogleClick} loading={googleBusy} />
      <Divider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ErrorBox message={serverError} />
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
        New to ekiddy Outreach AI?{' '}
        <Link to="/register" className="font-semibold text-blue-700 hover:underline dark:text-blue-400">
          Create an account
        </Link>
      </p>
    </AuthWrapper>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { pendingWebsiteUrl, setPendingWebsiteUrl, setSession, addToast } = useAppStore();
  const [serverError, setServerError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [verifySentEmail, setVerifySentEmail] = useState('');
  const [resendNote, setResendNote] = useState('');
  const [googleRedirectDone, setGoogleRedirectDone] = useState(false);

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

  const finishRegistration = (res: AuthPayload) => {
    setSession({
      token: res.token,
      user: res.user,
      organization: res.organization,
      organizations: res.organizations,
      role: 'owner'
    });
    setPendingWebsiteUrl('');
    addToast({
      type: 'success',
      title: 'Workspace created',
      description: '500 welcome credits added to your organization.'
    });
    navigate('/app/onboarding');
  };

  const completeGoogleSignUp = async (credential: Awaited<ReturnType<typeof signInWithGoogle>>) => {
    if (!credential) return;
    const email = credential.user.email || '';
    if (!isWorkEmail(email)) {
      await signOutFirebase();
      setServerError(WORK_EMAIL_ONLY_MESSAGE);
      return;
    }
    // Google accounts arrive already verified, so the workspace is created
    // straight away. The user's name comes from their Google profile.
    let res: AuthPayload;
    try {
      res = await exchangeFirebaseSession(await credential.user.getIdToken(), {
        fullName: credential.user.displayName || undefined
      });
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        // Firebase sign-in succeeded; only the workspace backend is missing.
        setServerError(backendNotConnectedMessage(email));
        return;
      }
      throw err;
    }
    finishRegistration(res);
  };

  // Pick up a Google sign-up that finished via redirect after a page reload.
  useEffect(() => {
    if (googleRedirectDone) return;
    setGoogleRedirectDone(true);
    getGoogleRedirectResult()
      .then(async (credential) => {
        if (!credential) return;
        setGoogleBusy(true);
        try {
          await completeGoogleSignUp(credential);
        } catch (err) {
          setServerError(friendlyFirebaseError(err));
        } finally {
          setGoogleBusy(false);
        }
      })
      .catch(() => {
        // No redirect result pending — normal register page load.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleRedirectDone]);

  const onGoogleClick = async () => {
    setServerError('');
    setGoogleBusy(true);
    try {
      const credential = await signInWithGoogle();
      if (!credential) return; // Redirect flow: handled by the effect above after reload.
      await completeGoogleSignUp(credential);
    } catch (err) {
      setServerError(friendlyFirebaseError(err));
    } finally {
      setGoogleBusy(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    setServerError('');
    if (!isWorkEmail(values.email)) {
      setServerError(WORK_EMAIL_ONLY_MESSAGE);
      return;
    }
    try {
      const credential = await signUpWithEmail(values.email, values.password);
      await sendVerificationEmail(credential.user);
      try {
        // The backend rejects unverified emails, so for a brand-new
        // sign-up this exchange is expected to fail until the user
        // verifies — that is the verify-first state below.
        const res = await exchangeFirebaseSession(await credential.user.getIdToken(), {
          fullName: values.fullName,
          organizationName: values.organizationName,
          websiteUrl: values.websiteUrl || undefined
        });
        finishRegistration(res);
      } catch (exchangeErr) {
        if (isBackendUnavailableError(exchangeErr)) {
          // No backend behind the static Pages host: the Firebase account
          // is created and the verification email is sent; the workspace
          // is provisioned once a backend is connected.
          setVerifySentEmail(values.email);
          return;
        }
        const status = (exchangeErr as { status?: number })?.status;
        if (status === 401 || status === 403) {
          setVerifySentEmail(values.email);
          return;
        }
        throw exchangeErr;
      }
    } catch (err) {
      // Fallback: backend password register, only when Firebase itself is
      // unreachable (network error) AND a backend is configured. Never
      // fall back to POST /api/auth/register with no backend configured.
      if (isNetworkError(err) && isBackendConfigured) {
        try {
          const res = await apiRequest<AuthPayload>('/api/auth/register', {
            method: 'POST',
            skipAuth: true,
            body: JSON.stringify(values)
          });
          finishRegistration(res);
          return;
        } catch (fallbackErr) {
          setServerError(fallbackErr instanceof Error ? fallbackErr.message : 'Registration failed');
          return;
        }
      }
      setServerError(friendlyFirebaseError(err));
    }
  };

  const onResendVerification = async () => {
    setResendNote('');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setResendNote('Please sign in first, then request a new verification email.');
      return;
    }
    try {
      await sendVerificationEmail(currentUser);
      setResendNote('Verification email re-sent. Please check your inbox.');
    } catch (err) {
      setResendNote(friendlyFirebaseError(err));
    }
  };

  if (verifySentEmail) {
    return (
      <AuthWrapper
        title="Check your inbox to verify your email"
        subtitle="Your workspace is created after your email is verified."
      >
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p>
            We sent a verification email to <span className="font-semibold">{verifySentEmail}</span>.
          </p>
          <p className="mt-2">Check your inbox and verify your email, then sign in — your workspace will be ready.</p>
        </div>
        {resendNote && <p className="mt-3 text-xs text-slate-500">{resendNote}</p>}
        <Button variant="outline" onClick={onResendVerification} className="mt-4 w-full">
          Resend verification email
        </Button>
        <Link to="/login">
          <Button className="mt-3 w-full">Go to Sign In</Button>
        </Link>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      title="Create your ekiddy workspace"
      subtitle="Get 500 free credits to research your market and launch your first outreach workflow."
    >
      <GoogleButton onClick={onGoogleClick} loading={googleBusy} />
      <Divider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <ErrorBox message={serverError} />
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    try {
      await sendResetEmail(values.email);
    } catch {
      // Always show the same generic message, so the response never
      // reveals whether an account exists for that email.
    }
    setMessage(RESET_SENT_MESSAGE);
  };

  return (
    <AuthWrapper title="Reset your password" subtitle="Enter your account email to receive reset instructions.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <p>{message}</p>
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
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // Firebase reset links carry ?mode=resetPassword&oobCode=... ; the old
  // backend flow used ?token=... instead.
  const oobCode = params.get('oobCode') || '';
  const mode = params.get('mode') || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: oobCode || params.get('token') || '' }
  });

  // Verify the Firebase reset code up front so a bad/expired link fails
  // before the user types a new password.
  useEffect(() => {
    if (!oobCode || mode !== 'resetPassword') return;
    verifyResetCode(oobCode)
      .then((email) => setVerifiedEmail(email))
      .catch(() => setErrorMsg('This reset link is invalid or has expired. Please request a new one.'));
  }, [oobCode, mode]);

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    setErrorMsg('');
    try {
      if (oobCode) {
        await confirmReset(oobCode, values.newPassword);
      } else {
        await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify(values)
        });
      }
      addToast({ type: 'success', title: 'Password updated', description: 'Please sign in with your new password.' });
      navigate('/login');
    } catch (err) {
      setErrorMsg(err instanceof Error && (err as { code?: string }).code ? friendlyFirebaseError(err) : err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <AuthWrapper
      title="Choose a new password"
      subtitle={oobCode ? 'Enter a new password for your account.' : 'Paste your reset token and enter a strong password.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
        {verifiedEmail && (
          <p className="text-xs text-slate-500">
            Resetting the password for <span className="font-semibold text-slate-700 dark:text-slate-200">{verifiedEmail}</span>
          </p>
        )}
        {oobCode ? (
          <input type="hidden" {...register('token')} />
        ) : (
          <Input label="Reset Token" {...register('token')} error={errors.token?.message} />
        )}
        <Input label="New Password" type="password" {...register('newPassword')} error={errors.newPassword?.message} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Update Password
        </Button>
      </form>
    </AuthWrapper>
  );
}
