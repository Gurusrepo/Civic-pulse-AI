import * as authService from './auth.service.js';
import { env } from '../../config/env.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000
};

export async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    const { token } = await authService.login({ email: req.body.email, password: req.body.password });
    res.cookie('civicpulse_token', token, cookieOptions);
    res.status(201).json({ user });
  } catch (error) { next(error); }
}

export async function login(req, res, next) {
  try {
    const { user, token } = await authService.login(req.body);
    res.cookie('civicpulse_token', token, cookieOptions);
    res.json({ user });
  } catch (error) { next(error); }
}

export function me(req, res) {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } });
}

export function logout(req, res) {
  const { maxAge, ...clearOptions } = cookieOptions;
  void maxAge;
  res.clearCookie('civicpulse_token', clearOptions);
  res.status(204).end();
}
