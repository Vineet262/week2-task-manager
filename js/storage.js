/**
 * storage.js — TaskFlow Data Persistence Layer
 * Handles all localStorage interactions and data backup/restore.
 *
 * Dependencies: utils.js (loaded before this file)
 */

'use strict';

const Storage = (() => {
    const { TASKS_KEY, THEME_KEY, SORT_KEY, FILTER_KEY } = CONSTANTS.STORAGE;
    const { APP_VERSION }                                 = CONSTANTS;
    const { VALUES: PRIORITY_VALUES, DEFAULT: DEFAULT_PRIORITY } = CONSTANTS.PRIORITY;
    const { DEFAULTS }                                    = CONSTANTS;

    // ─── Tasks ──────────────────────────────────────────────────────────────

    /**
     * Load tasks from localStorage.
     * @returns {Object[]} Array of task objects
     */
    const loadTasks = () => {
        try {
            const raw = localStorage.getItem(TASKS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.map(_migrateTask);
        } catch (err) {
            console.error('[Storage] Failed to load tasks:', err);
            return [];
        }
    };

    /**
     * Save tasks to localStorage.
     * @param {Object[]} tasks
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
     * Clear all tasks from localStorage.
     */
    const clearTasks = () => {
        try {
            localStorage.removeItem(TASKS_KEY);
        } catch (err) {
            console.error('[Storage] Failed to clear tasks:', err);
        }
    };

    /**
     * Migrate a task object to ensure all required fields are present.
     * Uses a simple inline ID generator to avoid a circular dependency on Utils.
     * @param {Object} task
     * @returns {Object}
     */
    const _migrateTask = (task) => ({
        id:        task.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
        text:      task.text || '',
        completed: Boolean(task.completed),
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
        priority:  PRIORITY_VALUES.includes(task.priority) ? task.priority : DEFAULT_PRIORITY,
        dueDate:   task.dueDate || '',
        category:  task.category || '',
        order:     typeof task.order === 'number' ? task.order : 0,
    });

    // ─── Theme ──────────────────────────────────────────────────────────────

    /**
     * Load saved theme preference.
     * Falls back to the OS colour-scheme preference.
     * @returns {'dark'|'light'}
     */
    const loadTheme = () => {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        } catch {
            return DEFAULTS.THEME;
        }
    };

    /**
     * Persist theme preference.
     * @param {'dark'|'light'} theme
     */
    const saveTheme = (theme) => {
        try { localStorage.setItem(THEME_KEY, theme); }
        catch (err) { console.error('[Storage] Failed to save theme:', err); }
    };

    // ─── Sort / Filter Preferences ──────────────────────────────────────────

    /**
     * Load saved sort preference.
     * @returns {string}
     */
    const loadSort = () => {
        try { return localStorage.getItem(SORT_KEY) || DEFAULTS.SORT; }
        catch { return DEFAULTS.SORT; }
    };

    /**
     * Persist sort preference.
     * @param {string} sort
     */
    const saveSort = (sort) => {
        try { localStorage.setItem(SORT_KEY, sort); } catch {}
    };

    /**
     * Load saved filter preference.
     * @returns {string}
     */
    const loadFilter = () => {
        try { return localStorage.getItem(FILTER_KEY) || DEFAULTS.FILTER; }
        catch { return DEFAULTS.FILTER; }
    };

    /**
     * Persist filter preference.
     * @param {string} filter
     */
    const saveFilter = (filter) => {
        try { localStorage.setItem(FILTER_KEY, filter); } catch {}
    };

    // ─── Backup & Restore ───────────────────────────────────────────────────

    /**
     * Create a JSON backup of all tasks and trigger a browser download.
     * Receives the download utility as an explicit dependency (no hidden coupling).
     * @param {Object[]} tasks
     * @param {Function} downloadFn  - e.g. Utils.downloadFile
     */
    const backup = (tasks, downloadFn) => {
        const data = {
            version:    APP_VERSION,
            exportedAt: new Date().toISOString(),
            taskCount:  tasks.length,
            tasks,
        };
        const json     = JSON.stringify(data, null, 2);
        const filename = `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        downloadFn(json, filename, 'application/json');
    };

    /**
     * Parse and validate a backup file's JSON content.
     * @param {string} jsonStr
     * @returns {{ success: boolean, tasks: Object[], error: string }}
     */
    const parseBackup = (jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);

            let rawTasks;
            if (Array.isArray(data)) {
                rawTasks = data;
            } else if (data && Array.isArray(data.tasks)) {
                rawTasks = data.tasks;
            } else {
                return { success: false, tasks: [], error: 'Invalid backup format.' };
            }

            const tasks = rawTasks
                .map(_migrateTask)
                .filter(t => t.text && t.text.trim().length > 0);

            return { success: true, tasks, error: '' };
        } catch (err) {
            return { success: false, tasks: [], error: `Failed to parse backup: ${err.message}` };
        }
    };

    /**
     * Return current localStorage usage statistics.
     * @returns {{ used: number, total: number, percentUsed: number }}
     */
    const getStorageInfo = () => {
        try {
            let used = 0;
            for (const key in localStorage) {
                if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
                    used += (localStorage[key].length + key.length) * 2;
                }
            }
            const total = 5 * 1024 * 1024;
            return {
                used:        Math.round(used / 1024),
                total:       Math.round(total / 1024),
                percentUsed: Math.round((used / total) * 100),
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
        getStorageInfo,
    };
})();
