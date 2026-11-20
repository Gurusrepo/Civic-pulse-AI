import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider.jsx';
import { submitBugReport, submitSuggestion } from '../../api/support.js';

export default function HelpSupport() {
  const { t } = useTranslation();
  const [bug, setBug] = useState({ title: '', category: 'TECHNICAL_ERROR', description: '' });
  const [suggestion, setSuggestion] = useState({ title: '', category: 'USER_EXPERIENCE', description: '' });
  const [screenshot, setScreenshot] = useState(null);
  const [submission, setSubmission] = useState({ busy: '', error: '', success: '' });
  async function handleSupportSubmit(event, kind) {
    event.preventDefault();
    setSubmission({ busy: kind, error: '', success: '' });
    try {
      const result = kind === 'bug'
        ? await submitBugReport({ ...bug, screenshot, route: window.location.pathname })
        : await submitSuggestion(suggestion);
      setSubmission({ busy: '', error: '', success: t('help.submissionSuccess', { reference: result.referenceId }) });
      if (kind === 'bug') { setBug({ title: '', category: 'TECHNICAL_ERROR', description: '' }); setScreenshot(null); }
      else setSuggestion({ title: '', category: 'USER_EXPERIENCE', description: '' });
    } catch {
      setSubmission({ busy: '', error: t('help.submissionError'), success: '' });
    }
  }
  const steps = [
    ['help.step1Title', 'help.step1Text'],
    ['help.step2Title', 'help.step2Text'],
    ['help.step3Title', 'help.step3Text'],
    ['help.step4Title', 'help.step4Text']
  ];
  const issueStatuses = [
    ['help.statusLabelOpen', 'help.statusOpen'],
    ['help.statusLabelInProgress', 'help.statusInProgress'],
    ['help.statusLabelResolved', 'help.statusResolved'],
    ['help.statusLabelMerged', 'help.statusMerged']
  ];
  const faqs = [
    ['help.faqLocationQuestion', 'help.faqLocationAnswer'],
    ['help.faqPhotoQuestion', 'help.faqPhotoAnswer'],
    ['help.faqSharedQuestion', 'help.faqSharedAnswer'],
    ['help.faqEditQuestion', 'help.faqEditAnswer'],
    ['help.faqVerificationQuestion', 'help.faqVerificationAnswer'],
    ['help.faqTimeQuestion', 'help.faqTimeAnswer']
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">{t('help.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">{t('help.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736a]">{t('help.introduction')}</p>
      </header>

      

<section
  aria-labelledby="about-heading"
  className="overflow-hidden rounded-2xl border border-[#e5e2d5] bg-white shadow-sm"
>
  <div className="border-b border-[#e5e2d5] bg-[#f7f8f5] p-5 sm:p-7">
    <p className="text-xs font-semibold tracking-[0.16em] text-[#9a7832]">
      ABOUT NamMakkaL
    </p>

    <h2
      id="about-heading"
      className="mt-1 text-xl font-semibold text-[#20382a]"
    >
      Making public services simpler for everyone.
    </h2>

    <p className="mt-2 text-sm leading-6 text-[#68736a]">
      NamMakkal is a citizen-focused platform designed to make accessing
      public services easier, more transparent, and more convenient.
      Our goal is to bring citizens and essential services closer through
      a simple and accessible digital experience.
    </p>
  </div>

  <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-7">
    <div className="rounded-xl bg-[#f7f8f5] p-4">
      <h3 className="text-sm font-semibold text-[#34483a]">
        Citizen First
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#68736a]">
        Designed around citizens' needs, accessibility, and convenience.
      </p>
    </div>

    <div className="rounded-xl bg-[#f7f8f5] p-4">
      <h3 className="text-sm font-semibold text-[#34483a]">
        Transparency
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#68736a]">
        Encouraging clear communication and better visibility into service requests.
      </p>
    </div>

    <div className="rounded-xl bg-[#f7f8f5] p-4">
      <h3 className="text-sm font-semibold text-[#34483a]">
        Better Together
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#68736a]">
        Building a more connected and responsive citizen-service experience.
      </p>
    </div>
  </div>
</section>



      <section aria-labelledby="report-help-heading" className="space-y-4 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">{t('help.startEyebrow')}</p>
          <h2 id="report-help-heading" className="mt-1 text-xl font-semibold text-[#20382a]">{t('help.reportTitle')}</h2>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map(([titleKey, textKey]) => (
            <li key={titleKey} className="rounded-xl bg-[#f7f8f5] p-4">
              <h3 className="text-sm font-semibold text-[#34483a]">{t(titleKey)}</h3>
              <p className="mt-2 text-sm leading-6 text-[#68736a]">{t(textKey)}</p>
            </li>
          ))}
        </ol>
        <Link to="/citizen/complaints/new" className="inline-flex min-h-11 items-center rounded-xl bg-[#1d4933] px-4 text-sm font-semibold text-white hover:bg-[#173d2b] focus:outline-none focus:ring-4 focus:ring-[#477454]/25">
          {t('help.reportAction')}
        </Link>
      </section>

      <section aria-labelledby="tracking-help-heading" className="space-y-4 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">{t('help.trackingEyebrow')}</p>
          <h2 id="tracking-help-heading" className="mt-1 text-xl font-semibold text-[#20382a]">{t('help.trackingTitle')}</h2>
        </div>
        <p className="text-sm leading-6 text-[#68736a]">
          {t('help.trackingPrefix')}<Link to="/citizen/complaints" className="font-semibold text-[#1d4933] underline underline-offset-2">{t('navigation.complaints')}</Link>{t('help.trackingSuffix')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {issueStatuses.map(([statusKey, descriptionKey]) => (
            <article key={statusKey} className="rounded-xl border border-[#edf0e9] p-4">
              <h3 className="text-sm font-semibold text-[#20382a]">{t(statusKey)}</h3>
              <p className="mt-1 text-sm leading-6 text-[#68736a]">{t(descriptionKey)}</p>
            </article>
          ))}
        </div>
        <p className="rounded-xl border border-[#e7d9b4] bg-[#fff9e9] px-4 py-3 text-sm leading-6 text-[#725a23]">
          {t('help.statusCaveat')}
        </p>
      </section>

      <section aria-labelledby="location-photo-heading" className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-6">
          <h2 id="location-photo-heading" className="text-lg font-semibold text-[#20382a]">{t('help.photoTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-[#68736a]">{t('help.photoText')}</p>
        </article>
        <article className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-[#20382a]">{t('help.locationTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-[#68736a]">{t('help.locationText')}</p>
        </article>
      </section>

      <section aria-labelledby="verification-help-heading" className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">{t('help.verificationEyebrow')}</p>
        <h2 id="verification-help-heading" className="mt-1 text-xl font-semibold text-[#20382a]">{t('help.verificationTitle')}</h2>
        <p className="mt-3 text-sm leading-6 text-[#68736a]">{t('help.verificationText')}</p>
      </section>

      <section aria-labelledby="faq-heading" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">{t('help.faqEyebrow')}</p>
          <h2 id="faq-heading" className="mt-1 text-xl font-semibold text-[#20382a]">{t('help.faqTitle')}</h2>
        </div>
        <div className="space-y-2">
          {faqs.map(([questionKey, answerKey]) => (
            <details key={questionKey} className="group rounded-xl border border-[#e5e2d5] bg-white p-4 shadow-sm">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[#20382a] marker:text-[#1d4933] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477454]/40">
                {t(questionKey)}
              </summary>
              <p className="pb-2 pt-1 text-sm leading-6 text-[#68736a]">{t(answerKey)}</p>
            </details>
          ))}
        </div>
      </section>

      
<section className="grid gap-5 lg:grid-cols-2" aria-label={t('help.feedbackTitle')}>
  <form
    onSubmit={(event) => handleSupportSubmit(event, 'bug')}
    className="space-y-4 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-7"
  >
    <h2 className="text-xl font-semibold text-[#20382a]">
      {t('help.problemTitle')}
    </h2>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.issueTitle')}
      <input
        required
        minLength={3}
        maxLength={160}
        value={bug.title}
        onChange={(event) => setBug({ ...bug, title: event.target.value })}
        className={supportInputClass}
      />
    </label>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.category')}
      <select
        value={bug.category}
        onChange={(event) => setBug({ ...bug, category: event.target.value })}
        className={supportInputClass}
      >
        {['LOGIN_ISSUE', 'PROFILE_ISSUE', 'TECHNICAL_ERROR', 'UI_DESIGN', 'OTHER'].map((value) => (
          <option key={value} value={value}>
            {t(`help.bugCategories.${value}`)}
          </option>
        ))}
      </select>
    </label>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.description')}
      <textarea
        required
        minLength={10}
        maxLength={5000}
        rows={4}
        value={bug.description}
        onChange={(event) => setBug({ ...bug, description: event.target.value })}
        className={supportInputClass}
      />
    </label>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.screenshot')}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;

          if (
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
            file.size > 3 * 1024 * 1024
          ) {
            event.target.value = '';
            setSubmission({
              busy: '',
              error: t('help.screenshotError'),
              success: ''
            });
            return;
          }

          setScreenshot(file);
        }}
        className="mt-2 block w-full cursor-pointer rounded-lg border border-[#d8d5c8] bg-[#fafaf7] text-sm text-[#34483a] file:mr-4 file:cursor-pointer file:rounded-l-lg file:border-0 file:border-r file:border-[#d8d5c8] file:bg-[#e9e6d9] file:px-4 file:py-3 file:font-semibold file:text-[#20382a] hover:file:bg-[#dedacb] focus:outline-none focus:ring-2 focus:ring-[#9a7832]"
      />
    </label>

    <button
      disabled={submission.busy === 'bug'}
      className={supportButtonClass}
    >
      {submission.busy === 'bug' ? t('help.submitting') : t('help.submit')}
    </button>
  </form>

  <form
    onSubmit={(event) => handleSupportSubmit(event, 'suggestion')}
    className="space-y-4 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-7"
  >
    <h2 className="text-xl font-semibold text-[#20382a]">
      {t('help.suggestionTitle')}
    </h2>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.issueTitle')}
      <input
        required
        minLength={3}
        maxLength={160}
        value={suggestion.title}
        onChange={(event) => setSuggestion({ ...suggestion, title: event.target.value })}
        className={supportInputClass}
      />
    </label>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.category')}
      <select
        value={suggestion.category}
        onChange={(event) => setSuggestion({ ...suggestion, category: event.target.value })}
        className={supportInputClass}
      >
        {['NEW_FEATURE', 'ACCESSIBILITY', 'USER_EXPERIENCE', 'GOVERNMENT_SERVICES', 'OTHER'].map((value) => (
          <option key={value} value={value}>
            {t(`help.suggestionCategories.${value}`)}
          </option>
        ))}
      </select>
    </label>

    <label className="block text-sm font-semibold text-[#34483a]">
      {t('help.description')}
      <textarea
        required
        minLength={10}
        maxLength={5000}
        rows={4}
        value={suggestion.description}
        onChange={(event) => setSuggestion({ ...suggestion, description: event.target.value })}
        className={supportInputClass}
      />
    </label>

    <button
      disabled={submission.busy === 'suggestion'}
      className={supportButtonClass}
    >
      {submission.busy === 'suggestion' ? t('help.submitting') : t('help.submit')}
    </button>
  </form>
</section>

      {submission.error && <p role="alert" className="text-sm text-[#8b3c2d]">{submission.error}</p>}
      {submission.success && <p role="status" className="rounded-xl border border-[#d4e2d3] bg-[#f2f8f1] px-4 py-3 text-sm text-[#385743]">{submission.success}</p>}
      
  </div>
  );
}

const supportInputClass = 'mt-2 min-h-11 w-full rounded-xl border border-[#d9ded5] bg-white px-3 py-2 text-sm text-[#24362a] focus:border-[#477454] focus:outline-none focus:ring-4 focus:ring-[#477454]/10';
const supportButtonClass = 'min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white hover:bg-[#163b29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60';
