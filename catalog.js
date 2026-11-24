/* Side Gains catalogue: exercise poses, form cues, habits and tips. No logic here. */
/* poses: s = shoulder, h = hip, m = hands, f = feet, in a 200-wide side view; solved with 2-bone IK */
const P = (s, h, m, f, x = {}) => ({ s, h, m, f, ...x });
const STAND = P([100, 22], [100, 56], [[103, 58], [99, 58]], [[102, 110], [98, 110]]);
const PLANK = P([121, 78], [89, 90], [[121, 110], [117, 110]], [[37, 109], [39, 109]]);
const kf = (pose, hold, t) => ({ ...pose, hold, t });
export const ANIM = {
  pushup: { vb: "0 48 200 72", k: 1, e: 1, props: ["mat"], frames: [kf(PLANK, 350, 900), kf(P([125, 99], [92, 103], [[121, 110], [117, 110]], [[37, 109], [39, 109]]), 120, 650)] },
  pike: { vb: "0 30 200 90", k: 1, e: 1, props: ["mat"], frames: [kf(P([114, 84], [92, 62], [[130, 110], [127, 110]], [[60, 110], [64, 110]]), 350, 900), kf(P([122, 98], [98, 72], [[130, 110], [127, 110]], [[60, 110], [64, 110]]), 120, 650)] },
  squat: { vb: "0 -6 200 124", k: -1, e: -1, props: [], frames: [kf(STAND, 300, 900), kf(P([108, 58], [82, 86], [[140, 60], [137, 62]], [[102, 110], [98, 110]]), 150, 700)] },
  lunge: { vb: "0 -4 200 122", k: -1, e: 1, props: [], frames: [kf(P([100, 24], [100, 57], [[106, 56], [96, 56]], [[116, 110], [84, 110]]), 300, 900), kf(P([100, 50], [100, 84], [[106, 82], [96, 82]], [[130, 110], [72, 110]]), 150, 700)] },
  burpee: { k: -1, e: 1, props: [], frames: [
    kf(STAND, 200, 380),
    kf(P([110, 68], [86, 88], [[122, 110], [119, 110]], [[102, 110], [98, 110]]), 40, 300),
    kf(PLANK, 60, 380),
    kf(P([124, 106], [92, 108], [[121, 110], [117, 110]], [[37, 109], [39, 109]]), 80, 380),
    kf(PLANK, 40, 300),
    kf(P([110, 68], [86, 88], [[122, 110], [119, 110]], [[102, 110], [98, 110]]), 40, 330),
    kf(P([100, 8], [100, 42], [[105, -28], [101, -27]], [[102, 96], [98, 96]]), 100, 360),
  ] },
  plank: { vb: "0 56 200 64", k: 1, e: 1, props: ["mat"], frames: [kf(P([120, 90], [86, 98], [[138, 110], [135, 110]], [[34, 109], [38, 109]]), 600, 1400), kf(P([120, 89], [86, 96.5], [[138, 110], [135, 110]], [[34, 109], [38, 109]]), 600, 1400)] },
  handstand: { vb: "0 -36 200 154", k: 1, e: 1, props: ["wallR"], frames: [kf(P([118, 76], [120, 42], [[118, 110], [113, 110]], [[124, -10], [121, -12]]), 600, 1400), kf(P([118, 75], [120.5, 41], [[118, 110], [113, 110]], [[123, -11], [120, -13]]), 600, 1400)] },
  situp: { vb: "0 46 200 74", k: -1, e: -1, props: ["mat"], frames: [kf(P([56, 108], [90, 109], [[70, 100], [66, 100]], [[128, 110], [124, 110]]), 250, 800), kf(P([106, 76], [90, 109], [[124, 86], [120, 86]], [[128, 110], [124, 110]]), 150, 750)] },
  bridge: { vb: "0 56 200 64", k: -1, e: -1, props: ["mat"], frames: [kf(P([58, 109], [92, 109], [[94, 111], [90, 111]], [[124, 110], [120, 110]]), 250, 800), kf(P([60, 107], [92, 88], [[94, 111], [90, 111]], [[124, 110], [120, 110]]), 500, 700)] },
  dip: { vb: "0 20 200 98", k: -1, e: 1, props: ["chair"], frames: [kf(P([106, 46], [105, 80], [[99, 79], [96, 79]], [[156, 110], [152, 110]]), 300, 850), kf(P([106, 64], [106, 98], [[99, 79], [96, 79]], [[156, 110], [152, 110]]), 120, 650)] },
  wallsit: { vb: "0 22 200 96", k: -1, e: -1, props: ["wallL"], frames: [kf(P([66, 50], [66, 86], [[86, 84], [82, 84]], [[100, 110], [96, 110]]), 600, 1400), kf(P([66, 51], [66, 87], [[86, 85], [82, 85]], [[100, 110], [96, 110]]), 600, 1400)] },
  climber: { vb: "0 48 200 72", k: -1, e: 1, props: ["mat"], frames: [kf(P([121, 78], [89, 90], [[121, 110], [117, 110]], [[37, 109], [100, 104]]), 40, 330), kf(P([121, 78], [89, 90], [[121, 110], [117, 110]], [[100, 104], [37, 109]]), 40, 330)] },
  calf: { vb: "0 -8 200 126", k: -1, e: 1, props: [], frames: [kf(P([100, 22], [100, 56], [[103, 58], [99, 58]], [[100, 110], [97, 110]], { toe: [[110, 110], [107, 110]] }), 250, 600), kf(P([100, 13], [100, 47], [[103, 49], [99, 49]], [[103, 102], [100, 102]], { toe: [[110, 110], [107, 110]] }), 350, 600)] },
  superman: { vb: "0 66 200 54", k: 1, e: -1, props: ["mat"], frames: [kf(P([128, 108], [94, 109], [[166, 109], [162, 109]], [[40, 110], [44, 110]]), 250, 700), kf(P([128, 103], [94, 108], [[164, 94], [160, 95]], [[40, 100], [44, 101]]), 600, 700)] },
  pistol: { vb: "0 -6 200 124", k: -1, e: -1, props: [], frames: [kf(P([100, 22], [100, 56], [[103, 58], [99, 58]], [[100, 110], [122, 100]]), 300, 1000), kf(P([112, 64], [88, 92], [[146, 66], [142, 68]], [[100, 110], [148, 96]]), 150, 800)] },
  posture: { vb: "0 -6 200 124", k: -1, e: 1, props: [], frames: [kf(P([110, 28], [100, 58], [[104, 62], [100, 62]], [[100, 110], [97, 110]], { hf: 1 }), 900, 900), kf(P([100, 22], [100, 56], [[101, 59], [98, 59]], [[100, 110], [97, 110]]), 1400, 900)] },
};
ANIM.diamond = { ...ANIM.pushup, frames: ANIM.pushup.frames.map(f => ({ ...f, m: [[124, 110], [123, 110]] })) };

export const FORM = {
  pushup: { name: "Push-up", hi: "arms", muscles: ["Chest", "Triceps", "Core"], cues: ["Hands slightly wider than your shoulders, fingers spread.", "Squeeze your glutes so your body stays one straight plank.", "Keep your elbows about 45° from your body, not flared out.", "Lower until your chest is a fist's height from the floor, then press to full lockout."], mistakes: ["Hips sagging or piking up", "Half reps that never get near the floor"], breath: "Breathe in on the way down, out as you press." },
  diamond: { name: "Diamond push-up", hi: "arms", muscles: ["Triceps", "Chest"], cues: ["Thumbs and index fingers touch to make a diamond under your chest.", "Elbows brush your ribs on the way down.", "Body stays rigid from heels to head."], mistakes: ["Elbows flaring wide", "Dropping the head before the chest"], breath: "In on the way down, out on the press." },
  pike: { name: "Pike push-up", hi: "arms", muscles: ["Shoulders", "Triceps"], cues: ["Walk your feet in until your hips are high, like an upside-down V.", "Lower your head forward of your hands, not straight down.", "Keep your legs straight, or bend your knees a little if your hamstrings are tight."], mistakes: ["Dropping the hips so it becomes a normal push-up", "Elbows flaring straight out"], breath: "In as your head lowers, out as you press." },
  squat: { name: "Squat", hi: "legs", muscles: ["Quads", "Glutes"], cues: ["Feet shoulder-width apart, toes turned out slightly.", "Sit back and down as if there's a chair behind you.", "Knees track over your toes.", "Chest up, heels glued to the floor, hip crease below your knee."], mistakes: ["Heels lifting", "Knees caving inward"], breath: "In on the way down, out as you stand." },
  lunge: { name: "Lunge", hi: "legs", muscles: ["Quads", "Glutes", "Balance"], cues: ["Take a long step so both knees can bend to 90°.", "Drop straight down until your back knee kisses the floor.", "Keep your torso tall with your hands on your hips.", "Push through your front heel to come back up."], mistakes: ["Front knee shooting way past your toes", "Leaning the torso forward"], breath: "In on the way down, out as you drive up." },
  burpee: { name: "Burpee", hi: "full", muscles: ["Full body", "Conditioning"], cues: ["Squat down and plant your hands.", "Jump or step your feet back into a plank.", "Chest touches the floor.", "Snap your feet back in and jump with your hands overhead."], mistakes: ["Skipping the chest touch", "No jump at the top"], breath: "Find a rhythm: exhale on the jump." },
  plank: { name: "Forearm plank", hi: "core", muscles: ["Core", "Shoulders"], cues: ["Elbows under your shoulders, forearms parallel.", "Squeeze your glutes and brace like someone is about to poke your stomach.", "Hold a straight line from heels to head."], mistakes: ["Hips sagging toward the floor", "Butt raised high to make it easier"], breath: "Slow, steady breaths through the nose. Don't hold your breath." },
  handstand: { name: "Wall handstand", hi: "arms", muscles: ["Shoulders", "Core"], cues: ["Kick up with your back against the wall, or walk your feet up it with your chest facing the wall.", "Lock your arms and push the floor away.", "Look between your hands, ribs pulled in."], mistakes: ["Bent elbows", "Big banana arch in the lower back"], breath: "Short, calm breaths. Come down before you get dizzy." },
  situp: { name: "Sit-up", hi: "core", muscles: ["Abs", "Hip flexors"], cues: ["Bend your knees with your feet flat on the floor.", "Curl up one vertebra at a time.", "Reach for your knees at the top, then lower with control."], mistakes: ["Yanking your neck with your hands", "Flopping back down"], breath: "Out as you curl up, in as you lower." },
  bridge: { name: "Glute bridge", hi: "legs", muscles: ["Glutes", "Hamstrings"], cues: ["Heels close to your butt, arms flat on the floor.", "Drive through your heels and lift your hips.", "Squeeze your glutes hard for a second at the top."], mistakes: ["Arching the lower back instead of using the glutes", "Feet too far from the body"], breath: "Out as you lift, in as you lower." },
  dip: { name: "Chair dip", hi: "arms", muscles: ["Triceps", "Shoulders"], cues: ["Hands on the edge of a sturdy chair, fingers forward.", "Keep your back close to the chair.", "Lower until your elbows reach 90°, then press up."], mistakes: ["Elbows flaring sideways", "Going so deep that your shoulders hurt"], breath: "In on the way down, out on the press." },
  wallsit: { name: "Wall sit", hi: "legs", muscles: ["Quads", "Glutes"], cues: ["Back flat against the wall.", "Slide down until your thighs are parallel to the floor.", "Knees stacked above your ankles."], mistakes: ["Sitting too high", "Pushing on your thighs with your hands"], breath: "Long exhales help you push through the burn." },
  climber: { name: "Mountain climber", hi: "core", muscles: ["Core", "Shoulders", "Conditioning"], cues: ["Start in a high plank with your hands under your shoulders.", "Drive one knee toward your chest, then switch fast.", "Keep your hips level with your shoulders."], mistakes: ["Butt in the air", "Feet barely moving"], breath: "Quick rhythmic breathing, out every couple of steps." },
  calf: { name: "Calf raise", hi: "legs", muscles: ["Calves"], cues: ["Stand on the balls of your feet, on a step if you have one.", "Rise as high as you can and pause for a second.", "Lower slowly into a full stretch."], mistakes: ["Bouncing", "Bending the knees to cheat"], breath: "Out on the way up." },
  superman: { name: "Superman", hi: "core", muscles: ["Lower back", "Glutes"], cues: ["Lie face down with your arms extended.", "Lift your arms, chest and legs at the same time.", "Hold for a second while looking at the floor."], mistakes: ["Cranking your neck up", "Lifting only your arms"], breath: "Out as you lift." },
  pistol: { name: "Pistol squat", hi: "legs", muscles: ["Quads", "Glutes", "Balance"], cues: ["Stand on one leg with the other held straight in front of you.", "Sit down slowly with your arms reaching forward to counterbalance.", "Keep your heel down, then drive back up."], mistakes: ["Heel lifting", "Knee collapsing inward"], breath: "In on the way down, out on the drive up." },
  posture: { name: "Stand tall", hi: "core", muscles: ["Upper back", "Neck"], cues: [], mistakes: [], breath: "" },
};
export const FLEX_PATH = "M256 60C238 60 226 70 224 87C223 96 224 105 225 112C219 110 219 121 223 128C225 132 228 132 230 132C234 146 240 152 240 159L239 169C224 172 210 176 198 182C186 175 174 173 164 177C155 164 143 157 130 159C120 160 113 166 108 173C110 155 119 140 129 128C137 126 143 121 148 114C152 109 153 103 150 98L143 85C140 80 135 78 130 80C125 75 120 76 116 79C110 77 105 80 103 84C96 84 92 89 92 95L91 112C79 124 68 139 58 156C49 171 40 187 39 200C37 212 43 221 54 227C65 234 79 234 92 230C110 240 132 239 147 230C158 224 165 218 171 216C176 231 180 250 185 268C190 287 198 302 201 320C204 340 202 361 199 382C197 400 196 421 197 449C214 453 235 455 256 455C277 455 298 453 315 449C316 421 315 400 313 382C310 361 308 340 311 320C314 302 322 287 327 268C332 250 336 231 341 216C347 218 354 224 365 230C380 239 402 240 420 230C433 234 447 234 458 227C469 221 475 212 473 200C472 187 463 171 454 156C444 139 433 124 421 112L420 95C420 89 416 84 409 84C407 80 402 77 396 79C392 76 387 75 382 80C377 78 372 80 369 85L362 98C359 103 360 109 364 114C369 121 375 126 383 128C393 140 402 155 404 173C399 166 392 160 382 159C369 157 357 164 348 177C338 173 326 175 314 182C302 176 288 172 273 169L272 159C272 152 278 146 282 132C284 132 287 132 289 128C293 121 293 110 287 112C288 105 289 96 288 87C286 70 274 60 256 60Z";

export const ICON = {
  sleep: `<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>`,
  stretch: `<circle cx="12" cy="4.5" r="2"/><path d="M4 9.5h16M12 9.5v5.5l-4 6M12 15l4 6"/>`,
  protein: `<path d="M12 3c3.9 0 7 6.2 7 10.3A7 7 0 0 1 5 13.3C5 9.2 8.1 3 12 3z"/><circle cx="12" cy="14" r="2.6"/>`,
  steps: `<path d="M8 3.5c1.9 0 3 2.8 3 5.6S10 13 8 13s-3-1.1-3-3.9 1.1-5.6 3-5.6zM16 9.5c1.9 0 3 2.8 3 5.6S18 19 16 19s-3-1.1-3-3.9 1.1-5.6 3-5.6z"/>`,
  posture: `<circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v8M8 21l4-5.5 4 5.5M7 11h10"/>`,
  screens: `<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M3.5 3.5l17 17"/>`,
};
export const HABITS = [
  { id: "sleep", n: "7+ hours sleep", s: "Muscles grow while you sleep" },
  { id: "stretch", n: "10 min mobility", s: "Hips, shoulders, hamstrings" },
  { id: "protein", n: "Protein each meal", s: "About a palm-sized portion" },
  { id: "steps", n: "8,000 steps", s: "Walking counts as recovery" },
  { id: "posture", n: "Hourly posture breaks", s: "Stand up and reset" },
  { id: "screens", n: "No screens before bed", s: "30 minutes, phone away" },
];
export const WATER_GOAL = 8;
export const TIPS = [
  ["Rest days are training days", "Muscles repair and grow between sessions. One easy day a week keeps your streak sustainable."],
  ["Film from the side", "A side angle shows depth on push-ups and squats best, so nobody can call out your depth."],
  ["Grease the groove", "Split today's reps into small sets across the day. Five sets of ten beat one ugly set of fifty."],
  ["Warm up for two minutes", "Arm circles, leg swings and ten slow squats before any quest. Cold joints don't like fast reps."],
  ["Drink before you're thirsty", "Even 2% dehydration noticeably drops your strength. Keep a glass in sight."],
  ["Protein spreads well", "Three or four meals with protein beat one giant serving at dinner."],
  ["Slow down to level up", "Three seconds on the way down makes a mild quest feel like an epic one."],
  ["Sleep is the cheat code", "Under six hours a night slows recovery and raises your injury risk. Aim for seven or more."],
  ["Breathe out on the effort", "Exhale as you push or stand up. Holding your breath spikes your blood pressure."],
  ["Phone at eye level", "Every inch your head drops forward adds roughly 4–5 kg of load on your neck."],
  ["Walk after meals", "A 10-minute walk after eating helps digestion and blood sugar, and adds easy steps."],
  ["Quality over speed", "Being first gets bonus points, but a video the crew throws out gets zero. Clean reps come first."],
  ["Stretch the front, strengthen the back", "Sitting tightens your chest and hip flexors. Open them up and train your upper back."],
  ["Consistency beats intensity", "Showing up 6 days a week at 70% beats 2 heroic days and a week off."],
];
