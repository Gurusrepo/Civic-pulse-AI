import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;
let testTransport;

export class EmailDeliveryError extends Error {
  constructor(message = 'Email delivery failed') {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

function getTransporter() {
  if (testTransport) return testTransport;
  if (!env.EMAIL_USER || !env.EMAIL_PASS || !env.OTP_SECRET) {
    throw new EmailDeliveryError('Gmail SMTP is not configured');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS.replace(/\s/g, '')
      }
    });
  }
  return transporter;
}

function getPurposeContent(purpose, code) {
  const purposeText = {
    REGISTRATION: 'verify your NamMakkal account',
    LOGIN: 'sign in to NamMakkal',
    PASSWORD_RESET: 'reset your NamMakkal password',
    PROFILE_VERIFICATION: 'verify your email address'
  }[purpose];
  if (!purposeText) throw new Error('Unsupported email verification purpose');
  return {
    subject: purpose === 'PASSWORD_RESET' ? 'Reset your NamMakkal password' : 'Your NamMakkal verification code',
    text: `Use ${code} to ${purposeText}. This code expires in 10 minutes. If you did not request it, you can ignore this email.`
  };
}

export async function sendVerificationEmail({ to, code, purpose }) {
  const content = getPurposeContent(purpose, code);
  let result;
  try {
    result = await getTransporter().sendMail({
      from: { name: 'NamMakkal', address: env.EMAIL_USER },
      to,
      ...content
    });
  } catch (error) {
    const knownCodes = new Set(['EAUTH', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EDNS',
      'ETIMEDOUT', 'EHOSTUNREACH', 'ESOCKET', 'EENVELOPE']);
    console.error('Gmail SMTP delivery failed', {
      code: knownCodes.has(error?.code) ? error.code : 'UNCLASSIFIED',
      responseCode: Number.isInteger(error?.responseCode) ? error.responseCode : undefined
    });
    throw new EmailDeliveryError();
  }
  const accepted = Array.isArray(result?.accepted) ? result.accepted : [];
  if (!accepted.some((recipient) => String(recipient).toLowerCase() === to.toLowerCase())) {
    console.error('Gmail SMTP did not accept the verification recipient', {
      responseCode: Number.isInteger(result?.responseCode) ? result.responseCode : undefined
    });
    throw new EmailDeliveryError();
  }
}

export function setEmailTransportForTesting(transport) {
  if (env.NODE_ENV !== 'test') throw new Error('Email transport injection is available only in tests');
  if (!transport || typeof transport.sendMail !== 'function') {
    throw new TypeError('A test transport with sendMail is required');
  }
  testTransport = transport;
}
