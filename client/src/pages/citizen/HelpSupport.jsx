import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/LocaleProvider.jsx';

export default function HelpSupport() {
  const { t } = useTranslation();
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
    </div>
  );
}
