/**
 * Database row types matching the live IronStack Supabase schema.
 * Keep this in sync with the remote tables — do not invent columns.
 */

export type NotificationPreferences = {
  friend_request: boolean
  friend_accepted: boolean
  new_follower: boolean
  new_message: boolean
  message_request: boolean
  pr_achievement: boolean
  split_saved: boolean
  unfinished_session: boolean
  streak_reminder: boolean
  inactivity_reminder: boolean
  train_today: boolean
  weekly_recap: boolean
  challenge_reminder: boolean
}

export type PrivacyFollow = 'everyone' | 'nobody'
export type PrivacyFriendRequest = 'everyone' | 'nobody'
export type PrivacyMessage = 'everyone' | 'friends' | 'nobody'

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  friend_request: true,
  friend_accepted: true,
  new_follower: true,
  new_message: true,
  message_request: true,
  pr_achievement: true,
  split_saved: true,
  unfinished_session: false,
  streak_reminder: true,
  inactivity_reminder: true,
  train_today: true,
  weekly_recap: true,
  challenge_reminder: true,
}

export type ProfileGender = 'male' | 'female'

/**
 * Safe public profile shape from `public.public_profiles`.
 * Never includes height, weight, birth date, gender, prefs, or private settings.
 */
export type PublicProfile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  is_guest: boolean
}

export const PUBLIC_PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, bio, is_guest' as const

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  preferred_unit: 'kg' | 'lb'
  /** Null means follow System / metadata appearance (not a stored light/dark). */
  theme_preference: 'dark' | 'light' | null
  language: 'en' | 'ar'
  notification_preferences: NotificationPreferences
  privacy_follow: PrivacyFollow
  privacy_friend_request: PrivacyFriendRequest
  privacy_message: PrivacyMessage
  height_cm: number | null
  gender: ProfileGender | null
  birth_date: string | null
  current_weight_kg: number | null
  is_email_verified: boolean
  is_guest: boolean
  /** Times username was changed after the initial set. Max 2. */
  username_change_count: number
  /** Active training program — nullable FK to splits.id */
  primary_split_id: string | null
  created_at: string
  updated_at: string
}

export type BodyWeightLog = {
  id: string
  user_id: string
  weight_kg: number
  logged_at: string
}

export type LiftType = {
  id: string
  slug: string
  name: string
  category: string
  sort_order: number
  is_system: boolean
  image_url: string | null
  muscle_group: string | null
  created_at: string
}

export type LiftLog = {
  id: string
  user_id: string
  lift_type_id: string
  weight: number
  reps: number
  weight_unit: 'kg' | 'lb'
  /** Cardio entries — duration in seconds (null for strength sets). */
  duration_seconds: number | null
  logged_at: string
  notes: string | null
  created_at: string
  updated_at: string
  session_id: string | null
  set_number: number | null
  is_skipped: boolean | null
}

export type PersonalRecord = {
  id: string
  user_id: string
  lift_type_id: string
  /** Denormalized lift name — required on live DB inserts. */
  lift_name?: string | null
  weight: number
  reps: number
  is_current_pr: boolean
  logged_at: string
}

export type Split = {
  id: string
  user_id: string | null
  name: string
  description: string | null
  days_per_week: number
  is_system: boolean
  is_shared: boolean
  /** Opaque token for public /share/split/[token] links. */
  share_token: string | null
  /** When this row was cloned from another split (system or shared). */
  source_split_id: string | null
  category: string | null
  created_at: string
  updated_at: string
}

export type SplitDay = {
  id: string
  split_id: string
  name: string
  day_order: number
  subtitle: string | null
  created_at: string
}

export type SplitDayExercise = {
  id: string
  split_day_id: string
  lift_type_id: string
  target_sets: number
  target_reps_min: number | null
  target_reps_max: number | null
  exercise_order: number
  created_at: string
}

export type SessionStatus = 'in_progress' | 'completed' | 'cancelled'

export type Session = {
  id: string
  user_id: string
  split_id: string | null
  split_day_id: string | null
  status: SessionStatus
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  total_volume: number | null
  total_sets_completed: number | null
  total_sets_skipped: number | null
  created_at: string
}

export type Friendship = {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted' | 'blocked' | 'rejected'
  created_at: string
}

export type Follower = {
  id: string
  follower_id: string
  followed_id: string
  created_at: string
}

export type DmThreadStatus = 'pending' | 'accepted'

export type DmThread = {
  id: string
  user_a_id: string
  user_b_id: string
  initiated_by: string
  status: DmThreadStatus
  created_at: string
  updated_at: string
}

export type DmMessage = {
  id: string
  thread_id: string
  sender_id: string
  content: string
  created_at: string
}

export type SplitDayExerciseJoined = SplitDayExercise & {
  lift_types: Pick<
    LiftType,
    'id' | 'slug' | 'name' | 'image_url' | 'muscle_group' | 'category'
  > | null
}

export type SplitDayWithExercises = SplitDay & {
  split_day_exercises: SplitDayExerciseJoined[]
}

export type SplitDetailRow = Split & {
  split_days: SplitDayWithExercises[]
}

export type SessionWithRelations = Session & {
  splits: Pick<Split, 'id' | 'name'> | null
  split_days: Pick<SplitDay, 'id' | 'name'> | null
}

export type PersonalRecordWithLift = PersonalRecord & {
  lift_types: Pick<LiftType, 'id' | 'name' | 'slug' | 'muscle_group' | 'image_url'> | null
}

/** Row shape from the public.leaderboard view. */
export type LeaderboardEntry = {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  current_streak: number | null
  best_lift_name: string | null
  best_lift_weight: number | null
  best_lift_reps: number | null
}

export type AchievementCategory =
  | 'streak'
  | 'pr'
  | 'volume'
  | 'consistency'
  | 'variety'
  | 'social'

export type Achievement = {
  id: string
  slug: string
  name: string
  description: string
  category: AchievementCategory | string
  icon: string
  sort_order: number
}

export type UserAchievement = {
  user_id: string
  achievement_id: string
  earned_at: string
  display_order: number | null
}

export type ChallengeStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'declined'
  | 'cancelled'

export type Challenge = {
  id: string
  creator_id: string
  opponent_id: string
  lift_type_id: string
  target_weight: number
  target_reps: number
  status: ChallengeStatus | string
  winner_id: string | null
  created_at: string
  completed_at: string | null
  responded_at: string | null
}

export type ChallengeWithRelations = Challenge & {
  lift_types: Pick<
    LiftType,
    'id' | 'name' | 'slug' | 'muscle_group' | 'image_url'
  > | null
  creator: Pick<
    PublicProfile,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null
  opponent: Pick<
    PublicProfile,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null
  winner: Pick<
    PublicProfile,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null
}

export type UserAchievementJoined = UserAchievement & {
  achievements: Achievement | null
}

export type AppNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  related_user_id: string | null
  is_read: boolean
  created_at: string
}

export type PushSubscriptionRow = {
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

export type GroupChatMemberRole = 'owner' | 'admin' | 'member'

export type GroupChat = {
  id: string
  name: string
  is_global: boolean
  created_by: string | null
  created_at: string
  avatar_url: string | null
}

export type GroupChatMember = {
  id: string
  group_chat_id: string
  user_id: string
  role: GroupChatMemberRole | string
  joined_at: string
}

export type GroupMessage = {
  id: string
  group_chat_id: string
  sender_id: string
  content: string
  created_at: string
}

export type GroupMessageWithSender = GroupMessage & {
  sender: Pick<
    PublicProfile,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null
}

