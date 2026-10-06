import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Task, ViewTab, Category, User } from './types';
import { storageService, formatDate } from './services/storageService';
import { soundService } from './services/soundService';
import { notificationService } from './services/notificationService';
import { authService } from './services/authService';
import { Header } from './components/Header';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { ReminderModal } from './components/ReminderModal';
import { ReportsView } from './components/ReportsView';
import { AuthModal } from './components/AuthModal';
import { 
  PlusCircle, 
  Calendar, 
  Star, 
  CheckCircle2, 
  Layers 
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [tasks, setTasks] = useState<Task[]>(() => 
    storageService.loadTasks(authService.getCurrentUser()?.id)
  );
  const [currentTab, setCurrentTab] = useState<ViewTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [activeReminderTask, setActiveReminderTask] = useState<Task | null>(null);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('taskpulse_theme') === 'dark';
  });

  // Notification permission
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return notificationService.getPermission();
  });

  // Reload tasks when user changes
  useEffect(() => {
    if (currentUser) {
      setTasks(storageService.loadTasks(currentUser.id));
    } else {
      setTasks([]);
    }
  }, [currentUser]);

  // Save tasks for current user
  useEffect(() => {
    if (currentUser) {
      storageService.saveTasks(tasks, currentUser.id);
    }
  }, [tasks, currentUser]);

  // Handle theme changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('taskpulse_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('taskpulse_theme', 'light');
    }
  }, [isDarkMode]);

  // Request notifications
  const handleRequestNotification = async () => {
    const res = await notificationService.requestPermission();
    setNotificationPermission(res);
  };

  // Reminder Watcher: Checks periodically for due reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();

      // Find first task whose reminder is due, not completed, not dismissed, and not currently active
      const dueTask = tasks.find((t) => {
        if (t.completed || t.reminderDismissed) return false;
        if (!t.reminderDateTime) return false;

        // Check if snoozed
        if (t.reminderSnoozedUntil && new Date(t.reminderSnoozedUntil) > now) {
          return false;
        }

        const reminderTime = new Date(t.reminderDateTime);
        return reminderTime <= now;
      });

      if (dueTask && (!activeReminderTask || activeReminderTask.id !== dueTask.id)) {
        // Trigger alert
        setActiveReminderTask(dueTask);
        soundService.playReminderChime();

        // Browser notification
        notificationService.showNotification(`Reminder: ${dueTask.title}`, {
          body: dueTask.description || `Due at ${dueTask.dueTime || dueTask.dueDate}`,
          tag: `task-${dueTask.id}`,
        });
      }
    };

    // Run immediately and every 5 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 5000);
    return () => clearInterval(interval);
  }, [tasks, activeReminderTask]);

  // Toggle Task Completion
  const handleToggleComplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextCompleted = !t.completed;
          if (nextCompleted) {
            soundService.playTaskCompleted();
            if (t.priority === 'high' || t.isImportant) {
              confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.8 },
              });
            }
          }
          return {
            ...t,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  // Toggle Important
  const handleToggleImportant = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isImportant: !t.isImportant } : t))
    );
  };

  // Delete Task
  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeReminderTask?.id === id) {
      setActiveReminderTask(null);
    }
  };

  // Open Edit Modal
  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  // Login & Logout Handlers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveReminderTask(null);
  };

  // Save Task (Create or Update)
  const handleSaveTask = (
    taskData: Omit<Task, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === existingId
            ? { ...t, ...taskData }
            : t
        )
      );
    } else {
      const newTask: Task = {
        ...taskData,
        id: 'task-' + Date.now(),
        userId: currentUser?.id,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
    }
  };

  // Toggle Subtask
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedSubs = (t.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          );
          // If all subtasks completed, mark task completed
          const allCompleted = updatedSubs.length > 0 && updatedSubs.every((s) => s.completed);
          return {
            ...t,
            subtasks: updatedSubs,
            completed: allCompleted ? true : t.completed,
            completedAt: allCompleted && !t.completed ? new Date().toISOString() : t.completedAt,
          };
        }
        return t;
      })
    );
  };

  // Reminder Actions
  const handleDismissReminder = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, reminderDismissed: true } : t))
    );
    setActiveReminderTask(null);
  };

  const handleSnoozeReminder = (taskId: string, minutes: number) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, reminderSnoozedUntil: snoozedUntil } : t
      )
    );
    setActiveReminderTask(null);
  };

  const handleCompleteReminder = (taskId: string) => {
    handleToggleComplete(taskId);
    setActiveReminderTask(null);
  };

  // Export JSON backup
  const handleExport = () => {
    storageService.exportTasksJson(tasks);
  };

  // Filter tasks based on Tab, Category, and Search
  const todayStr = formatDate(new Date());

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Tab filter
      if (currentTab === 'today') {
        if (task.dueDate !== todayStr) return false;
      } else if (currentTab === 'important') {
        if (!task.isImportant) return false;
      } else if (currentTab === 'upcoming') {
        if (task.dueDate <= todayStr || task.completed) return false;
      } else if (currentTab === 'completed') {
        if (!task.completed) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && task.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        const matchesSubs = task.subtasks?.some((s) => s.title.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesSubs) return false;
      }

      return true;
    });
  }, [tasks, currentTab, selectedCategory, searchQuery, todayStr]);

  // Counts for tabs
  const taskCounts = useMemo(() => {
    return {
      all: tasks.filter((t) => !t.completed).length,
      today: tasks.filter((t) => t.dueDate === todayStr && !t.completed).length,
      important: tasks.filter((t) => t.isImportant && !t.completed).length,
      upcoming: tasks.filter((t) => t.dueDate > todayStr && !t.completed).length,
      completed: tasks.filter((t) => t.completed).length,
    };
  }, [tasks, todayStr]);

  // Sort tasks: Incomplete first, then Important tasks first, then by priority (high > medium > low), then dueDate
  const sortedTasks = useMemo(() => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return [...filteredTasks].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.isImportant !== b.isImportant) {
        return a.isImportant ? -1 : 1;
      }
      const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [filteredTasks]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      {/* Sticky Header with Navigation, Search, and Action Bar */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenNewTaskModal={() => {
          setTaskToEdit(null);
          setIsTaskModalOpen(true);
        }}
        onExport={handleExport}
        notificationPermission={notificationPermission}
        onRequestNotification={handleRequestNotification}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        currentUser={currentUser}
        onLogout={handleLogout}
        taskCounts={taskCounts}
      />

      {/* Authentication Gate: show AuthModal if not logged in */}
      {!currentUser && (
        <AuthModal onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* If Reports Tab */}
        {currentTab === 'reports' ? (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Productivity & Progress Analytics
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Detailed performance insights across daily trends, weekend vs. weekday balance, and monthly activity heatmaps.
              </p>
            </div>
            <ReportsView tasks={tasks} />
          </div>
        ) : (
          /* Tasks View */
          <div>
            {/* View Title & Quick Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white capitalize flex items-center gap-2">
                  {currentTab === 'all' && 'All Active Tasks'}
                  {currentTab === 'today' && "Today's Agenda"}
                  {currentTab === 'important' && 'Important & High Priority Tasks'}
                  {currentTab === 'upcoming' && 'Upcoming Tasks'}
                  {currentTab === 'completed' && 'Completed Archive'}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                    {sortedTasks.length} {sortedTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentTab === 'today' && 'Focus on what needs to get done before day end'}
                  {currentTab === 'important' && 'Crucial high-impact priorities and deadlines'}
                  {currentTab === 'all' && 'All your scheduled and active tasks'}
                  {currentTab === 'upcoming' && 'Scheduled for future dates'}
                  {currentTab === 'completed' && 'Tasks successfully marked done'}
                </p>
              </div>

              {/* Quick Today Progress mini badge */}
              {taskCounts.today > 0 && currentTab !== 'today' && (
                <button
                  onClick={() => setCurrentTab('today')}
                  className="self-start sm:self-auto text-xs px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{taskCounts.today} tasks due today</span>
                </button>
              )}
            </div>

            {/* Empty State */}
            {sortedTasks.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-lg mx-auto my-8">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                  {currentTab === 'important' ? (
                    <Star className="w-7 h-7" />
                  ) : currentTab === 'completed' ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : (
                    <Layers className="w-7 h-7" />
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {currentTab === 'important'
                    ? 'No important tasks flagged'
                    : currentTab === 'completed'
                    ? 'No tasks completed yet'
                    : currentTab === 'today'
                    ? 'All clear for today!'
                    : 'No tasks found'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  {currentTab === 'important'
                    ? 'Click the star icon on any task to mark it as important.'
                    : 'Create a new task with due date and reminder to stay on top of your schedule.'}
                </p>
                <button
                  onClick={() => {
                    setTaskToEdit(null);
                    setIsTaskModalOpen(true);
                  }}
                  className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add a New Task
                </button>
              </div>
            ) : (
              /* Task Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onToggleImportant={handleToggleImportant}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                    onToggleSubtask={handleToggleSubtask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
      />

      {/* Active Reminder Trigger Popup Modal */}
      <ReminderModal
        activeReminderTask={activeReminderTask}
        onDismiss={handleDismissReminder}
        onSnooze={handleSnoozeReminder}
        onComplete={handleCompleteReminder}
      />
    </div>
  );
};

export default App;
