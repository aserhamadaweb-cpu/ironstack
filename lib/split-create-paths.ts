/** Fork screen before manual builder, AI builder, or profile recommendations. */
export const CREATE_SPLIT_CHOICE_PATH = '/dashboard/splits/new'

export const MANUAL_SPLIT_CREATE_PATH = '/dashboard/splits/create'

export const AI_SPLIT_BUILDER_PATH = '/dashboard/splits/ai-builder'

export const RECOMMENDED_SPLITS_PATH = '/dashboard/splits/recommendations'

export function createSplitChoiceHref(homeLibrary = false): string {
  return homeLibrary
    ? `${CREATE_SPLIT_CHOICE_PATH}?home=1`
    : CREATE_SPLIT_CHOICE_PATH
}

export function manualSplitCreateHref(homeLibrary = false): string {
  return homeLibrary
    ? `${MANUAL_SPLIT_CREATE_PATH}?home=1`
    : MANUAL_SPLIT_CREATE_PATH
}
