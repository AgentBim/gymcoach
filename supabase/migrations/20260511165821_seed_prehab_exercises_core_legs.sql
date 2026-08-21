
insert into public.exercises (name, description, muscle_group, difficulty, default_sets, default_reps, default_duration_seconds, default_rest_seconds, category, prehab_focus) values

-- CORE (15 prehab)
('Dead Bug (prehab)', 'Lie on back, arms and knees at 90°, lower opposite arm and leg with 5-second count. Maintain lower back flat throughout. Deep core stability.', 'Core', 'Easy', 3, 8, null, 20, 'prehab', 'stability'),
('Abdominal Bracing', 'Stand or lie, draw in navel then brace abs as if about to be punched. Hold 5 seconds. Teaches transverse abdominis activation.', 'Core', 'Easy', 3, null, 20, 10, 'prehab', 'activation'),
('Diaphragmatic Breathing', 'Lie on back, one hand on chest one on belly. Breathe so only belly hand rises. Diaphragm and deep core reset.', 'Core', 'Easy', 3, null, 60, 10, 'prehab', 'activation'),
('McGill Big 3 — Curl-Up', 'Partial curl-up with hands under lumbar. Spine neutral throughout. One of McGill''s essential spine stability exercises.', 'Core', 'Easy', 3, 10, null, 20, 'prehab', 'stability'),
('McGill Big 3 — Side Plank', 'Side plank held for progressively longer durations. Quadratus lumborum and lateral spine stabilizer activation.', 'Core', 'Easy', 3, null, 20, 20, 'prehab', 'stability'),
('McGill Big 3 — Bird Dog', 'From all fours, extend opposite arm/leg, hold 10 seconds, sweep under body. The complete McGill bird dog protocol.', 'Core', 'Easy', 3, 8, null, 20, 'prehab', 'stability'),
('Hollow Body Progression', 'Progress from knees tucked to legs extended as strength allows. Build hollow body position incrementally without compensation.', 'Core', 'Easy', 3, null, 20, 30, 'prehab', 'stability'),
('Plank with Breathing', 'Hold plank and take 5 full breaths without losing position. Teaches maintaining brace under respiratory load.', 'Core', 'Easy', 3, null, 30, 30, 'prehab', 'stability'),
('Hip Flexor Activation', 'Lie on back, press one hand against raised knee for 5 seconds, other leg straight. Psoas and hip flexor activation.', 'Core', 'Easy', 3, null, 20, 15, 'prehab', 'activation'),
('Reverse Crunch (slow)', 'Curl hips to chest with 3-second lift and 3-second lower. Lower back stays in contact with floor throughout.', 'Core', 'Easy', 3, 10, null, 20, 'prehab', 'activation'),
('Supine Leg Lowering', 'Both legs vertical, lower one slowly to just above floor. Back flat. Tests and builds lumbo-pelvic control.', 'Core', 'Easy', 3, 8, null, 20, 'prehab', 'stability'),
('Suitcase Carry', 'Hold weight in one hand at side, walk maintaining upright posture. Anti-lateral flexion core stability under load.', 'Core', 'Easy', 3, null, 30, 30, 'prehab', 'stability'),
('Stir the Pot (light)', 'Forearms on stability ball, make small circles. Begin with small range, build over time. Rotary stability under spinal load.', 'Core', 'Medium', 3, null, 20, 30, 'prehab', 'stability'),
('Copenhagen Short Lever', 'Side plank with lower knee on bench (not foot), easier lever. Adductor and lateral core loading for groin protection.', 'Core', 'Easy', 3, null, 20, 30, 'prehab', 'strength'),
('Segmental Roll-Down', 'Stand tall, tuck chin, roll down one vertebra at a time reaching hands toward floor. Spinal mobility and segmental control.', 'Core', 'Easy', 3, 8, null, 15, 'prehab', 'mobility'),

-- LEGS (15 prehab)
('Ankle CARs', 'Controlled articular rotations of the ankle in full available range under tension. Essential before any jumping or tumbling.', 'Legs', 'Easy', 2, 10, null, 10, 'prehab', 'activation'),
('Ankle Alphabet', 'Draw the alphabet with your foot making shapes as large as possible. Full ankle range of motion activation.', 'Legs', 'Easy', 2, null, 45, 10, 'prehab', 'mobility'),
('Calf Raise Eccentric', 'Rise on both feet, lower on one foot over 5 seconds. Soleus and Achilles tendon loading. Injury prevention for jumpers.', 'Legs', 'Easy', 3, 10, null, 30, 'prehab', 'strength'),
('Terminal Knee Extension (prehab)', 'Band behind knee, slight bend, extend against band. VMO activation drill for knee stability and patellar tracking.', 'Legs', 'Easy', 3, 15, null, 20, 'prehab', 'activation'),
('Nordic Curl Negative (assisted)', 'Use a band for assistance, lower body toward floor over 5 seconds. Hamstring tendon conditioning essential for gymnastics.', 'Legs', 'Medium', 3, 6, null, 60, 'prehab', 'strength'),
('Hip 90/90 Stretch', 'Sit with both hips at 90°, rotate between positions. Hip internal and external rotation mobility for healthy knee alignment.', 'Legs', 'Easy', 3, null, 30, 10, 'prehab', 'mobility'),
('Couch Stretch', 'Rear foot elevated on wall in lunge, drive hips forward. Hip flexor and quad stretch. Corrects anterior pelvic tilt.', 'Legs', 'Easy', 3, null, 45, 10, 'prehab', 'mobility'),
('Pigeon Stretch', 'Front shin across body, extend rear leg, hold. Deep hip external rotator and glute stretch. Protects the hip joint.', 'Legs', 'Easy', 3, null, 45, 10, 'prehab', 'mobility'),
('Single-Leg Balance Eyes Closed', 'Stand on one leg, close eyes, hold stable. Proprioception training for ankle and knee joint position sense.', 'Legs', 'Easy', 3, null, 30, 15, 'prehab', 'stability'),
('Lateral Band Walk (prehab)', 'Mini-band at ankles, quarter-squat, step side to side. Gluteus medius activation for knee valgus prevention.', 'Legs', 'Easy', 3, null, 30, 20, 'prehab', 'activation'),
('Glute Bridge ISOMETRIC Hold', 'Bridge up and hold with maximal glute squeeze. Gluteal activation and hip extension pattern reinforcement.', 'Legs', 'Easy', 3, null, 30, 20, 'prehab', 'activation'),
('Clamshell', 'Side-lying, knees bent, rotate top knee up like a clamshell. Glute medius and external hip rotator activation.', 'Legs', 'Easy', 3, 15, null, 20, 'prehab', 'activation'),
('Ankle Dorsiflexion Mobilisation', 'Half-kneeling at wall, push knee over toes as far as possible. Ankle dorsiflexion mobility crucial for landing mechanics.', 'Legs', 'Easy', 3, 15, null, 15, 'prehab', 'mobility'),
('Step-Down (slow eccentric)', 'Stand on step, lower opposite foot to tap floor over 5 seconds. Single-leg eccentric quad control for knee health.', 'Legs', 'Easy', 3, 8, null, 30, 'prehab', 'strength'),
('Hip FABER Stretch', 'Lie on back, cross ankle over opposite knee, gently press knee down or pull shin toward chest. Piriformis and hip external rotator.', 'Legs', 'Easy', 3, null, 45, 10, 'prehab', 'mobility');
