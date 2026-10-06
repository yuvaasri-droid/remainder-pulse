# RemindPulse - Smart Reminder & Task Management Application

A modern, responsive personal productivity and reminder web application built with **React**, **TypeScript**, **Tailwind CSS**, and **Vite**.

Designed specifically to tackle daily task planning, prioritize urgent/important tasks, trigger audio & visual reminders with snooze capabilities, and deliver multi-dimensional progress analytics (Daily 7-Day trends, Weekend vs. Weekday performance, and Monthly Heatmaps).

---

## 🌟 Key Features

1. **Task & Todo Management**:
   - Create, edit, and delete tasks with due dates, due times, descriptions, and tags (*Work, Personal, Health, Study, Finance, Other*).
   - Granular **Subtask Checklists** with dynamic progress bars. Completing all subtasks auto-resolves the task.
   - Real-time search across titles, descriptions, and subtasks.
   - Categorized filters with quick-access tabs (*All, Today, Important, Upcoming, Completed*).
   - Audio feedback and confetti celebrations upon completing high-impact goals.

2. **Important Tasks & Priority Handling**:
   - One-click Star/Pin toggle to mark tasks as **Important**.
   - 3-tier Priority classification (*High, Medium, Low*).
   - Priority sorting: Incomplete tasks float to the top, ordered by Important status and priority weight.

3. **In-App & Desktop Reminders**:
   - **Synthesized Audio Alert**: Uses the browser's native **Web Audio API** to generate a pleasant dual-tone chime (E5 -> G#5 -> B5)—no external audio files or assets required.
   - **System Desktop Notifications**: Prompts for HTML5 desktop notification permissions so reminders alert you even when the tab is backgrounded.
   - **Interactive Alarm Modal**: Pops up immediately when a scheduled reminder is due with **Snooze (+5m, +15m, +1h)**, **Mark Done**, and **Dismiss** controls.

4. **Progress Reports & Analytics**:
   - **Overview Metrics**: Total created, total completed, overall completion rate (%), active daily streak counter (🔥), and high-priority targets cleared.
   - **Per Day Report (7-Day Trend)**: Bar column visualization showing day-by-day task volume and completion percentage for the past 7 days, with clickable day inspection.
   - **Weekend vs. Weekday Breakdown**: Direct side-by-side comparison cards illustrating completion rates on Weekdays (Mon–Fri) vs. Weekends (Sat–Sun) to ensure healthy work-life rhythm.
   - **Monthly Activity Heatmap**: Interactive full-calendar month view color-coded by productivity intensity, with highlighted weekend columns and previous/next month navigation.

5. **User Authentication & Login Credentials**:
   - **Account Registration & Sign In**: Secure client-side credential management supporting multiple accounts with encrypted session tokens stored in `localStorage`.
   - **1-Click Quick Demo Login**: Pre-seeded demo account (`demo@remindpulse.com` / `password123`) for instant evaluation.
   - **Data Isolation**: Each user gets their own private task database, completion streak, and progress metrics.
   - **User Profile in Header**: Displays user avatar with custom gradient colors, user name, email, and one-click Sign Out.

6. **Storage & Customization**:
   - Zero-configuration offline persistence via `localStorage`.
   - Built-in **Export / Backup JSON** functionality to download data anytime.
   - Seamless **Dark / Light Mode** toggle.

---

## 📁 Project Structure

```text
remainder/
├── index.html                     # HTML5 shell with Google Font & favicon
├── package.json                   # Dependencies and npm scripts
├── postcss.config.js              # PostCSS config with Tailwind and Autoprefixer
├── tailwind.config.js             # Tailwind CSS configuration with dark mode
├── tsconfig.json                  # TypeScript compiler settings
├── vite.config.ts                 # Vite bundler configuration
├── src/
│   ├── main.tsx                   # React root entry point
│   ├── App.tsx                    # Main state orchestrator & reminder watcher
│   ├── index.css                  # Tailwind styles and custom animations
│   ├── types/
│   │   └── index.ts               # Core TypeScript definitions (Task, User, Category, etc.)
│   ├── services/
│   │   ├── authService.ts         # User authentication, registration & session service
│   │   ├── soundService.ts        # Web Audio API sound synthesizer
│   │   ├── notificationService.ts # HTML5 Notification API wrapper
│   │   └── storageService.ts      # Multi-user storage & statistical calculation engine
│   └── components/
│       ├── AuthModal.tsx          # Login & registration modal with 1-click demo access
│       ├── Header.tsx             # Navbar, user profile, filters, theme toggle & stats
│       ├── TaskCard.tsx           # Interactive task item card with subtasks & badges
│       ├── TaskModal.tsx          # Task creation/editing modal with presets
│       ├── ReminderModal.tsx      # Active reminder alert dialog with snooze
│       ├── CategoryBadge.tsx      # Styled category pill components
│       └── ReportsView.tsx        # Daily, Weekend vs Weekday, & Monthly analytics
```

---

## 🛠️ Step-by-Step Implementation Guide

If you want to build or extend this application from scratch, follow these 10 implementation steps:

### Step 1: Project Scaffolding
Initialize a Vite React project with TypeScript:
```bash
npm create vite@latest remainder -- --template react-ts
cd remainder
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install lucide-react canvas-confetti clsx tailwind-merge
npm install -D @types/canvas-confetti
```

Configure `tailwind.config.js`:
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
}
```

Add directives to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### Step 2: Define Data Models (`src/types/index.ts`)
Define contracts for tasks, categories, priorities, subtasks, and statistical records:
```typescript
export type Priority = 'low' | 'medium' | 'high';
export type Category = 'Work' | 'Personal' | 'Health' | 'Study' | 'Finance' | 'Other';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  isImportant: boolean;
  completed: boolean;
  completedAt?: string;
  dueDate: string;        // YYYY-MM-DD
  dueTime?: string;       // HH:mm
  reminderDateTime?: string; // YYYY-MM-DDTHH:mm
  reminderDismissed?: boolean;
  reminderSnoozedUntil?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  subtasks: Subtask[];
  createdAt: string;
}
```

---

### Step 3: Implement Web Audio API Synthesizer (`src/services/soundService.ts`)
Instead of loading static `.mp3` files that could fail to load or get blocked by CORS, use browser oscillators to synthesize crystal-clear sounds:
```typescript
class SoundService {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // Dual-tone chime for scheduled reminder alert
  playReminderChime() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    // Play harmonic frequencies (659.25Hz -> 830.61Hz -> 987.77Hz)
    [659.25, 830.61, 987.77].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.25, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.6);
    });
  }

  // Celebratory ping on completion
  playTaskCompleted() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}
export const soundService = new SoundService();
```

---

### Step 4: Implement Desktop Notifications (`src/services/notificationService.ts`)
Wrap the native HTML5 Notification API:
```typescript
class NotificationService {
  isSupported(): boolean {
    return 'Notification' in window;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    return await Notification.requestPermission();
  }

  showNotification(title: string, options?: NotificationOptions) {
    if (!this.isSupported() || Notification.permission !== 'granted') return null;
    return new Notification(title, { ...options });
  }
}
export const notificationService = new NotificationService();
```

---

### Step 5: Implement Persistence & Metrics Calculations (`src/services/storageService.ts`)
1. **LocalStorage Sync**: Load and save task arrays with `localStorage.getItem` & `localStorage.setItem`.
2. **Weekend Helper**: Determine whether a date falls on Saturday or Sunday (`day === 0 || day === 6`).
3. **Analytics Formulas**:
   - **Daily 7-Day Trend**: Loop through the past 7 days, filtering tasks scheduled for each date and calculating `(completed / total) * 100`.
   - **Weekend vs Weekday**: Segregate tasks by `isWeekend(task.dueDate)`, tallying weekday completed vs weekend completed.
   - **Monthly Activity Grid**: Calculate days in month, empty padding offset for day 1 of month, and completion score per calendar day.
   - **Streak Counter**: Track consecutive days backward with at least 1 completed task.

---

### Step 6: Create Interactive Task Card (`src/components/TaskCard.tsx`)
- Checkbox toggle that triggers `onToggleComplete(task.id)`.
- Star button that triggers `onToggleImportant(task.id)`.
- Pill tags displaying Category, Priority, and Due Date.
- Subtask accordion with checklist progress bar.
- Edit and Delete action triggers.

---

### Step 7: Build Task Creation & Edit Modal (`src/components/TaskModal.tsx`)
- Form inputs for Title, Description, Category dropdown, and Priority selector.
- Important toggle checkbox.
- Date and Time picker.
- Reminder section with quick-set buttons (`+5m`, `+30m`, `+1h`).
- Subtasks manager to add and remove steps.

---

### Step 8: Build Reminder Alert Dialog (`src/components/ReminderModal.tsx`)
When a reminder triggers, this dialog appears over the screen:
- Displays task title, notes, and due time.
- **Snooze actions**: Update `reminderSnoozedUntil` to 5m, 15m, or 1h in the future.
- **Mark Done**: Instantly completes the task and dismisses the alert.
- **Dismiss**: Silences the reminder.

---

### Step 9: Build Progress Reports Dashboard (`src/components/ReportsView.tsx`)
Create 3 sub-views:
1. **Per Day Report**: Responsive column chart displaying daily rate bars and a list of tasks for the selected date.
2. **Weekend vs Weekday Breakdown**: Direct side-by-side performance cards with comparison metrics and work-life balance insights.
3. **Per Month Heatmap**: Full month grid view with color intensity (0%, <50%, 50-99%, 100%) and weekend indicators.

---

### Step 10: App Orchestrator & Polling Watcher (`src/App.tsx`)
Set up a timer that checks every 5 seconds for due reminders:
```typescript
useEffect(() => {
  const checkReminders = () => {
    const now = new Date();
    const dueTask = tasks.find(t => {
      if (t.completed || t.reminderDismissed) return false;
      if (!t.reminderDateTime) return false;
      if (t.reminderSnoozedUntil && new Date(t.reminderSnoozedUntil) > now) return false;
      return new Date(t.reminderDateTime) <= now;
    });

    if (dueTask && (!activeReminderTask || activeReminderTask.id !== dueTask.id)) {
      setActiveReminderTask(dueTask);
      soundService.playReminderChime();
      notificationService.showNotification(`Reminder: ${dueTask.title}`, {
        body: dueTask.description || `Due at ${dueTask.dueTime || dueTask.dueDate}`,
      });
    }
  };

  checkReminders();
  const interval = setInterval(checkReminders, 5000);
  return () => clearInterval(interval);
}, [tasks, activeReminderTask]);
```

---

## 🚀 Running and Building

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Development Mode
To run the local development server with hot-module replacement (HMR):
```bash
npm run dev
```
Open your browser and navigate to:
```text
http://localhost:5173/
```

### 2. Production Build
To check TypeScript types and bundle the app for production:
```bash
npm run build
```
The optimized assets will be emitted to the `dist/` directory.

### 3. Preview Production Build
```bash
npm run preview
```

---

## 💡 Practical Usage Tips

1. **Enable Desktop Notifications**: Click the **Enable Alerts** button on the top right header to allow desktop notifications. Reminders will pop up even if you are on another browser tab.
2. **Test Reminders**: When adding or editing a task, check **Enable App Reminder** and click the **+5 min** button to test the chime and modal.
3. **Backup Data**: Use the **Backup** button in the header anytime to save your tasks as a JSON file.
4. **Dark Mode**: Toggle the Moon/Sun icon in the top header to switch themes. Preferences are saved automatically.
