type GoogleCredentialResponse = {
  credential: string
  select_by?: string
}

type GooglePromptNotification = {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
  getDismissedReason: () => string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
    context?: 'signin' | 'signup' | 'use'
    itp_support?: boolean
  }) => void
  prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
    },
  ) => void
  cancel: () => void
}

type GoogleGsi = {
  accounts: {
    id: GoogleAccountsId
  }
}

declare global {
  interface Window {
    google?: GoogleGsi
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let gsiLoadPromise: Promise<GoogleGsi> | null = null

export type GoogleIdentityErrorCode =
  | 'cancelled'
  | 'script_load_failed'
  | 'unregistered_origin'
  | 'invalid_client'
  | 'no_credential'
  | 'unknown'

export class GoogleIdentityError extends Error {
  readonly code: GoogleIdentityErrorCode

  constructor(code: GoogleIdentityErrorCode, message: string) {
    super(message)
    this.name = 'GoogleIdentityError'
    this.code = code
  }
}

export function isGoogleIdentityError(err: unknown): err is GoogleIdentityError {
  return err instanceof GoogleIdentityError
}

export function loadGoogleIdentityServices(): Promise<GoogleGsi> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new GoogleIdentityError(
        'script_load_failed',
        'Google Identity is only available in the browser.',
      ),
    )
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google)
  }
  if (gsiLoadPromise) return gsiLoadPromise

  gsiLoadPromise = new Promise((resolve, reject) => {
    const fail = () => {
      gsiLoadPromise = null
      reject(
        new GoogleIdentityError(
          'script_load_failed',
          'Could not load Google Identity. Check your network, then try again.',
        ),
      )
    }

    const succeed = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else fail()
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`,
    )
    if (existing) {
      if (window.google?.accounts?.id) {
        succeed()
        return
      }
      existing.addEventListener('load', succeed)
      existing.addEventListener('error', fail)
      // Script may already have finished loading before listeners attached.
      window.setTimeout(() => {
        if (window.google?.accounts?.id) succeed()
      }, 0)
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SCRIPT_SRC
    script.async = true
    script.onload = succeed
    script.onerror = fail
    document.head.appendChild(script)
  })

  return gsiLoadPromise
}

function reasonToError(
  reason: string,
): GoogleIdentityError | null {
  const lower = reason.toLowerCase()
  if (lower.includes('unregistered_origin')) {
    return new GoogleIdentityError(
      'unregistered_origin',
      `Google blocked this site (${typeof window !== 'undefined' ? window.location.origin : 'unknown'}). Add it under Google Cloud → Credentials → Authorized JavaScript origins.`,
    )
  }
  if (lower.includes('invalid_client') || lower.includes('missing_client')) {
    return new GoogleIdentityError(
      'invalid_client',
      'Google Client ID is invalid for this app. Check NEXT_PUBLIC_GOOGLE_CLIENT_ID.',
    )
  }
  return null
}

/**
 * Request a Google ID token without leaving the current window.
 * Required for installed PWAs — redirect OAuth opens Safari/Chrome with a
 * separate cookie jar, so the app would look signed-out after reopen.
 */
export async function requestGoogleIdToken(clientId: string): Promise<string> {
  const google = await loadGoogleIdentityServices()

  return new Promise((resolve, reject) => {
    let settled = false
    let fallbackHost: HTMLDivElement | null = null
    let fallbackTimer = 0

    const finish = (credential: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(credential)
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    const cleanup = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer)
      try {
        google.accounts.id.cancel()
      } catch {
        /* ignore */
      }
      fallbackHost?.remove()
      fallbackHost = null
    }

    const onCredential = (response: GoogleCredentialResponse) => {
      if (!response?.credential) {
        fail(
          new GoogleIdentityError(
            'no_credential',
            'Google did not return an ID token.',
          ),
        )
        return
      }
      finish(response.credential)
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
      // FedCM is flaky in installed PWAs / some WebViews — prefer classic prompt.
      use_fedcm_for_prompt: false,
      context: 'signin',
      itp_support: true,
    })

    const showFallbackButton = () => {
      if (settled || fallbackHost) return
      fallbackHost = document.createElement('div')
      fallbackHost.setAttribute('data-ironstack-gsi', '1')
      fallbackHost.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);padding:1.25rem;'
      fallbackHost.addEventListener('click', (event) => {
        if (event.target === fallbackHost) {
          fail(
            new GoogleIdentityError(
              'cancelled',
              'Google sign-in was cancelled.',
            ),
          )
        }
      })

      const panel = document.createElement('div')
      panel.style.cssText =
        'width:min(100%,22rem);border-radius:1rem;border:1px solid rgba(212,175,55,0.35);background:#121214;padding:1.25rem;display:flex;flex-direction:column;align-items:center;gap:0.85rem;'
      panel.addEventListener('click', (event) => event.stopPropagation())

      const title = document.createElement('p')
      title.textContent = 'Continue with Google'
      title.style.cssText =
        'margin:0;font:600 0.95rem/1.3 system-ui,sans-serif;color:#f5f5f5;text-align:center;'

      const buttonMount = document.createElement('div')
      buttonMount.style.cssText =
        'width:100%;display:flex;justify-content:center;'

      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = 'Cancel'
      cancel.style.cssText =
        'border:0;background:transparent;color:#a3a3a3;font:500 0.85rem/1 system-ui,sans-serif;padding:0.5rem 0.75rem;cursor:pointer;'
      cancel.addEventListener('click', () =>
        fail(
          new GoogleIdentityError(
            'cancelled',
            'Google sign-in was cancelled.',
          ),
        ),
      )

      panel.append(title, buttonMount, cancel)
      fallbackHost.append(panel)
      document.body.append(fallbackHost)

      try {
        google.accounts.id.renderButton(buttonMount, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 320,
        })
      } catch (err) {
        fail(
          err instanceof Error
            ? err
            : new GoogleIdentityError(
                'unknown',
                'Google sign-in button failed to render.',
              ),
        )
      }
    }

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason?.() || 'unknown_reason'
        const mapped = reasonToError(reason)
        if (mapped) {
          fail(mapped)
          return
        }
        showFallbackButton()
        return
      }
      if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
        showFallbackButton()
      }
    })

    // Some PWA/WebKit builds never fire the prompt listener — show the in-app
    // Google button shortly after so the user is never stuck.
    fallbackTimer = window.setTimeout(() => {
      if (!settled) showFallbackButton()
    }, 900)
  })
}
