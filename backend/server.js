require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── VAPID Setup ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('❌  VAPID keys are missing. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your .env file.');
  console.error('    Generate them with: npx web-push generate-vapid-keys');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ─── In-Memory Stores ─────────────────────────────────────────────────────────
const subscriptions = new Map(); // userId → PushSubscription
let habits = [
  { id: '1', name: 'Exercise for 30 mins', color: '#6C63FF', createdAt: new Date().toISOString(), completions: [] },
  { id: '2', name: 'Read a book', color: '#FF6584', createdAt: new Date().toISOString(), completions: [] },
  { id: '3', name: 'Drink 8 glasses of water', color: '#43BCCD', createdAt: new Date().toISOString(), completions: [] },
  { id: '4', name: 'Meditate for 10 mins', color: '#F9C74F', createdAt: new Date().toISOString(), completions: [] },
];

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Habits API ───────────────────────────────────────────────────────────────
app.get('/api/habits', (req, res) => {
  res.json(habits);
});

app.post('/api/habits', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Habit name is required' });

  const newHabit = {
    id: Date.now().toString(),
    name: name.trim(),
    color: color || '#6C63FF',
    createdAt: new Date().toISOString(),
    completions: [],
  };
  habits.push(newHabit);
  res.status(201).json(newHabit);
});

app.put('/api/habits/:id/complete', (req, res) => {
  const { id } = req.params;
  const { date } = req.body;
  const today = date || new Date().toISOString().split('T')[0];

  const habit = habits.find(h => h.id === id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });

  if (!habit.completions.includes(today)) {
    habit.completions.push(today);
  }
  res.json(habit);
});

app.delete('/api/habits/:id', (req, res) => {
  const { id } = req.params;
  const index = habits.findIndex(h => h.id === id);
  if (index === -1) return res.status(404).json({ error: 'Habit not found' });

  habits.splice(index, 1);
  res.json({ success: true });
});

// ─── Push Subscription ────────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid subscription object. Must contain endpoint and keys.' });
  }

  // Use endpoint as unique key
  const key = subscription.endpoint;
  subscriptions.set(key, subscription);

  console.log(`✅  New push subscription stored. Total subscriptions: ${subscriptions.size}`);
  res.status(201).json({ success: true, message: 'Subscription stored successfully.' });
});

// ─── Trigger Push Notification ────────────────────────────────────────────────
app.post('/api/trigger-push', async (req, res) => {
  const { subscription, title, body, icon } = req.body;

  // Accept either a subscription in the body, or target all stored subscriptions
  const targets = subscription ? [subscription] : Array.from(subscriptions.values());

  if (targets.length === 0) {
    return res.status(400).json({ error: 'No subscriptions available. Subscribe first.' });
  }

  const payload = JSON.stringify({
    title: title || 'Test Notification',
    body: body || 'This is a test push notification from your Habit Tracker!',
    icon: icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    targets.map(sub =>
      webpush.sendNotification(sub, payload).catch(err => {
        // Remove stale subscriptions (410 Gone)
        if (err.statusCode === 410) {
          subscriptions.delete(sub.endpoint);
          console.log('🗑️  Removed stale subscription.');
        }
        throw err;
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`📬  Push sent: ${succeeded} succeeded, ${failed} failed.`);
  res.json({ success: true, sent: succeeded, failed });
});

// ─── VAPID Public Key Endpoint ────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  PWA Habit Tracker backend running on port ${PORT}`);
  console.log(`    Health check: http://localhost:${PORT}/health`);
  console.log(`    VAPID public key: ${VAPID_PUBLIC_KEY.slice(0, 20)}...`);
});

module.exports = app;
