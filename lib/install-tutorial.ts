import { detectPwaPlatform, type PwaPlatform } from '@/lib/pwa-client'

/** Asset folders under `public/install-tutorial/`. */
export const INSTALL_TUTORIAL_ASSET_ROOT = '/install-tutorial'

export type InstallTutorialPlatform = 'ios' | 'android' | 'windows' | 'generic'

export type InstallTutorialStepDef = {
  /** Stable id — maps to i18n keys under installTutorial.{platform}.{id} */
  id: string
  /**
   * Public URL under /install-tutorial/{platform}/.
   * Set only when a real screenshot ships (iOS today).
   * Null = text-only step — no image area / placeholder.
   */
  imageSrc: string | null
}

/** Step order + optional screenshots per platform. */
export const INSTALL_TUTORIAL_STEP_DEFS: Record<
  InstallTutorialPlatform,
  InstallTutorialStepDef[]
> = {
  ios: [
    {
      id: 'step1',
      imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/ios/step-1-share.jpg`,
    },
    {
      id: 'step2',
      imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/ios/step-2-add-to-home-screen.jpg`,
    },
  ],
  android: [
    { id: 'step1', imageSrc: null },
    { id: 'step2', imageSrc: null },
  ],
  windows: [
    { id: 'step1', imageSrc: null },
    { id: 'step2', imageSrc: null },
  ],
  generic: [],
}

export function mapPwaPlatformToTutorial(
  platform: PwaPlatform,
): InstallTutorialPlatform {
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  if (platform === 'desktop' && typeof window !== 'undefined') {
    if (/Windows/i.test(window.navigator.userAgent)) return 'windows'
  }
  return 'generic'
}

export function detectInstallTutorialPlatform(): InstallTutorialPlatform {
  return mapPwaPlatformToTutorial(detectPwaPlatform())
}

export function tutorialStepsForPlatform(
  platform: InstallTutorialPlatform,
): InstallTutorialStepDef[] {
  return INSTALL_TUTORIAL_STEP_DEFS[platform] ?? []
}
