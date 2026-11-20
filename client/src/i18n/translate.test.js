import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from './catalogs/en.js';
import ta from './catalogs/ta.js';
import { translateMessage } from './translate.js';

const profileSource = fs.readFileSync(new URL('../pages/citizen/Profile.jsx', import.meta.url), 'utf8');
const profileKeys = [...profileSource.matchAll(/\b(?:t|translationRef\.current)\(['"]([^'"]+)['"]/g)].map((match) => match[1]);
const authSources = [
  '../pages/auth/ForgotPassword.jsx',
  '../pages/auth/Login.jsx',
  '../pages/auth/Register.jsx'
].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const authKeys = authSources.flatMap((source) =>
  [...source.matchAll(/\bt\(['"]([^'"]+)['"]/g)].map((match) => match[1])
);

test('every literal translation key used by authentication pages resolves in English and Tamil', () => {
  assert.ok(authKeys.length > 0);
  for (const [locale, catalog] of [['en', en], ['ta', ta]]) {
    const missing = authKeys.filter((key) => typeof key.split('.').reduce((value, part) => value?.[part], catalog) !== 'string');
    assert.deepEqual(missing, [], `${locale} is missing password recovery translations`);
  }
});

test('Admin navigation and overview translation keys resolve in English and Tamil', () => {
  const adminSources = [
    '../layouts/AdminLayout.jsx',
    '../pages/admin/AdminOverview.jsx',
    '../pages/admin/AdminSectionPlaceholder.jsx',
    '../pages/admin/ReportedProblems.jsx'
  ].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
  const literalKeys = adminSources.flatMap((source) =>
    [...source.matchAll(/\bt\(['"]([^'"]+)['"]/g)].map((match) => match[1])
  );
  const generatedKeys = [
    ...[
      'overview', 'complaints', 'reportedProblems', 'suggestions', 'announcements',
      'officers', 'wards', 'teams', 'duplicateReviews', 'resolutionDisputes',
      'notifications', 'settings'
    ].map((key) => `admin.navigation.${key}`),
    ...[
      'totalComplaints', 'openComplaints', 'inProgressComplaints', 'resolvedComplaints',
      'reportedProblems', 'suggestions', 'activeOfficers', 'publishedAnnouncements'
    ].map((key) => `admin.overview.stats.${key}`),
    ...['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((status) => `admin.overview.statuses.${status}`),
    ...['LOGIN_ISSUE', 'PROFILE_ISSUE', 'TECHNICAL_ERROR', 'UI_DESIGN', 'OTHER'].map(
      (cat) => `admin.reportedProblems.categories.${cat}`
    ),
    ...['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map(
      (status) => `admin.reportedProblems.statuses.${status}`
    )
  ];

  for (const [locale, catalog] of [['en', en], ['ta', ta]]) {
    const missing = [...literalKeys, ...generatedKeys].filter((key) =>
      typeof key.split('.').reduce((value, part) => value?.[part], catalog) !== 'string'
    );
    assert.deepEqual(missing, [], `${locale} is missing Admin translations`);
  }
});

test('every literal translation key used by Profile resolves to text in English and Tamil', () => {
  assert.ok(profileKeys.length > 0);
  for (const [locale, catalog] of [['en', en], ['ta', ta]]) {
    const missing = profileKeys.filter((key) => typeof key.split('.').reduce((value, part) => value?.[part], catalog) !== 'string');
    assert.deepEqual(missing, [], `${locale} is missing Profile translations`);
  }
});

test('citizen dashboard navigation and help references all have English messages', () => {
  const roots = [
    new URL('../pages/citizen/', import.meta.url),
    new URL('../layouts/CitizenLayout.jsx', import.meta.url),
    new URL('../components/citizen/', import.meta.url)
  ];
  const sources = [];
  for (const root of roots) {
    if (fs.statSync(root).isDirectory()) {
      for (const file of fs.readdirSync(root)) {
        if (file.endsWith('.jsx')) sources.push(fs.readFileSync(new URL(file, root), 'utf8'));
      }
    } else sources.push(fs.readFileSync(root, 'utf8'));
  }
  const keys = new Set(sources.flatMap((source) => [...source.matchAll(/['"]((?:navigation|help)\.[A-Za-z0-9]+)['"]/g)].map((match) => match[1])));
  const missing = [...keys].filter((key) => typeof key.split('.').reduce((value, part) => value?.[part], en) !== 'string');
  assert.deepEqual(missing, []);
  assert.equal(en.navigation.more, 'Hamburger Menu');
  assert.equal(ta.navigation.more, 'ஹாம்பர்கர் மெனு');
});

test('translation lookup switches English to Tamil and back without exposing a key', () => {
  assert.equal(translateMessage(en, en, 'en', 'profile.fullName'), 'Full name');
  const tamil = translateMessage(ta, en, 'ta', 'profile.fullName');
  assert.notEqual(tamil, 'profile.fullName');
  assert.equal(translateMessage(en, en, 'en', 'profile.fullName'), 'Full name');
});

test('missing translations warn and use a readable fallback instead of returning a raw key', () => {
  const warnings = [];
  assert.equal(translateMessage({}, {}, 'en', 'profile.missing', {}, (key, locale) => warnings.push([key, locale])), 'Translation unavailable');
  assert.deepEqual(warnings, [['profile.missing', 'en']]);
  assert.equal(translateMessage({}, { profile: { available: 'Available' } }, 'ta', 'profile.available'), 'Available');
});
