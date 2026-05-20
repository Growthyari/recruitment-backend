require('dotenv').config();
require('express-async-errors');

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: '*', credentials: true }));

// ─── DB ───────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URL)
  .then(() => { console.log('MongoDB connected'); seedData(); })
  .catch(err => console.error('MongoDB error:', err.message));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  name:       { type: String, required: true, trim: true },
  username:   { type: String, unique: true, sparse: true },
  role:       { type: String, enum: ['student', 'company'], required: true },
  city:       { type: String, default: '' },
  college:    { type: String, default: '' },
  year:       { type: String, default: '' },
  company_name: { type: String, default: '' },
  industry:   { type: String, default: '' },
  grit_score: { type: Number, default: 0 },
  streak:     { type: Number, default: 0 },
  submissions_count: { type: Number, default: 0 },
  bio:        { type: String, default: '' },
  skills:     [String],
  avatar_color: { type: String, default: '#0EA5A0' },
  last_submission_date: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
});

const submissionSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  task_id:    String,
  task_title: String,
  task_skill: String,
  scenario:   String,
  transcript: String,
  audio_data_url: String,
  duration_seconds: Number,
  scores: {
    clarity:    Number,
    persuasion: Number,
    structure:  Number,
    confidence: Number,
    relevance:  Number,
  },
  grit_score:   Number,
  highlight:    String,
  improvement:  String,
  coach_note:   String,
  date:         String,
  created_at:   { type: Date, default: Date.now },
});

const interviewRequestSchema = new mongoose.Schema({
  company_id:   mongoose.Schema.Types.ObjectId,
  company_name: String,
  student_id:   String,
  message:      String,
  role_id:      String,
  status:       { type: String, default: 'pending' },
  created_at:   { type: Date, default: Date.now },
});

const User             = mongoose.model('User', userSchema);
const Submission       = mongoose.model('Submission', submissionSchema);
const InterviewRequest = mongoose.model('InterviewRequest', interviewRequestSchema);

const onboardingBaselineSchema = new mongoose.Schema({
  session_id:       String,
  goal:             String,
  city:             String,
  round1Score:      Number,
  round2Score:      Number,
  round3Score:      Number,
  averageGritScore: Number,
  dimensions: {
    clarity: Number, confidence: Number, persuasion: Number,
    structure: Number, relevance: Number,
  },
  created_at: { type: Date, default: Date.now },
});

const microlearnSessionSchema = new mongoose.Schema({
  session_id:       String,
  goal:             String,
  weekNumber:       { type: Number, default: 1 },
  rounds:           Array,
  overallGritScore: Number,
  baselineScore:    Number,
  improvement:      Number,
  fillerWordCount:  Number,
  created_at:       { type: Date, default: Date.now },
});

const OnboardingBaseline = mongoose.model('OnboardingBaseline', onboardingBaselineSchema);
const MicrolearnSession  = mongoose.model('MicrolearnSession',  microlearnSessionSchema);

// ─── Tasks ────────────────────────────────────────────────────────────────────
const DAILY_TASKS = [
  {
    id: 'task-cold-call', module: 1, number: 1,
    title: 'Cold Call: SaaS for College Cafeterias',
    concept: 'Open a cold call with energy and earn 30 seconds of attention from a skeptical prospect.',
    ai_agent_script: "Yari: The canteen manager gets 10 calls a day. You have exactly 10 seconds before they hang up. Make every word count — go!",
    hint_text: 'Open with the campus name + a specific pain point. Then ask for a 15-minute demo, not a sale.',
    scenario: 'You sell CafeFlow, a SaaS that helps college cafeterias reduce food waste. Cold call the canteen manager of a 5,000-student campus. Open the call, build curiosity, and book a 15-minute demo.',
    duration_target: 60, difficulty: 'Beginner', skill: 'Cold Outreach',
  },
  {
    id: 'task-objection-price', module: 3, number: 1,
    title: 'Handle the Price Objection',
    concept: "Reframe price as value and pivot a 'too expensive' objection back to ROI.",
    ai_agent_script: "Yari: Prospect just said your product is 3x more expensive than the competitor. They're about to hang up. Flip this in 45 seconds.",
    hint_text: "Never defend the price directly. Ask 'Compared to what outcome?' then anchor to ROI.",
    scenario: "Prospect says: 'Your product is 3x more expensive than your competitor.' Respond persuasively, defend value, and pivot back to outcomes.",
    duration_target: 45, difficulty: 'Intermediate', skill: 'Objection Handling',
  },
  {
    id: 'task-elevator', module: 5, number: 1,
    title: '60 Second Elevator Pitch',
    concept: 'Distil your professional identity into a crisp, memorable 60-second pitch that opens doors.',
    ai_agent_script: "Yari: You just stepped into a Bangalore Metro elevator with the CHRO of a Fortune 500. You have 60 seconds and 4 floors. Pitch yourself.",
    hint_text: 'Structure: who you are → what you\'re great at → one concrete proof → your ask. Keep it conversational.',
    scenario: "You're in a Bangalore Metro elevator with the CHRO of a Fortune 500. Pitch yourself, your why, and the value you bring to a sales role. 60 seconds.",
    duration_target: 60, difficulty: 'Beginner', skill: 'Personal Branding',
  },
  {
    id: 'task-discovery', module: 2, number: 1,
    title: 'Discovery Call Opening',
    concept: 'Use high-quality open-ended questions to surface real pain and qualify opportunities.',
    ai_agent_script: "Yari: You're on a discovery call. The Head of Marketing is polite but guarded. Three questions to unlock their real pain — no yes/no questions allowed.",
    hint_text: "Start with 'Walk me through…' or 'Help me understand…'. Dig into impact: 'What does that cost you?'",
    scenario: 'You are running a discovery call with a Head of Marketing at a D2C brand. Ask three high quality, open-ended discovery questions designed to surface real pain.',
    duration_target: 50, difficulty: 'Advanced', skill: 'Discovery',
  },
  {
    id: 'task-close', module: 4, number: 1,
    title: 'The Assumptive Close',
    concept: "Use the assumptive close to lock the next step when a prospect stalls with 'let me think about it'.",
    ai_agent_script: "Yari: 30-minute demo done. They said 'This looks interesting, let me think about it.' Clock is ticking — close without being pushy.",
    hint_text: "Assume the next step: 'Great, let's schedule our onboarding call — Tuesday or Thursday?' If they push back, surface the real objection.",
    scenario: "After a 30 minute demo, the prospect says 'This looks interesting, let me think about it.' Use an assumptive close to lock the next step.",
    duration_target: 40, difficulty: 'Advanced', skill: 'Closing',
  },
  {
    id: 'task-pet-pitch', module: 1, number: 2,
    title: 'Pet Product Field Sales Pitch',
    concept: 'Walk into an existing supplier relationship and earn shelf space with a compelling product pitch.',
    ai_agent_script: "Yari: The pet store owner says he's happy with his current supplier and is busy. You have one shot. Make your product impossible to ignore.",
    hint_text: "Lead with differentiation, not features. 'Our formula is the only one with X, which means your premium customers get Y.' Then handle the supplier objection.",
    scenario: 'You are a field sales executive selling a premium formula-based pet nutrition product. Walk into a pet store in Bangalore. The owner is busy and has a supplier. Pitch your product.',
    duration_target: 60, difficulty: 'Intermediate', skill: 'Field Sales',
  },
];
const TASK_MAP = Object.fromEntries(DAILY_TASKS.map(t => [t.id, t]));

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function taskForToday(userId) {
  const today = new Date().toISOString().split('T')[0];
  return DAILY_TASKS[simpleHash(`${userId}-${today}`) % DAILY_TASKS.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.SECRET_KEY || 'growthyari-secret-2026';

function levelFromGrit(g) {
  if (g >= 85) return 5;
  if (g >= 75) return 4;
  if (g >= 60) return 3;
  if (g >= 40) return 2;
  return 1;
}

function makeUsername(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'user';
}

function createToken(userId) {
  return jwt.sign({ sub: userId.toString(), type: 'access' }, JWT_SECRET, { expiresIn: '7d' });
}

function serializeUser(user, dimAvgs = {}) {
  const grit = user.grit_score || 0;
  return {
    id:           user._id.toString(),
    email:        user.email,
    name:         user.name,
    username:     user.username || '',
    role:         user.role,
    city:         user.city || '',
    college:      user.college || '',
    year:         user.year || '',
    company_name: user.company_name || '',
    industry:     user.industry || '',
    grit_score:   grit,
    level:        levelFromGrit(grit),
    streak:       user.streak || 0,
    submissions_count: user.submissions_count || 0,
    bio:          user.bio || '',
    skills:       user.skills || [],
    avatar_color: user.avatar_color || '#0EA5A0',
    created_at:   user.created_at,
    ...dimAvgs,
  };
}

async function computeDimAvgs(userId) {
  const subs = await Submission.find({ user_id: userId }, 'scores').lean();
  if (!subs.length) return {};
  const dims = ['clarity', 'persuasion', 'structure', 'confidence', 'relevance'];
  const out = {};
  for (const d of dims) {
    const vals = subs.map(s => (s.scores?.[d] || 0) * 5);
    out[`${d}_avg`] = Math.round(vals.reduce((a, v) => a + v, 0) / vals.length);
  }
  return out;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── AI Evaluation ────────────────────────────────────────────────────────────
const EVAL_SYSTEM_PROMPT = `You are GritCoach, an elite Indian sales trainer for college students.
Evaluate the student's spoken sales pitch.

Score on 5 dimensions, each 0-20:
- clarity: clear and structured pitch
- persuasion: emotional pull, hooks, benefits
- structure: opening, body, close
- confidence: assertive language, no fillers
- relevance: addresses the scenario

grit_score = sum of all 5 (0-100).

Return ONLY valid JSON, no markdown:
{"scores":{"clarity":int,"persuasion":int,"structure":int,"confidence":int,"relevance":int},"grit_score":int,"highlight":"single sentence","improvement":"single sentence","coach_note":"two sentences"}`;

function fallbackEval(transcript) {
  const base = Math.min(80, 40 + Math.floor((transcript || '').length / 20));
  const each = Math.floor(base / 5);
  return {
    scores: { clarity: each, persuasion: each, structure: each, confidence: each, relevance: each },
    grit_score: each * 5,
    highlight: 'Energy was there throughout the pitch.',
    improvement: 'Add a clearer ask at the end of your pitch.',
    coach_note: 'Strong attempt. Lean harder into outcomes for the prospect, then close with a specific next step.',
  };
}

async function evaluatePitch(scenario, transcript) {
  if (!transcript || transcript.trim().length < 5) {
    return {
      scores: { clarity: 2, persuasion: 2, structure: 2, confidence: 2, relevance: 2 },
      grit_score: 10,
      highlight: "You showed up — that's step one.",
      improvement: 'Speak for at least 30 seconds so we can really evaluate your delivery.',
      coach_note: 'Your recording was too short. Take a deep breath and aim for a full minute of confident speech.',
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'YOUR_ANTHROPIC_KEY') return fallbackEval(transcript);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        system: EVAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `SCENARIO:\n${scenario}\n\nSTUDENT_TRANSCRIPT:\n${transcript}\n\nReturn the JSON now.` }],
      }),
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallbackEval(transcript);
    const result = JSON.parse(m[0]);
    const scores = result.scores || {};
    for (const k of ['clarity', 'persuasion', 'structure', 'confidence', 'relevance']) {
      scores[k] = Math.max(0, Math.min(20, parseInt(scores[k] ?? 0)));
    }
    result.scores = scores;
    result.grit_score = Math.max(0, Math.min(100, parseInt(result.grit_score ?? Object.values(scores).reduce((a, v) => a + v, 0))));
    result.highlight   = result.highlight   || 'Solid attempt with real grit.';
    result.improvement = result.improvement || 'Slow down and hit your benefit statements harder.';
    result.coach_note  = result.coach_note  || 'Good rep. Tighten your hook and ride into a clear ask.';
    return result;
  } catch (err) {
    console.error('Claude eval error:', err.message);
    return fallbackEval(transcript);
  }
}

// ─── Yari Evaluation ──────────────────────────────────────────────────────────
const YARI_SYSTEM_PROMPT = `You are Yari, a tough but warm Indian sales coach. A student just responded to a sales scenario. Score their response on these 5 dimensions (0-100 each):
- Clarity: Did they communicate clearly?
- Confidence: Did they sound sure of themselves?
- Persuasion: Were they convincing?
- Structure: Was their response organised?
- Relevance: Did they address the actual scenario?

Calculate Grit Score = average of all 5 rounded to nearest whole number.

Return ONLY this JSON, nothing else:
{
  "gritScore": number,
  "clarity": number,
  "confidence": number,
  "persuasion": number,
  "structure": number,
  "relevance": number,
  "highlight": "one thing they did brilliantly — specific, warm, in Hinglish",
  "fix": "one specific thing to improve — actionable, in Hinglish",
  "encouragement": "one motivating line in Hinglish"
}`;

async function yariEvaluate(transcript, scenario, round, goal) {
  if (!transcript || transcript.trim().length < 5) {
    return {
      gritScore: 10, clarity: 10, confidence: 10, persuasion: 10, structure: 10, relevance: 10,
      highlight: 'Aap aaye — yahi toh pehla step hai!',
      fix: 'Pura 30 seconds bolein taaki hum sahi evaluate kar sakein.',
      encouragement: 'Ek aur baar try karein — aap kar sakte hain!',
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'YOUR_ANTHROPIC_KEY') {
    const base = Math.min(80, 40 + Math.floor(transcript.length / 15));
    return {
      gritScore: base, clarity: base, confidence: base - 5,
      persuasion: base - 2, structure: base + 3, relevance: base,
      highlight: 'Aapki energy aur enthusiasm bilkul sahi thi!',
      fix: 'Thoda aur specific bolo — numbers aur examples se stronger lagta hai.',
      encouragement: 'Bahut badiya! Aise hi aage badhte raho.',
    };
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system: YARI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `GOAL: ${goal}\nROUND: ${round}\nSCENARIO: ${scenario}\n\nSTUDENT RESPONSE:\n${transcript}\n\nReturn JSON only.` }],
      }),
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in response');
    const result = JSON.parse(m[0]);
    const dims = ['clarity', 'confidence', 'persuasion', 'structure', 'relevance'];
    for (const d of dims) result[d] = Math.max(0, Math.min(100, Math.round(parseFloat(result[d] ?? 50))));
    const avg = Math.round(dims.reduce((a, d) => a + result[d], 0) / dims.length);
    result.gritScore     = Math.max(0, Math.min(100, parseInt(result.gritScore ?? avg)));
    result.highlight     = result.highlight     || 'Aapki koshish bilkul sahi thi!';
    result.fix           = result.fix           || 'Structure pe thoda dhyan dein.';
    result.encouragement = result.encouragement || 'Har round ke saath better hote jaoge!';
    return result;
  } catch (err) {
    console.error('Yari eval error:', err.message);
    const base = Math.min(80, 40 + Math.floor(transcript.length / 15));
    return {
      gritScore: base, clarity: base, confidence: base - 5,
      persuasion: base - 2, structure: base + 3, relevance: base,
      highlight: 'Aapki koshish aur energy bilkul sahi thi!',
      fix: 'Thoda aur specific bolo — numbers aur examples se stronger lagta hai.',
      encouragement: 'Bahut badiya! Aise hi aage badhte raho.',
    };
  }
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
async function authenticate(req, res, next) {
  let token = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token && req.cookies?.access_token) token = req.cookies.access_token;

  if (!token) return res.status(401).json({ detail: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'access') return res.status(401).json({ detail: 'Invalid token type' });
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ detail: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ detail: msg });
  }
}

const requireStudent = (req, res, next) =>
  req.user.role !== 'student' ? res.status(403).json({ detail: 'Students only' }) : next();

const requireCompany = (req, res, next) =>
  req.user.role !== 'company' ? res.status(403).json({ detail: 'Companies only' }) : next();

// ─── Router ───────────────────────────────────────────────────────────────────
const api = express.Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
api.post('/auth/register', async (req, res) => {
  const { email, password, name, role, city, college, year, company_name, industry } = req.body;
  if (!email || !password || !name || !role)
    return res.status(400).json({ detail: 'email, password, name and role are required' });

  const exists = await User.findOne({ email: email.toLowerCase() }).lean();
  if (exists) return res.status(400).json({ detail: 'An account with this email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  let username = makeUsername(name);
  let suffix = 1;
  while (await User.findOne({ username }).lean()) username = `${makeUsername(name)}${suffix++}`;

  const user = await User.create({
    email: email.toLowerCase().trim(),
    password: hashed,
    name: name.trim(),
    username,
    role,
    city: city || '',
    college: college || '',
    year: year != null ? String(year) : '',
    company_name: company_name || '',
    industry: industry || '',
    avatar_color: role === 'student' ? '#0EA5A0' : '#1A3A6B',
  });

  const token = createToken(user._id);
  res.json({ user: serializeUser(user), access_token: token });
});

api.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).lean();
  if (!user || !await bcrypt.compare(password, user.password))
    return res.status(401).json({ detail: 'Invalid email or password' });
  const token = createToken(user._id);
  res.json({ user: serializeUser(user), access_token: token });
});

api.post('/auth/logout', (req, res) => res.json({ ok: true }));

api.get('/auth/me', authenticate, async (req, res) => {
  const dimAvgs = await computeDimAvgs(req.user._id);
  res.json({ user: serializeUser(req.user, dimAvgs) });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
api.get('/tasks/today', authenticate, requireStudent, async (req, res) => {
  const task = taskForToday(req.user._id.toString());
  const today = todayStr();
  const submission = await Submission.findOne({ user_id: req.user._id, task_id: task.id, date: today }, '-__v').lean();
  res.json({ task, submission: submission ? serializeSub(submission) : null });
});

api.get('/tasks', authenticate, (req, res) => res.json({ tasks: DAILY_TASKS }));

api.get('/tasks/:taskId', authenticate, (req, res) => {
  const task = TASK_MAP[req.params.taskId];
  if (!task) return res.status(404).json({ detail: 'Task not found' });
  res.json(task);
});

api.get('/hint/:taskId', authenticate, requireStudent, (req, res) => {
  const task = TASK_MAP[req.params.taskId];
  if (!task) return res.status(404).json({ detail: 'Task not found' });
  res.json({ hint: task.hint_text });
});

// ── Submissions ───────────────────────────────────────────────────────────────
function serializeSub(s) {
  return {
    id:             s._id.toString(),
    user_id:        s.user_id?.toString(),
    task_id:        s.task_id,
    task_title:     s.task_title,
    task_skill:     s.task_skill,
    scores:         s.scores,
    grit_score:     s.grit_score,
    highlight:      s.highlight,
    improvement:    s.improvement,
    coach_note:     s.coach_note,
    date:           s.date,
    created_at:     s.created_at,
  };
}

api.post('/submissions', authenticate, requireStudent, async (req, res) => {
  const { task_id, transcript, audio_data_url, duration_seconds } = req.body;
  const task = TASK_MAP[task_id];
  if (!task) return res.status(404).json({ detail: 'Task not found' });

  const feedback = await evaluatePitch(task.scenario, transcript);

  const sub = await Submission.create({
    user_id:        req.user._id,
    task_id:        task.id,
    task_title:     task.title,
    task_skill:     task.skill,
    scenario:       task.scenario,
    transcript,
    audio_data_url,
    duration_seconds,
    scores:         feedback.scores,
    grit_score:     feedback.grit_score,
    highlight:      feedback.highlight,
    improvement:    feedback.improvement,
    coach_note:     feedback.coach_note,
    date:           todayStr(),
  });

  // Recompute rolling grit average + streak
  const allSubs = await Submission.find({ user_id: req.user._id }, 'grit_score').lean();
  const avgGrit = Math.round(allSubs.reduce((a, s) => a + s.grit_score, 0) / allSubs.length);

  const last = req.user.last_submission_date;
  const today = todayStr();
  let streak = req.user.streak || 0;
  if (!last) {
    streak = 1;
  } else {
    const diffDays = Math.round((new Date(today) - new Date(last)) / 86400000);
    if (diffDays === 0) streak = Math.max(1, streak);
    else if (diffDays === 1) streak += 1;
    else streak = 1;
  }

  await User.findByIdAndUpdate(req.user._id, {
    grit_score: avgGrit,
    streak,
    submissions_count: allSubs.length,
    last_submission_date: today,
  });

  res.json({ submission: serializeSub(sub) });
});

api.get('/submissions/me', authenticate, requireStudent, async (req, res) => {
  const subs = await Submission.find({ user_id: req.user._id })
    .sort({ created_at: -1 }).limit(200).lean();
  res.json({ submissions: subs.map(serializeSub) });
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
api.get('/leaderboard', authenticate, async (req, res) => {
  const students = await User.find({ role: 'student', submissions_count: { $gt: 0 } })
    .sort({ grit_score: -1 }).limit(20).lean();
  res.json({ leaderboard: students.map(s => serializeUser(s)) });
});

// ── Company: Students ─────────────────────────────────────────────────────────
api.get('/students', authenticate, requireCompany, async (req, res) => {
  const minScore = parseInt(req.query.min_score) || 0;
  const students = await User.find({ role: 'student', grit_score: { $gte: minScore } })
    .sort({ grit_score: -1 }).limit(200).lean();
  res.json({ students: students.map(s => serializeUser(s)) });
});

api.get('/students/:id', authenticate, requireCompany, async (req, res) => {
  let student;
  try { student = await User.findById(req.params.id).lean(); } catch { }
  if (!student || student.role !== 'student')
    return res.status(404).json({ detail: 'Student not found' });

  const dimAvgs = await computeDimAvgs(student._id);
  const evidence = await Submission.find({ user_id: student._id })
    .sort({ grit_score: -1 }).limit(50).lean();

  res.json({
    student: serializeUser(student, dimAvgs),
    evidence: evidence.map(serializeSub),
  });
});

// ── Company: Matches ──────────────────────────────────────────────────────────
api.get('/matches/me', authenticate, requireCompany, async (req, res) => {
  const students = await User.find({ role: 'student', grit_score: { $gte: 70 } })
    .sort({ grit_score: -1 }).limit(50).lean();
  const matches = students.map(s => ({
    id:           s._id.toString(),
    student_id:   s._id.toString(),
    student:      serializeUser(s),
    match_score:  Math.min(0.99, Math.round((s.grit_score / 100 * 0.85 + 0.10) * 100) / 100),
    status:       'new',
  }));
  res.json({ matches });
});

api.post('/interviews/request', authenticate, requireCompany, async (req, res) => {
  const { student_id, message, role_id } = req.body;
  await InterviewRequest.create({
    company_id:   req.user._id,
    company_name: req.user.company_name || req.user.name,
    student_id,
    message,
    role_id,
  });
  res.json({ ok: true, message: 'Interview request sent' });
});

// ── Public profile ─────────────────────────────────────────────────────────────
api.get('/candidate/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username, role: 'student' }).lean();
  if (!user) return res.status(404).json({ detail: 'Profile not found' });
  if (levelFromGrit(user.grit_score) < 3)
    return res.status(403).json({ detail: 'Profile not public yet — Level 3 required' });

  const dimAvgs = await computeDimAvgs(user._id);
  const evidence = await Submission.find({ user_id: user._id })
    .sort({ grit_score: -1 }).limit(10).lean();

  const profile = serializeUser(user, dimAvgs);
  profile.evidence = evidence.map(serializeSub);
  profile.proof_points_completed = user.submissions_count || 0;
  res.json(profile);
});

// ── Yari: Evaluate ────────────────────────────────────────────────────────────
api.post('/evaluate/analyze', async (req, res) => {
  const { transcript, round, goal, scenario } = req.body;
  const result = await yariEvaluate(transcript || '', scenario || '', round || 1, goal || '');
  res.json(result);
});

// ── Yari: Save Baseline ───────────────────────────────────────────────────────
api.post('/users/baseline', async (req, res) => {
  const { userId, goal, city, round1Score, round2Score, round3Score, averageGritScore, dimensions } = req.body;
  const doc = await OnboardingBaseline.create({
    session_id: userId || `anon_${Date.now()}`,
    goal, city,
    round1Score: round1Score || 0,
    round2Score: round2Score || 0,
    round3Score: round3Score || 0,
    averageGritScore: averageGritScore || 0,
    dimensions: dimensions || {},
  });
  res.json({ ok: true, id: doc._id });
});

// ── Yari: Save Microlearn Session ─────────────────────────────────────────────
api.post('/microlearn/session', async (req, res) => {
  const { userId, goal, weekNumber, rounds, overallGritScore, baselineScore, improvement, fillerWordCount } = req.body;
  const doc = await MicrolearnSession.create({
    session_id: userId || `anon_${Date.now()}`,
    goal,
    weekNumber: weekNumber || 1,
    rounds: rounds || [],
    overallGritScore: overallGritScore || 0,
    baselineScore:    baselineScore    || 0,
    improvement:      improvement      || 0,
    fillerWordCount:  fillerWordCount  || 0,
  });
  res.json({ ok: true, id: doc._id });
});

// ── Root ──────────────────────────────────────────────────────────────────────
api.get('/', (req, res) => res.json({ app: 'GrowthYari', status: 'ok', version: '2.0.0-node' }));

app.use('/api', api);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ detail: err.message || 'Server error' });
});

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seedData() {
  const demos = [
    { email: 'aarav@iitb.in',    name: 'Aarav Mehta',    city: 'Mumbai',  college: 'IIT Bombay',   year: '3', grit: 84 },
    { email: 'priya@srcc.in',    name: 'Priya Sharma',   city: 'Delhi',   college: 'SRCC Delhi',   year: '4', grit: 76 },
    { email: 'rahul@bits.in',    name: 'Rahul Iyer',     city: 'Pilani',  college: 'BITS Pilani',  year: '2', grit: 91 },
    { email: 'ananya@nmims.in',  name: 'Ananya Kapoor',  city: 'Mumbai',  college: 'NMIMS Mumbai', year: '4', grit: 88 },
  ];
  const companies = [
    { email: 'talent@razorpay.com', name: 'Razorpay Talent', company_name: 'Razorpay', industry: 'Fintech',   city: 'Bangalore' },
    { email: 'hire@swiggy.com',     name: 'Swiggy Talent',   company_name: 'Swiggy',   industry: 'Food Tech', city: 'Bangalore' },
  ];

  const hashed = await bcrypt.hash('demo123', 10);

  for (const s of demos) {
    if (await User.findOne({ email: s.email }).lean()) continue;
    const username = makeUsername(s.name);
    const user = await User.create({
      email: s.email, password: hashed, name: s.name, username,
      role: 'student', city: s.city, college: s.college, year: s.year,
      grit_score: s.grit, streak: 5, submissions_count: 3,
      last_submission_date: new Date().toISOString().split('T')[0],
      avatar_color: '#0EA5A0',
    });
    const each = Math.floor(s.grit / 5);
    for (let i = 0; i < 3; i++) {
      const task = DAILY_TASKS[i];
      const d = new Date(); d.setDate(d.getDate() - i);
      await Submission.create({
        user_id: user._id, task_id: task.id, task_title: task.title,
        task_skill: task.skill, scenario: task.scenario,
        transcript: `[Demo transcript by ${s.name}]`,
        scores: { clarity: each, persuasion: each, structure: each, confidence: each, relevance: each },
        grit_score: each * 5,
        highlight: 'Strong opener and clear structure.',
        improvement: 'Tighten the close.',
        coach_note: 'Solid rep. Keep building.',
        date: d.toISOString().split('T')[0],
      });
    }
    console.log(`Seeded student: ${s.email}`);
  }

  for (const c of companies) {
    if (await User.findOne({ email: c.email }).lean()) continue;
    await User.create({
      email: c.email, password: hashed, name: c.name,
      username: makeUsername(c.name), role: 'company',
      city: c.city, company_name: c.company_name, industry: c.industry,
      avatar_color: '#1A3A6B',
    });
    console.log(`Seeded company: ${c.email}`);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`GrowthYari API running on http://localhost:${PORT}/api/`);
});
