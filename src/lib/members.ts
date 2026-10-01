// Member accounts, powered by Supabase Auth plus a "profiles" table (see supabase/schema.sql).
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { config } from '../config';

export const membersReady = Boolean(config.supabaseUrl && config.supabaseAnonKey);

let client: SupabaseClient | null = null;
export function supabase() {
  if (!membersReady) throw new Error('Member accounts are not configured yet.');
  client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  return client;
}

export interface Profile {
  first_name: string; last_name: string; phone: string | null; area_of_interest: string | null;
}

/** Full URL for a page on this site, used for links inside Supabase emails. */
export function siteUrl(path: string) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return window.location.origin + base + path;
}

export async function currentUser(): Promise<User | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user ?? null;
}

export async function getProfile(user: User): Promise<Profile> {
  const meta = user.user_metadata || {};
  const { data } = await supabase().from('profiles')
    .select('first_name,last_name,phone,area_of_interest').eq('id', user.id).maybeSingle();
  return data ?? {
    first_name: meta.first_name || '', last_name: meta.last_name || '',
    phone: meta.phone || null, area_of_interest: meta.area_of_interest || null,
  };
}

/** Friendlier wording for the errors members are most likely to hit. */
export function friendly(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match. Try again or reset your password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link we sent.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'There is already an account with that email. Try signing in instead.';
  if (m.includes('password should be')) return 'Please use a password with at least 8 characters.';
  if (m.includes('rate limit')) return 'Too many tries in a short time. Please wait a few minutes and try again.';
  if (m.includes('same password') || m.includes('different from the old')) return 'Your new password needs to be different from your current one.';
  return message || 'Something went wrong. Please try again.';
}

/** Show a status message in a form's [data-msg] box. */
export function say(form: Element, text: string, kind: 'error' | 'ok' = 'error') {
  const box = form.querySelector<HTMLElement>('[data-msg]');
  if (!box) return;
  box.textContent = text;
  box.className = `msg ${kind}`;
  box.hidden = !text;
  if (text) box.focus();
}

/** Disable a form's submit button while a request runs. */
export async function busy<T>(form: HTMLFormElement, label: string, work: () => Promise<T>) {
  const btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
  const original = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = label; }
  try { return await work(); }
  finally { if (btn) { btn.disabled = false; btn.textContent = original ?? ''; } }
}

export function field(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? '').trim();
}
