import { env } from '../../config/env.js';

export function calculateAge(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = now.getUTCFullYear() - year;
  const birthdayHasPassed = now.getUTCMonth() + 1 > month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function getCitizenEligibility(dateOfBirth, now = new Date()) {
  const age = calculateAge(dateOfBirth, now);
  if (age === null) return { age: null, ageBasedCitizenCategory: 'NOT_SET', ageBasedCitizenEligible: false };
  const eligible = age >= env.CITIZEN_ELIGIBILITY_MIN_AGE;
  const category = !eligible ? 'MINOR'
    : age >= env.SENIOR_CITIZEN_MIN_AGE ? 'SENIOR_CITIZEN' : 'CITIZEN';
  return { age, ageBasedCitizenCategory: category, ageBasedCitizenEligible: eligible };
}
