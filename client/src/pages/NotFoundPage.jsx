import { Link } from 'react-router-dom';
import nammakkalLogo from '../assets/nammakkal-logo.png';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6ef] px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-[#e5e2d5] bg-white p-8 text-center shadow-sm sm:p-12">
        <img className="mx-auto mb-8 h-auto w-56 max-w-full" src={nammakkalLogo} alt="NAMMAKKAL" />
        <h1 className="text-3xl font-semibold tracking-tight text-[#193b2a]">Page not found</h1>
        <p className="mt-4 leading-7 text-[#68736a]">That address does not match a NAMMAKKAL page.</p>
        <Link className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[#1d4933] px-6 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-[#477454]/25" to="/">Go to home</Link>
      </section>
    </main>
  );
}
