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
  bio?: string | null; birthday?: string | null; employment?: string | null; education?: string | null;
  relationship_status?: string | null;
  bio_public?: boolean; birthday_public?: boolean; employment_public?: boolean;
  education_public?: boolean; relationship_status_public?: boolean;
}

const BASE_FIELDS = 'first_name,last_name,phone,area_of_interest';
// Prototype-stage fields: these columns may not exist in the live profiles table yet. We try
// the fuller select first and fall back to the base fields alone if the database rejects it,
// so a missing migration never breaks the whole profile page, just hides the new fields.
const SOCIAL_FIELDS = 'bio,birthday,employment,education,relationship_status,bio_public,birthday_public,employment_public,education_public,relationship_status_public';

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
  const fallback: Profile = {
    first_name: meta.first_name || '', last_name: meta.last_name || '',
    phone: meta.phone || null, area_of_interest: meta.area_of_interest || null,
  };
  const full = await supabase().from('profiles').select(`${BASE_FIELDS},${SOCIAL_FIELDS}`).eq('id', user.id).maybeSingle();
  if (!full.error) return full.data ?? fallback;
  // The social columns probably do not exist yet; retry with just the original fields.
  const base = await supabase().from('profiles').select(BASE_FIELDS).eq('id', user.id).maybeSingle();
  return base.data ?? fallback;
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
