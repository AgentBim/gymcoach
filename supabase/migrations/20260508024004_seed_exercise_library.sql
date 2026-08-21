
insert into public.exercises (name, description, muscle_group, difficulty, default_sets, default_reps, default_duration_seconds, default_rest_seconds) values

-- CORE
('Hollow Body Hold', 'Lie on your back, press lower back to floor, extend arms overhead and legs low. Hold tight.', 'Core', 'Medium', 3, null, 30, 30),
('Arch Body Hold', 'Lie face down, lift arms and legs off the floor simultaneously. Hold and squeeze.', 'Core', 'Easy', 3, null, 20, 30),
('L-Sit Hold', 'On parallettes or floor, press down through hands, lift legs parallel to ground. Hold.', 'Core', 'Hard', 4, null, 10, 60),
('Tuck Planche Hold', 'On hands, lean forward and tuck knees to chest off the ground. Hold.', 'Core', 'Hard', 3, null, 10, 60),
('V-Up', 'From lying flat, simultaneously lift legs and torso to form a V shape. Lower with control.', 'Core', 'Medium', 3, 15, null, 45),
('Hollow Body Rocks', 'In hollow body position, rock forward and back maintaining the shape throughout.', 'Core', 'Medium', 3, 20, null, 30),
('Hanging Knee Raise', 'Hang from bar, pull knees to chest with control. Lower slowly.', 'Core', 'Easy', 3, 12, null, 30),
('Toes to Bar', 'Hang from bar, keep legs straight and raise toes to touch the bar. Lower with control.', 'Core', 'Hard', 3, 8, null, 45),
('Plank Hold', 'Forearms and toes on floor, body in a straight line. Brace everything.', 'Core', 'Easy', 3, null, 45, 30),
('Dragon Flag', 'Lie on bench, grip behind head, raise body as one rigid unit. Lower slowly.', 'Core', 'Hard', 3, 6, null, 60),

-- ARMS
('Pike Push-up', 'In inverted V position, bend elbows and lower crown toward floor. Press back up.', 'Arms', 'Easy', 3, 10, null, 45),
('Diamond Push-up', 'Hands close together forming a diamond, lower chest to hands. Press up.', 'Arms', 'Medium', 3, 12, null, 30),
('Tricep Dips', 'On parallel bars or chair, lower body by bending elbows. Press back to straight.', 'Arms', 'Easy', 3, 12, null, 30),
('Ring Push-up', 'Push-up with hands on gymnastic rings, keep rings stable throughout movement.', 'Arms', 'Medium', 3, 10, null, 45),
('Chin-up', 'Supinated grip, pull chin above bar from dead hang. Lower with control.', 'Arms', 'Medium', 4, 6, null, 60),
('Wrist Roller', 'Hold roller at shoulder height, wind and unwind weight using only wrists.', 'Arms', 'Easy', 3, null, 30, 30),
('Pseudo Planche Push-up', 'Hands near hips, lean forward and perform push-up keeping body rigid.', 'Arms', 'Hard', 3, 8, null, 60),
('Rope Climb (arms only)', 'Climb rope using only arm strength, no leg wrapping allowed.', 'Arms', 'Hard', 3, null, 30, 90),

-- BACK
('Superman Hold', 'Lie prone, extend arms and legs and lift all four limbs off floor. Hold.', 'Back', 'Easy', 3, null, 20, 30),
('Pull-up', 'Pronated grip, pull chin above bar from dead hang. Controlled lower.', 'Back', 'Medium', 4, 6, null, 60),
('Inverted Row', 'Hang below bar with straight body, pull chest to bar. Lower with control.', 'Back', 'Easy', 3, 10, null, 45),
('Back Extension', 'On GHD or prone on floor, hinge at hips to lower and raise torso.', 'Back', 'Easy', 3, 15, null, 30),
('Scapular Pull-up', 'From dead hang, retract scapulae to raise body slightly. No elbow bend.', 'Back', 'Medium', 3, 10, null, 30),
('Ring Row', 'Heels on floor, body straight, pull chest to rings. Adjust angle for difficulty.', 'Back', 'Medium', 3, 10, null, 45),
('Skin the Cat', 'Hang from bar or rings, pike legs through to German hang. Return with control.', 'Back', 'Hard', 3, 5, null, 60),
('Arch Pulls', 'Hang from bar in arched position, pull with scapula retraction and depression.', 'Back', 'Medium', 3, 8, null, 45),

-- LEGS
('Jump Squat', 'Squat to parallel, explode upward, land softly through full foot. Reset.', 'Legs', 'Medium', 4, 12, null, 45),
('Split Squat', 'Rear foot elevated, lower back knee toward floor. Drive through front heel.', 'Legs', 'Medium', 3, 10, null, 45),
('Single Leg Calf Raise', 'Stand on one foot on edge of step, raise and lower heel through full range.', 'Legs', 'Easy', 3, 15, null, 30),
('Broad Jump', 'From standing, swing arms and jump as far forward as possible. Land balanced.', 'Legs', 'Medium', 4, 8, null, 45),
('Wall Sit', 'Back flat on wall, thighs parallel to floor. Hold position.', 'Legs', 'Easy', 3, null, 45, 30),
('Tuck Jump', 'Jump and pull knees to chest at peak height. Land softly.', 'Legs', 'Medium', 3, 10, null, 45),
('Pistol Squat', 'Single leg squat to full depth with opposite leg extended forward. Stand back up.', 'Legs', 'Hard', 3, 5, null, 60),
('Box Jump', 'Jump onto box or raised surface, land in squat position. Step or jump down.', 'Legs', 'Medium', 4, 8, null, 45),
('Nordic Curl', 'Kneel with feet anchored, lower body toward floor with control. Use arms to return.', 'Legs', 'Hard', 3, 6, null, 60),
('Relevé Hold', 'Rise to toes on both feet, maintain balance and alignment. Lower slowly.', 'Legs', 'Easy', 3, null, 30, 20),

-- SHOULDERS
('Handstand Wall Hold', 'Kick up to handstand against wall, maintain straight body and active shrug.', 'Shoulders', 'Hard', 3, null, 20, 60),
('Pike Shoulder Tap', 'In pike push-up position, tap opposite shoulder while maintaining balance.', 'Shoulders', 'Medium', 3, 10, null, 45),
('Prone Y Raise', 'Lie face down, raise arms to Y position squeezing shoulder blades. Lower slowly.', 'Shoulders', 'Easy', 3, 15, null, 30),
('Band Pull-Apart', 'Hold band at chest width, pull apart to full extension behind body. Return slowly.', 'Shoulders', 'Easy', 3, 15, null, 20),
('Wall Handstand Shoulder Touch', 'In wall handstand, shift weight and tap one shoulder. Alternate sides.', 'Shoulders', 'Hard', 3, 8, null, 60),
('Lateral Raise', 'With light weights or bands, raise arms to sides to shoulder height. Lower slowly.', 'Shoulders', 'Easy', 3, 15, null, 30),
('Overhead Squat Hold', 'Arms locked overhead, squat to depth maintaining vertical torso and active shoulders.', 'Shoulders', 'Medium', 3, null, 30, 45),
('Bear Crawl', 'Hands and toes on floor, knees 1 inch off ground. Crawl forward maintaining position.', 'Shoulders', 'Medium', 3, null, 30, 30);
