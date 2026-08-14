'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Loader2, LogOut, Moon, Shield, Sun } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { signOut } from '@/app/login/actions'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { NotificationSettings } from '@/components/notification-settings'
import { BodyStatsSettings } from '@/components/body-stats-settings'
import { GuestAccountUpgrade } from '@/components/guest-account-upgrade'
import { useTheme } from '@/components/theme-provider'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type BodyWeightLog,
  type NotificationPreferences,
  type PrivacyFollow,
  type PrivacyFriendRequest,
  type PrivacyMessage,
  type ProfileGender,
} from '@/lib/database.types'
import {
  deleteAccountAction,
  updateAccountEmailAction,
  updateAccountPasswordAction,
  updateLanguagePreferenceAction,
  updateNotificationPreferencesAction,
  updatePreferredUnitAction,
  updatePrivacySettingsAction,
} from '@/lib/data/profile-actions'
import {
  LOCALE_STORAGE_KEY,
  localeDir,
  type AppLocale,
} from '@/lib/i18n'
import type { ThemePreference } from '@/lib/theme'
import type { WeightUnit } from '@/lib/units'

type SettingsPageClientProps = {
  email: string
  preferredUnit: WeightUnit
  notificationPreferences: NotificationPreferences
  privacyFollow: PrivacyFollow
  privacyFriendRequest: PrivacyFriendRequest
  privacyMessage: PrivacyMessage
  initialLanguage?: AppLocale
  heightCm: number | null
  gender: ProfileGender | null
  birthDate: string | null
  currentWeightKg: number | null
  weightLogs: BodyWeightLog[]
  isGuest?: boolean
}

function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  disabled?: boolean
  onChange: (next: T) => void
}) {
  return (
    <div>
      <p className="text-sm text-foreground">{label}</p>
      <div
        className="mt-2 inline-flex flex-wrap rounded-xl border border-silver/15 p-1"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-lg px-3 text-[10px] font-semibold tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function applyLocaleToDocument(locale: AppLocale) {
  const root = document.documentElement
  root.lang = locale
  root.dir = localeDir(locale)
  root.dataset.locale = locale
  document.body.classList.toggle('font-arabic', locale === 'ar')
  document.body.classList.toggle('font-sans', locale !== 'ar')
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export function SettingsPageClient({
  email,
  preferredUnit,
  notificationPreferences,
  privacyFollow,
  privacyFriendRequest,
  privacyMessage,
  initialLanguage,
  heightCm,
  gender,
  birthDate,
  currentWeightKg,
  weightLogs,
  isGuest = false,
}: SettingsPageClientProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tNotif = useTranslations('notifPrefs')
  const router = useRouter()
  const localeFromIntl = useLocale()
  const language = (
    initialLanguage === 'ar' || initialLanguage === 'en'
      ? initialLanguage
      : localeFromIntl === 'ar'
        ? 'ar'
        : 'en'
  ) as AppLocale

  const { theme, setTheme, pending: themePending } = useTheme()
  const [unit, setUnit] = useState<WeightUnit>(preferredUnit)
  const [unitMsg, setUnitMsg] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...notificationPreferences,
  }))
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null)
  const [follow, setFollow] = useState<PrivacyFollow>(privacyFollow)
  const [friendReq, setFriendReq] =
    useState<PrivacyFriendRequest>(privacyFriendRequest)
  const [message, setMessage] = useState<PrivacyMessage>(privacyMessage)
  const [privacyMsg, setPrivacyMsg] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState(email)
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [showSignOut, setShowSignOut] = useState(false)
  const [signOutMsg, setSignOutMsg] = useState<string | null>(null)
  const [langMsg, setLangMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const saveLanguage = (next: AppLocale) => {
    if (next === language) return
    setLangMsg(null)
    applyLocaleToDocument(next)
    startTransition(async () => {
      const result = await updateLanguagePreferenceAction(next)
      if (!result.ok) {
        applyLocaleToDocument(language)
        setLangMsg(result.error)
        return
      }
      router.refresh()
    })
  }

  const saveUnit = (next: WeightUnit) => {
    setUnitMsg(null)
    setUnit(next)
    startTransition(async () => {
      const result = await updatePreferredUnitAction(next)
      if (!result.ok) {
        setUnit(preferredUnit)
        setUnitMsg(result.error)
        return
      }
      setUnitMsg(t('weightsShowIn', { unit: next }))
      router.refresh()
    })
  }

  const togglePref = (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setPrefsMsg(null)
    startTransition(async () => {
      const result = await updateNotificationPreferencesAction(next)
      if (!result.ok) {
        setPrefs(prefs)
        setPrefsMsg(result.error)
        return
      }
      setPrefsMsg(t('notifSaved'))
      router.refresh()
    })
  }

  const savePrivacy = (patch: {
    privacy_follow?: PrivacyFollow
    privacy_friend_request?: PrivacyFriendRequest
    privacy_message?: PrivacyMessage
  }) => {
    const nextFollow = patch.privacy_follow ?? follow
    const nextFriend = patch.privacy_friend_request ?? friendReq
    const nextMessage = patch.privacy_message ?? message
    if (patch.privacy_follow) setFollow(patch.privacy_follow)
    if (patch.privacy_friend_request) setFriendReq(patch.privacy_friend_request)
    if (patch.privacy_message) setMessage(patch.privacy_message)
    setPrivacyMsg(null)
    startTransition(async () => {
      const result = await updatePrivacySettingsAction({
        privacy_follow: nextFollow,
        privacy_friend_request: nextFriend,
        privacy_message: nextMessage,
      })
      if (!result.ok) {
        setFollow(privacyFollow)
        setFriendReq(privacyFriendRequest)
        setMessage(privacyMessage)
        setPrivacyMsg(result.error)
        return
      }
      setPrivacyMsg(t('privacySaved'))
      router.refresh()
    })
  }

  const prefKeys = Object.keys(
    DEFAULT_NOTIFICATION_PREFERENCES,
  ) as Array<keyof NotificationPreferences>

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
      <header>
        <p className="section-kicker">{t('kicker')}</p>
        <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="space-y-3" aria-labelledby="appearance-heading">
        <h2
          id="appearance-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('appearance')}
        </h2>
        <div className="is-panel p-5">
          <p className="text-sm text-foreground">{t('theme')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('themeHint')}</p>
          <div
            className="mt-4 grid grid-cols-2 gap-3"
            role="group"
            aria-label={t('theme')}
          >
            {(
              [
                {
                  value: 'dark' as ThemePreference,
                  label: t('themeDark'),
                  hint: t('themeDarkHint'),
                  Icon: Moon,
                },
                {
                  value: 'light' as ThemePreference,
                  label: t('themeLight'),
                  hint: t('themeLightHint'),
                  Icon: Sun,
                },
              ] as const
            ).map(({ value, label, hint, Icon }) => {
              const selected = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  disabled={themePending}
                  aria-pressed={selected}
                  onClick={() => setTheme(value)}
                  className={`flex min-h-[5.5rem] flex-col items-start gap-2 rounded-xl border px-4 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                    selected
                      ? 'border-gold/45 bg-gold-tint text-gold'
                      : 'border-border bg-background/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="text-sm font-semibold tracking-wide text-foreground">
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="language-heading">
        <h2
          id="language-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('language')}
        </h2>
        <div className="is-panel p-5">
          <p className="text-sm text-foreground">{t('languageTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('languageHint')}
          </p>
          <div
            className="mt-4 grid grid-cols-2 gap-3"
            role="group"
            aria-label={t('languageTitle')}
          >
            {(
              [
                {
                  value: 'en' as AppLocale,
                  label: t('langEn'),
                  hint: t('langEnHint'),
                },
                {
                  value: 'ar' as AppLocale,
                  label: t('langAr'),
                  hint: t('langArHint'),
                },
              ] as const
            ).map(({ value, label, hint }) => {
              const selected = language === value
              return (
                <button
                  key={value}
                  type="button"
                  disabled={pending}
                  aria-pressed={selected}
                  onClick={() => saveLanguage(value)}
                  className={`flex min-h-[5.5rem] flex-col items-start gap-2 rounded-xl border px-4 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                    selected
                      ? 'border-gold/45 bg-gold-tint text-gold'
                      : 'border-border bg-background/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-semibold tracking-wide text-foreground">
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {hint}
                  </span>
                </button>
              )
            })}
          </div>
          {langMsg && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {langMsg}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="units-heading">
        <h2
          id="units-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('units')}
        </h2>
        <div className="is-panel p-5">
          <p className="text-sm text-muted-foreground">{t('unitsHint')}</p>
          <div
            className="mt-4 inline-flex rounded-xl border border-silver/15 p-1"
            role="group"
            aria-label={t('preferredUnit')}
          >
            {(['kg', 'lb'] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={pending}
                aria-pressed={unit === option}
                onClick={() => saveUnit(option)}
                className={`min-h-10 min-w-16 rounded-lg px-4 text-xs font-semibold tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                  unit === option
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          {unitMsg && (
            <p className="mt-3 text-xs text-muted-foreground" role="status">
              {unitMsg}
            </p>
          )}
        </div>
      </section>

      <BodyStatsSettings
        preferredUnit={unit}
        heightCm={heightCm}
        gender={gender}
        birthDate={birthDate}
        currentWeightKg={currentWeightKg}
        weightLogs={weightLogs}
      />

      <section className="space-y-3" aria-labelledby="notif-prefs-heading">
        <h2
          id="notif-prefs-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('notifPrefs')}
        </h2>
        <div className="is-panel divide-y divide-silver/10 p-0">
          {prefKeys.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <p className="text-sm text-foreground">{tNotif(key)}</p>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                disabled={pending}
                onClick={() => togglePref(key)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                  prefs[key]
                    ? 'border-gold/50 bg-gold/30'
                    : 'border-silver/20 bg-card'
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-primary-foreground transition ${
                    prefs[key] ? 'start-6' : 'start-0.5'
                  }`}
                />
                <span className="sr-only">
                  {prefs[key] ? t('disable') : t('enable')} {tNotif(key)}
                </span>
              </button>
            </div>
          ))}
        </div>
        {prefsMsg && (
          <p className="text-xs text-muted-foreground" role="status">
            {prefsMsg}
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="privacy-heading">
        <h2
          id="privacy-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('privacy')}
        </h2>
        <div className="is-panel space-y-6 p-5">
          <Segmented
            label={t('privacyFollow')}
            value={follow}
            disabled={pending}
            onChange={(next) => savePrivacy({ privacy_follow: next })}
            options={[
              { value: 'everyone', label: t('everyone') },
              { value: 'nobody', label: t('nobody') },
            ]}
          />
          <Segmented
            label={t('privacyFriend')}
            value={friendReq}
            disabled={pending}
            onChange={(next) => savePrivacy({ privacy_friend_request: next })}
            options={[
              { value: 'everyone', label: t('everyone') },
              { value: 'nobody', label: t('nobody') },
            ]}
          />
          <Segmented
            label={t('privacyMessage')}
            value={message}
            disabled={pending}
            onChange={(next) => savePrivacy({ privacy_message: next })}
            options={[
              { value: 'everyone', label: t('everyone') },
              { value: 'friends', label: t('friends') },
              { value: 'nobody', label: t('nobody') },
            ]}
          />
          {privacyMsg && (
            <p className="text-xs text-muted-foreground" role="status">
              {privacyMsg}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="push-heading">
        <h2
          id="push-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('push')}
        </h2>
        <NotificationSettings embedded />
      </section>

      <section className="space-y-3" aria-labelledby="account-heading">
        <h2
          id="account-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {isGuest ? t('upgradeAccountHeading') : t('account')}
        </h2>
        {isGuest ? (
          <GuestAccountUpgrade />
        ) : (
        <div className="is-panel space-y-8 p-5">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              setEmailMsg(null)
              startTransition(async () => {
                const result = await updateAccountEmailAction(newEmail)
                if (!result.ok) {
                  setEmailMsg(result.error)
                  return
                }
                setEmailMsg(result.message)
              })
            }}
          >
            <label className="block text-sm text-foreground">
              {t('email')}
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                className="mt-2 h-11 w-full rounded-xl border border-silver/15 bg-background/70 px-3 text-sm outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
              />
            </label>
            <button
              type="submit"
              disabled={pending || newEmail.trim() === email}
              className="btn-pill disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('updateEmail')}
            </button>
            {emailMsg && (
              <p className="text-xs text-muted-foreground" role="status">
                {emailMsg}
              </p>
            )}
          </form>

          <form
            className="space-y-3 border-t border-silver/10 pt-8"
            onSubmit={(e) => {
              e.preventDefault()
              setPasswordMsg(null)
              startTransition(async () => {
                const result = await updateAccountPasswordAction(password)
                if (!result.ok) {
                  setPasswordMsg(result.error)
                  return
                }
                setPassword('')
                setPasswordMsg(t('passwordUpdated'))
              })
            }}
          >
            <label className="block text-sm text-foreground">
              {t('newPassword')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="mt-2 h-11 w-full rounded-xl border border-silver/15 bg-background/70 px-3 text-sm outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
              />
            </label>
            <button
              type="submit"
              disabled={pending || password.length < 8}
              className="btn-pill disabled:opacity-50"
            >
              {t('updatePassword')}
            </button>
            {passwordMsg && (
              <p className="text-xs text-muted-foreground" role="status">
                {passwordMsg}
              </p>
            )}
          </form>

          <div className="border-t border-silver/10 pt-8">
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="text-sm font-medium text-destructive underline-offset-4 hover:underline"
              >
                {t('deleteAccount')}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('deletePrompt')}
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  aria-label={t('deleteConfirmLabel')}
                  className="h-11 w-full rounded-xl border border-destructive/40 bg-background/70 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setDeleteMsg(null)
                      startTransition(async () => {
                        const result = await deleteAccountAction(deleteConfirm)
                        if (!result.ok) {
                          setDeleteMsg(result.error)
                          return
                        }
                        router.replace('/login')
                      })
                    }}
                    className="inline-flex min-h-11 items-center rounded-full bg-destructive px-5 text-xs font-bold tracking-[0.14em] text-foreground disabled:opacity-50"
                  >
                    {t('deleteAccountAction')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDelete(false)
                      setDeleteConfirm('')
                      setDeleteMsg(null)
                    }}
                    className="btn-pill-ghost"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
                {deleteMsg && (
                  <p className="text-xs text-destructive" role="alert">
                    {deleteMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="legal-heading">
        <h2
          id="legal-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('legal')}
        </h2>
        <div className="is-panel space-y-4 p-5">
          <p className="text-sm text-muted-foreground">{t('legalHint')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/20 px-5 text-xs font-bold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              {t('termsLink')}
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/20 px-5 text-xs font-bold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
            >
              <Shield className="size-3.5" aria-hidden="true" />
              {t('privacyLink')}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="session-heading">
        <h2
          id="session-heading"
          className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
        >
          {t('session')}
        </h2>
        <div className="is-panel p-5">
          {!showSignOut ? (
            <button
              type="button"
              onClick={() => {
                setSignOutMsg(null)
                setShowSignOut(true)
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/20 px-5 text-xs font-bold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {t('signOut')}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('signOutPrompt')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setSignOutMsg(null)
                    startTransition(async () => {
                      try {
                        clearIronstackAuthCache()
                        await signOut()
                      } catch {
                        setSignOutMsg(t('signOutFailed'))
                      }
                    })
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold tracking-[0.14em] text-primary-foreground disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut className="size-3.5" aria-hidden="true" />
                  )}
                  {t('confirmSignOut')}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setShowSignOut(false)}
                  className="btn-pill-ghost"
                >
                  {tCommon('cancel')}
                </button>
              </div>
              {signOutMsg && (
                <p className="text-xs text-destructive" role="alert">
                  {signOutMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
