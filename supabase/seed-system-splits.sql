-- ============================================================
-- IRONSTACK — Seed system lift_types + built-in splits
-- Run once in Supabase SQL Editor (Dashboard → SQL).
-- Safe to re-run: uses fixed UUIDs + ON CONFLICT DO NOTHING.
-- Does NOT change RLS policies.
-- ============================================================

-- ----------------------------------------------------------
-- 1. Core lift_types used by system splits
-- ----------------------------------------------------------
insert into public.lift_types (id, slug, name, category, sort_order, is_system, muscle_group, image_url)
values
  ('11111111-1111-1111-1111-111111110001', 'barbell_bench_press', 'Barbell Bench Press', 'compound', 1, true, 'Chest',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg'),
  ('11111111-1111-1111-1111-111111110002', 'incline_dumbbell_press', 'Incline Dumbbell Press', 'compound', 2, true, 'Chest',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg'),
  ('11111111-1111-1111-1111-111111110003', 'cable_fly', 'Cable Fly', 'accessory', 3, true, 'Chest',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Flat_Bench_Cable_Flyes/0.jpg'),
  ('11111111-1111-1111-1111-111111110004', 'overhead_press', 'Standing Overhead Press', 'compound', 4, true, 'Shoulders',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Military_Press/0.jpg'),
  ('11111111-1111-1111-1111-111111110005', 'dumbbell_lateral_raise', 'Dumbbell Lateral Raise', 'accessory', 5, true, 'Shoulders',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg'),
  ('11111111-1111-1111-1111-111111110006', 'cable_lateral_raise', 'Cable Lateral Raise', 'accessory', 6, true, 'Shoulders',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg'),
  ('11111111-1111-1111-1111-111111110007', 'seated_dumbbell_shoulder_press', 'Seated Dumbbell Shoulder Press', 'compound', 7, true, 'Shoulders',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg'),
  ('11111111-1111-1111-1111-111111110008', 'triceps_pushdown', 'Triceps Pushdown', 'accessory', 8, true, 'Triceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg'),
  ('11111111-1111-1111-1111-111111110009', 'overhead_rope_extension', 'Overhead Rope Triceps Extension', 'accessory', 9, true, 'Triceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/0.jpg'),
  ('11111111-1111-1111-1111-11111111000a', 'rope_pushdown', 'Rope Pushdown', 'accessory', 10, true, 'Triceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg'),
  ('11111111-1111-1111-1111-11111111000b', 'skull_crusher', 'Skull Crusher', 'accessory', 11, true, 'Triceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/EZ-Bar_Skullcrusher/0.jpg'),
  ('11111111-1111-1111-1111-11111111000c', 'deadlift', 'Deadlift', 'compound', 12, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg'),
  ('11111111-1111-1111-1111-11111111000d', 'pull_up', 'Pull-Up', 'bodyweight', 13, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg'),
  ('11111111-1111-1111-1111-11111111000e', 'barbell_row', 'Barbell Row', 'compound', 14, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg'),
  ('11111111-1111-1111-1111-11111111000f', 'lat_pulldown', 'Lat Pulldown', 'compound', 15, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg'),
  ('11111111-1111-1111-1111-111111110010', 'chest_supported_row', 'Chest-Supported Row', 'compound', 16, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_T-Bar_Row/0.jpg'),
  ('11111111-1111-1111-1111-111111110011', 'seated_cable_row', 'Seated Cable Row', 'compound', 17, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg'),
  ('11111111-1111-1111-1111-111111110012', 'face_pull', 'Face Pull', 'accessory', 18, true, 'Shoulders',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg'),
  ('11111111-1111-1111-1111-111111110013', 'straight_arm_pulldown', 'Straight-Arm Pulldown', 'accessory', 19, true, 'Back',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/0.jpg'),
  ('11111111-1111-1111-1111-111111110014', 'barbell_curl', 'Barbell Curl', 'accessory', 20, true, 'Biceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg'),
  ('11111111-1111-1111-1111-111111110015', 'incline_dumbbell_curl', 'Incline Dumbbell Curl', 'accessory', 21, true, 'Biceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/0.jpg'),
  ('11111111-1111-1111-1111-111111110016', 'hammer_curl', 'Hammer Curl', 'accessory', 22, true, 'Biceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg'),
  ('11111111-1111-1111-1111-111111110017', 'cable_curl', 'Cable Curl', 'accessory', 23, true, 'Biceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Biceps_Cable_Curl/0.jpg'),
  ('11111111-1111-1111-1111-111111110018', 'dumbbell_curl', 'Dumbbell Curl', 'accessory', 24, true, 'Biceps',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Curl/0.jpg'),
  ('11111111-1111-1111-1111-111111110019', 'back_squat', 'Back Squat', 'compound', 25, true, 'Quads',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg'),
  ('11111111-1111-1111-1111-11111111001a', 'front_squat', 'Front Squat', 'compound', 26, true, 'Quads',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Barbell_Squat/0.jpg'),
  ('11111111-1111-1111-1111-11111111001b', 'romanian_deadlift', 'Romanian Deadlift', 'compound', 27, true, 'Hamstrings',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg'),
  ('11111111-1111-1111-1111-11111111001c', 'leg_press', 'Leg Press', 'compound', 28, true, 'Quads',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg'),
  ('11111111-1111-1111-1111-11111111001d', 'leg_extension', 'Leg Extension', 'accessory', 29, true, 'Quads',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg'),
  ('11111111-1111-1111-1111-11111111001e', 'seated_leg_curl', 'Seated Leg Curl', 'accessory', 30, true, 'Hamstrings',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/0.jpg'),
  ('11111111-1111-1111-1111-11111111001f', 'lying_leg_curl', 'Lying Leg Curl', 'accessory', 31, true, 'Hamstrings',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg'),
  ('11111111-1111-1111-1111-111111110020', 'bulgarian_split_squat', 'Bulgarian Split Squat', 'compound', 32, true, 'Glutes',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Split_Squats/0.jpg'),
  ('11111111-1111-1111-1111-111111110021', 'barbell_hip_thrust', 'Barbell Hip Thrust', 'compound', 33, true, 'Glutes',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg'),
  ('11111111-1111-1111-1111-111111110022', 'walking_lunge', 'Walking Lunge', 'compound', 34, true, 'Glutes',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Walking_Lunge/0.jpg'),
  ('11111111-1111-1111-1111-111111110023', 'standing_calf_raise', 'Standing Calf Raise', 'accessory', 35, true, 'Calves',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg'),
  ('11111111-1111-1111-1111-111111110024', 'seated_calf_raise', 'Seated Calf Raise', 'accessory', 36, true, 'Calves',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/0.jpg'),
  ('11111111-1111-1111-1111-111111110025', 'hanging_leg_raise', 'Hanging Leg Raise', 'accessory', 37, true, 'Core',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg'),
  ('11111111-1111-1111-1111-111111110026', 'plank', 'Plank', 'accessory', 38, true, 'Core',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg'),
  ('11111111-1111-1111-1111-111111110027', 'cable_crunch', 'Cable Crunch', 'accessory', 39, true, 'Core',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg'),
  ('11111111-1111-1111-1111-111111110028', 'arnold_press', 'Arnold Press', 'compound', 40, true, 'Shoulders',
   'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Arnold_Dumbbell_Press/0.jpg')
on conflict (slug) do nothing;

-- ----------------------------------------------------------
-- 2. System splits (user_id null)
-- ----------------------------------------------------------
insert into public.splits (id, user_id, name, description, days_per_week, is_system, category)
values
  ('22222222-2222-2222-2222-222222220001', null, 'Push / Pull / Legs',
   '6 days/week · Ideal for intermediate lifters', 6, true, 'Popular'),
  ('22222222-2222-2222-2222-222222220002', null, 'Upper / Lower',
   '4 days/week · Great balance of recovery & volume', 4, true, 'Balanced'),
  ('22222222-2222-2222-2222-222222220003', null, 'Full Body',
   '3 days/week · Best for beginners', 3, true, 'Beginner'),
  ('22222222-2222-2222-2222-222222220004', null, 'Bro Split',
   '5 days/week · Classic body-part focus', 5, true, 'Classic')
on conflict (id) do nothing;

-- ----------------------------------------------------------
-- 3. Split days
-- ----------------------------------------------------------
insert into public.split_days (id, split_id, name, day_order, subtitle) values
  -- PPL
  ('33333333-3333-3333-3333-333333330001', '22222222-2222-2222-2222-222222220001', 'Push', 1, 'Chest · Shoulders · Triceps'),
  ('33333333-3333-3333-3333-333333330002', '22222222-2222-2222-2222-222222220001', 'Pull', 2, 'Back · Rear Delts · Biceps'),
  ('33333333-3333-3333-3333-333333330003', '22222222-2222-2222-2222-222222220001', 'Legs', 3, 'Quads · Hamstrings · Calves'),
  -- Upper / Lower
  ('33333333-3333-3333-3333-333333330011', '22222222-2222-2222-2222-222222220002', 'Upper A — Strength', 1, 'Heavy compounds, lower reps'),
  ('33333333-3333-3333-3333-333333330012', '22222222-2222-2222-2222-222222220002', 'Lower A — Strength', 2, 'Squat pattern priority'),
  ('33333333-3333-3333-3333-333333330013', '22222222-2222-2222-2222-222222220002', 'Upper B — Hypertrophy', 3, 'Machines and cables, higher reps'),
  ('33333333-3333-3333-3333-333333330014', '22222222-2222-2222-2222-222222220002', 'Lower B — Hypertrophy', 4, 'Hinge and glute priority'),
  -- Full Body
  ('33333333-3333-3333-3333-333333330021', '22222222-2222-2222-2222-222222220003', 'Day A', 1, 'Squat + horizontal press'),
  ('33333333-3333-3333-3333-333333330022', '22222222-2222-2222-2222-222222220003', 'Day B', 2, 'Hinge + vertical press'),
  ('33333333-3333-3333-3333-333333330023', '22222222-2222-2222-2222-222222220003', 'Day C', 3, 'Volume and accessories'),
  -- Bro
  ('33333333-3333-3333-3333-333333330031', '22222222-2222-2222-2222-222222220004', 'Chest', 1, 'Press and fly volume'),
  ('33333333-3333-3333-3333-333333330032', '22222222-2222-2222-2222-222222220004', 'Back', 2, 'Vertical and horizontal pulling'),
  ('33333333-3333-3333-3333-333333330033', '22222222-2222-2222-2222-222222220004', 'Shoulders', 3, 'All three delt heads'),
  ('33333333-3333-3333-3333-333333330034', '22222222-2222-2222-2222-222222220004', 'Arms', 4, 'Biceps and triceps'),
  ('33333333-3333-3333-3333-333333330035', '22222222-2222-2222-2222-222222220004', 'Legs', 5, 'Quads, hamstrings and calves')
on conflict (id) do nothing;

-- ----------------------------------------------------------
-- 4. Split day exercises (skip days that already have rows)
-- ----------------------------------------------------------
insert into public.split_day_exercises (split_day_id, lift_type_id, target_sets, exercise_order)
select v.split_day_id, v.lift_type_id, v.target_sets, v.exercise_order
from (values
  -- PPL Push
  ('33333333-3333-3333-3333-333333330001'::uuid, '11111111-1111-1111-1111-111111110001'::uuid, 4, 1),
  ('33333333-3333-3333-3333-333333330001', '11111111-1111-1111-1111-111111110007', 3, 2),
  ('33333333-3333-3333-3333-333333330001', '11111111-1111-1111-1111-111111110002', 3, 3),
  ('33333333-3333-3333-3333-333333330001', '11111111-1111-1111-1111-111111110006', 3, 4),
  ('33333333-3333-3333-3333-333333330001', '11111111-1111-1111-1111-111111110009', 3, 5),
  ('33333333-3333-3333-3333-333333330001', '11111111-1111-1111-1111-111111110008', 3, 6),
  -- PPL Pull
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-11111111000c', 4, 1),
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-11111111000d', 4, 2),
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-111111110010', 3, 3),
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-111111110012', 3, 4),
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-111111110014', 3, 5),
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-111111110015', 3, 6),
  -- PPL Legs
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-111111110019', 4, 1),
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-11111111001b', 3, 2),
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-11111111001c', 3, 3),
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-11111111001e', 3, 4),
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-111111110023', 4, 5),
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-111111110025', 3, 6),
  -- UL Upper A
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-111111110001', 4, 1),
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-11111111000e', 4, 2),
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-111111110004', 3, 3),
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-11111111000f', 3, 4),
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-111111110005', 3, 5),
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-11111111000b', 3, 6),
  ('33333333-3333-3333-3333-333333330011', '11111111-1111-1111-1111-111111110016', 3, 7),
  -- UL Lower A
  ('33333333-3333-3333-3333-333333330012', '11111111-1111-1111-1111-111111110019', 4, 1),
  ('33333333-3333-3333-3333-333333330012', '11111111-1111-1111-1111-11111111001b', 3, 2),
  ('33333333-3333-3333-3333-333333330012', '11111111-1111-1111-1111-111111110020', 3, 3),
  ('33333333-3333-3333-3333-333333330012', '11111111-1111-1111-1111-11111111001d', 3, 4),
  ('33333333-3333-3333-3333-333333330012', '11111111-1111-1111-1111-111111110024', 4, 5),
  ('33333333-3333-3333-3333-333333330012', '11111111-1111-1111-1111-111111110026', 3, 6),
  -- UL Upper B
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-111111110002', 4, 1),
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-111111110010', 4, 2),
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-111111110028', 3, 3),
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-111111110003', 3, 4),
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-111111110013', 3, 5),
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-111111110017', 3, 6),
  ('33333333-3333-3333-3333-333333330013', '11111111-1111-1111-1111-11111111000a', 3, 7),
  -- UL Lower B
  ('33333333-3333-3333-3333-333333330014', '11111111-1111-1111-1111-11111111001a', 3, 1),
  ('33333333-3333-3333-3333-333333330014', '11111111-1111-1111-1111-111111110021', 4, 2),
  ('33333333-3333-3333-3333-333333330014', '11111111-1111-1111-1111-111111110022', 3, 3),
  ('33333333-3333-3333-3333-333333330014', '11111111-1111-1111-1111-11111111001f', 3, 4),
  ('33333333-3333-3333-3333-333333330014', '11111111-1111-1111-1111-111111110023', 4, 5),
  ('33333333-3333-3333-3333-333333330014', '11111111-1111-1111-1111-111111110027', 3, 6),
  -- FB Day A
  ('33333333-3333-3333-3333-333333330021', '11111111-1111-1111-1111-111111110019', 3, 1),
  ('33333333-3333-3333-3333-333333330021', '11111111-1111-1111-1111-111111110001', 3, 2),
  ('33333333-3333-3333-3333-333333330021', '11111111-1111-1111-1111-11111111000e', 3, 3),
  ('33333333-3333-3333-3333-333333330021', '11111111-1111-1111-1111-111111110004', 2, 4),
  ('33333333-3333-3333-3333-333333330021', '11111111-1111-1111-1111-111111110026', 3, 5),
  -- FB Day B
  ('33333333-3333-3333-3333-333333330022', '11111111-1111-1111-1111-11111111000c', 3, 1),
  ('33333333-3333-3333-3333-333333330022', '11111111-1111-1111-1111-111111110004', 3, 2),
  ('33333333-3333-3333-3333-333333330022', '11111111-1111-1111-1111-11111111000f', 3, 3),
  ('33333333-3333-3333-3333-333333330022', '11111111-1111-1111-1111-11111111001c', 3, 4),
  ('33333333-3333-3333-3333-333333330022', '11111111-1111-1111-1111-111111110025', 3, 5),
  -- FB Day C
  ('33333333-3333-3333-3333-333333330023', '11111111-1111-1111-1111-11111111001a', 3, 1),
  ('33333333-3333-3333-3333-333333330023', '11111111-1111-1111-1111-111111110002', 3, 2),
  ('33333333-3333-3333-3333-333333330023', '11111111-1111-1111-1111-111111110011', 3, 3),
  ('33333333-3333-3333-3333-333333330023', '11111111-1111-1111-1111-11111111001b', 3, 4),
  ('33333333-3333-3333-3333-333333330023', '11111111-1111-1111-1111-111111110018', 2, 5),
  ('33333333-3333-3333-3333-333333330023', '11111111-1111-1111-1111-111111110023', 3, 6),
  -- Bro Chest
  ('33333333-3333-3333-3333-333333330031', '11111111-1111-1111-1111-111111110001', 4, 1),
  ('33333333-3333-3333-3333-333333330031', '11111111-1111-1111-1111-111111110002', 4, 2),
  ('33333333-3333-3333-3333-333333330031', '11111111-1111-1111-1111-111111110003', 3, 3),
  -- Bro Back
  ('33333333-3333-3333-3333-333333330032', '11111111-1111-1111-1111-11111111000c', 4, 1),
  ('33333333-3333-3333-3333-333333330032', '11111111-1111-1111-1111-11111111000d', 4, 2),
  ('33333333-3333-3333-3333-333333330032', '11111111-1111-1111-1111-11111111000e', 3, 3),
  ('33333333-3333-3333-3333-333333330032', '11111111-1111-1111-1111-111111110011', 3, 4),
  ('33333333-3333-3333-3333-333333330032', '11111111-1111-1111-1111-111111110013', 3, 5),
  -- Bro Shoulders
  ('33333333-3333-3333-3333-333333330033', '11111111-1111-1111-1111-111111110004', 4, 1),
  ('33333333-3333-3333-3333-333333330033', '11111111-1111-1111-1111-111111110005', 4, 2),
  ('33333333-3333-3333-3333-333333330033', '11111111-1111-1111-1111-111111110012', 3, 3),
  -- Bro Arms
  ('33333333-3333-3333-3333-333333330034', '11111111-1111-1111-1111-111111110014', 4, 1),
  ('33333333-3333-3333-3333-333333330034', '11111111-1111-1111-1111-11111111000b', 4, 2),
  ('33333333-3333-3333-3333-333333330034', '11111111-1111-1111-1111-111111110015', 3, 3),
  ('33333333-3333-3333-3333-333333330034', '11111111-1111-1111-1111-111111110009', 3, 4),
  ('33333333-3333-3333-3333-333333330034', '11111111-1111-1111-1111-11111111000a', 3, 5),
  -- Bro Legs
  ('33333333-3333-3333-3333-333333330035', '11111111-1111-1111-1111-111111110019', 4, 1),
  ('33333333-3333-3333-3333-333333330035', '11111111-1111-1111-1111-11111111001b', 4, 2),
  ('33333333-3333-3333-3333-333333330035', '11111111-1111-1111-1111-11111111001c', 3, 3),
  ('33333333-3333-3333-3333-333333330035', '11111111-1111-1111-1111-11111111001d', 3, 4),
  ('33333333-3333-3333-3333-333333330035', '11111111-1111-1111-1111-11111111001f', 3, 5),
  ('33333333-3333-3333-3333-333333330035', '11111111-1111-1111-1111-111111110023', 4, 6)
) as v(split_day_id, lift_type_id, target_sets, exercise_order)
where not exists (
  select 1 from public.split_day_exercises e where e.split_day_id = v.split_day_id
);

