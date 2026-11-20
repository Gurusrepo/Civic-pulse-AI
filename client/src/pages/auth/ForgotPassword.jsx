import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTranslation } from '../../i18n/LocaleProvider.jsx';
import { isValidEmail } from '../../utils/validation.js';
import nammakkalLogo from '../../assets/nammakkal-logo.png';

const initialStep = 'request';

export default function ForgotPassword() {
  const { requestPasswordReset, completePasswordReset } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function handleRequestCode(event) {
    event.preventDefault();
    setErrorMessage('');
    if (!isValidEmail(email.trim())) {
      setErrorMessage(t('auth.invalidEmail'));
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email: email.trim().toLowerCase() });
      setInfoMessage(t('auth.genericSent'));
      setStep('reset');
      setResendSeconds(60);
    } catch (error) {
      setErrorMessage(error.response?.status === 429 ? t('auth.rateLimited') : t('auth.requestError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email: email.trim().toLowerCase() });
      setInfoMessage(t('auth.genericSent'));
      setResendSeconds(60);
    } catch (error) {
      setErrorMessage(error.response?.status === 429 ? t('auth.rateLimited') : t('auth.requestError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setErrorMessage('');
    const passwordBytes = new TextEncoder().encode(password).length;
    if (password.length < 10 || password.length > 72 || passwordBytes > 72) {
      setErrorMessage(t('auth.passwordLengthError'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('auth.passwordMismatch'));
      return;
    }
    setIsSubmitting(true);
    try {
      await completePasswordReset({ email: email.trim().toLowerCase(), code, password });
      setStep('complete');
      setInfoMessage(t('auth.successBody'));
    } catch (error) {
      if (error.response?.status === 429) setErrorMessage(t('auth.rateLimited'));
      else if (error.response?.status === 400) setErrorMessage(t('auth.invalidCode'));
      else setErrorMessage(t('auth.requestError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6ef] px-5 py-10 sm:px-8">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e2d5] bg-white p-6 shadow-sm sm:p-9">
        <Link to="/" aria-label="NAMMAKKAL home" className="mb-8 inline-flex rounded-xl bg-[#fbfaf5] p-2">
          <img className="h-auto w-48" src={nammakkalLogo} alt="NAMMAKKAL" />
        </Link>
        {step === 'complete' ? (
          <div aria-live="polite">
            <h1 className="text-2xl font-semibold text-[#20382a]">{t('auth.successTitle')}</h1>
            <p className="mt-3 text-sm leading-6 text-[#68736a]">{infoMessage}</p>
            <Link to="/login" className="mt-7 flex min-h-11 items-center justify-center rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white">
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-[#20382a]">{t('auth.forgotTitle')}</h1>
            <p className="mt-3 text-sm leading-6 text-[#68736a]">{t('auth.forgotIntro')}</p>
            {errorMessage && <p role="alert" className="mt-5 rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{errorMessage}</p>}
            {step === 'request' ? (
              <form className="mt-6 space-y-4" onSubmit={handleRequestCode} aria-busy={isSubmitting}>
                <label htmlFor="reset-email" className="block text-sm font-medium text-[#34483a]">{t('auth.emailLabel')}</label>
                <input id="reset-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
                <button type="submit" disabled={isSubmitting} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white disabled:opacity-60">
                  {isSubmitting ? t('auth.sending') : t('auth.requestResetCode')}
                </button>
              </form>
            ) : (
              <div className="mt-6">
                {infoMessage && <p role="status" className="mb-4 rounded-xl border border-[#d4e2d3] bg-[#f2f8f1] px-4 py-3 text-sm text-[#385743]">{infoMessage}</p>}
                <p className="mb-4 text-sm text-[#68736a]">{email.trim()}</p>
                <form className="space-y-4" onSubmit={handleResetPassword} aria-busy={isSubmitting}>
                  <div>
                    <label htmlFor="reset-code" className="mb-2 block text-sm font-medium text-[#34483a]">{t('auth.verificationCode')}</label>
                    <input id="reset-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
                  </div>
                  <div>
                    <label htmlFor="reset-password" className="mb-2 block text-sm font-medium text-[#34483a]">{t('auth.newPassword')}</label>
                    <input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
                  </div>
                  <div>
                    <label htmlFor="reset-confirm-password" className="mb-2 block text-sm font-medium text-[#34483a]">{t('auth.confirmPassword')}</label>
                    <input id="reset-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
                  </div>
                  <button type="submit" disabled={isSubmitting || code.length !== 6} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white disabled:opacity-60">
                    {isSubmitting ? t('auth.resetting') : t('auth.resetPassword')}
                  </button>
                </form>
                <button type="button" onClick={handleResendCode} disabled={isSubmitting || resendSeconds > 0} className="mt-4 min-h-10 text-sm font-semibold text-[#1d4933] underline underline-offset-2 disabled:text-[#8b948d]">
                  {resendSeconds > 0 ? t('auth.resendCountdown', { seconds: resendSeconds }) : t('auth.resendResetCode')}
                </button>
              </div>
            )}
            <p className="mt-5 text-xs leading-5 text-[#7a847b]">{t('auth.privacyNote')}</p>
            <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-[#1d4933] underline underline-offset-2">{t('auth.backToLogin')}</Link>
          </>
        )}
      </section>
    </main>
  );
}
