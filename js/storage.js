/**
 * storage.js — TaskFlow Data Persistence Layer
 * Handles all localStorage interactions and data backup/restore
 */

'use strict';

const Storage = (() => {
    const TASKS_KEY    = 'taskflow_tasks';
    const THEME_KEY    = 'taskflow_theme';
    const SORT_KEY     = 'taskflow_sort';
    const FILTER_KEY   = 'taskflow_filter';
    const APP_VERSION  = '1.0.0';

    // ─── Tasks ──────────────────────────────────────────────────────────────

    /**
     * Load tasks from localStorage
     * @returns {Array} Array of task objects
     */
    const loadTasks = () => {
        try {
            const raw = localStorage.getItem(TASKS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            // Migrate tasks if needed (future-proof)
            return parsed.map(migrateTask);
        } catch (err) {
            console.error('[Storage] Failed to load tasks:', err);
            return [];
        }
    };

    /**
     * Save tasks to localStorage
     * @param {Array} tasks
     * @returns {boolean} success
     */
    const saveTasks = (tasks) => {
        try {
            localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
            return true;
        } catch (err) {
            console.error('[Storage] Failed to save tasks:', err);
            return false;
        }
    };

    /**
     * Clear all tasks from localStorage
     */
    const clearTasks = () => {
        try {
            localStorage.removeItem(TASKS_KEY);
        } catch (err) {
            console.error('[Storage] Failed to clear tasks:', err);
        }
    };

    /**
     * Migrate a task object to ensure all required fields are present
     * @param {Object} task
     * @returns {Object}
     */
    const migrateTask = (task) => ({
        id:          task.id || Utils.generateId(),
        text:        task.text || '',
        completed:   Boolean(task.completed),
        createdAt:   task.createdAt || new Date().toISOString(),
        updatedAt:   task.updatedAt || task.createdAt || new Date().toISOString(),
        priority:    ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
        dueDate:     task.dueDate || '',
        category:    task.category || '',
        order:       typeof task.order === 'number' ? task.order : 0,
    });

    // ─── Theme ──────────────────────────────────────────────────────────────

    /**
     * Load saved theme preference
     * @returns {'dark'|'light'}
     */
    const loadTheme = () => {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
            // Respect OS preference
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        } catch {
            return 'dark';
        }
    };

    /**
     * Save theme preference
     * @param {'dark'|'light'} theme
     */
    const saveTheme = (theme) => {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (err) {
            console.error('[Storage] Failed to save theme:', err);
        }
    };

    // ─── Sort / Filter Preferences ──────────────────────────────────────────

    /**
     * Load saved sort preference
     * @returns {string}
     */
    const loadSort = () => {
        try {
            return localStorage.getItem(SORT_KEY) || 'newest';
        } catch {
            return 'newest';
        }
    };

    /**
     * Save sort preference
     * @param {string} sort
     */
    const saveSort = (sort) => {
        try { localStorage.setItem(SORT_KEY, sort); } catch {}
    };

    /**
     * Load saved filter preference
     * @returns {string}
     */
    const loadFilter = () => {
        try {
            return localStorage.getItem(FILTER_KEY) || 'all';
        } catch {
            return 'all';
        }
    };

    /**
     * Save filter preference
     * @param {string} filter
     */
    const saveFilter = (filter) => {
        try { localStorage.setItem(FILTER_KEY, filter); } catch {}
    };

    // ─── Backup & Restore ───────────────────────────────────────────────────

    /**
     * Create a JSON backup of all tasks
     * @param {Array} tasks
     */
    const backup = (tasks) => {
        const data = {
            version:    APP_VERSION,
            exportedAt: new Date().toISOString(),
            taskCount:  tasks.length,
            tasks:      tasks
        };
        const json = JSON.stringify(data, null, 2);
        const filename = `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        Utils.downloadFile(json, filename, 'application/json');
    };

    /**
     * Parse and validate a backup file content
     * @param {string} jsonStr
     * @returns {{ success: boolean, tasks: Array, error: string }}
     */
    const parseBackup = (jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);

            // Support both direct array and wrapped format
            let rawTasks;
            if (Array.isArray(data)) {
                rawTasks = data;
            } else if (data && Array.isArray(data.tasks)) {
                rawTasks = data.tasks;
            } else {
                return { success: false, tasks: [], error: 'Invalid backup format.' };
            }

            const tasks = rawTasks.map(migrateTask).filter(t => t.text && t.text.trim().length > 0);
            return { success: true, tasks, error: '' };
        } catch (err) {
            return { success: false, tasks: [], error: `Failed to parse backup: ${err.message}` };
        }
    };

    /**
     * Get localStorage usage info
     * @returns {{ used: number, total: number, percentUsed: number }}
     */
    const getStorageInfo = () => {
        try {
            let used = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += (localStorage[key].length + key.length) * 2; // bytes (UTF-16)
                }
            }
            const total = 5 * 1024 * 1024; // 5MB typical limit
            return {
                used: Math.round(used / 1024), // KB
                total: Math.round(total / 1024), // KB
                percentUsed: Math.round((used / total) * 100)
            };
        } catch {
            return { used: 0, total: 5120, percentUsed: 0 };
        }
    };

    return {
        loadTasks,
        saveTasks,
        clearTasks,
        loadTheme,
        saveTheme,
        loadSort,
        saveSort,
        loadFilter,
        saveFilter,
        backup,
        parseBackup,
        getStorageInfo
    };
})();
