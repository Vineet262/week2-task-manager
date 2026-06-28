/**
 * utils.js — TaskFlow Utility Functions & Application Constants
 * Pure helper utilities with no side-effects, plus centralized config.
 */

'use strict';

// ═══════════════════════════════════════════════════════
//  CONSTANTS — Single source of truth for all magic values
// ═══════════════════════════════════════════════════════

const CONSTANTS = Object.freeze({

    STORAGE: Object.freeze({
        TASKS_KEY:  'taskflow_tasks',
        THEME_KEY:  'taskflow_theme',
        SORT_KEY:   'taskflow_sort',
        FILTER_KEY: 'taskflow_filter',
    }),

    APP_VERSION: '1.0.0',

    VALIDATION: Object.freeze({
        MIN_LENGTH: 2,
        MAX_LENGTH: 200,
    }),

    PRIORITY: Object.freeze({
        VALUES:  ['low', 'medium', 'high'],
        DEFAULT: 'medium',
        ORDER:   Object.freeze({ high: 0, medium: 1, low: 2 }),
    }),

    DEFAULTS: Object.freeze({
        FILTER: 'all',
        SORT:   'newest',
        THEME:  'dark',
    }),

    FILTER_LABELS: Object.freeze({
        all:       'All Tasks',
        active:    'Active Tasks',
        completed: 'Completed Tasks',
        high:      '🔴 High Priority',
    }),

    TOAST: Object.freeze({
        DEFAULT_DURATION: 3500,
    }),

    DEMO_TASKS: Object.freeze([
        { text: 'Welcome to TaskFlow! Click the checkbox to complete a task ✅', priority: 'high',   category: 'Guide' },
        { text: 'Edit this task by clicking the pencil icon ✏️',                priority: 'medium', category: 'Guide' },
        { text: 'Use drag and drop to reorder tasks 🖱️',                        priority: 'medium', category: 'Guide' },
        { text: 'Try the dark/light mode toggle in the top-right corner 🌙',    priority: 'low',    category: 'Guide' },
        { text: 'Filter tasks using the tabs: All, Active, Completed 📋',       priority: 'low',    category: 'Guide' },
        { text: 'Use Ctrl+Enter to quickly add a task from anywhere ⌨️',        priority: 'low',    category: 'Tips'  },
        { text: 'Backup your tasks with the download button 💾',               priority: 'medium', category: 'Tips', useTodayAsDate: true },
    ]),
});


// ═══════════════════════════════════════════════════════
//  UTILS — Pure helper functions
// ═══════════════════════════════════════════════════════

const Utils = (() => {

    /**
     * Generate a unique ID using timestamp + random suffix.
     * @returns {string}
     */
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    /**
     * Format a date string (YYYY-MM-DD) into a human-readable label.
     * @param {string} dateStr
     * @returns {string}
     */
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date  = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

        if (diffDays === 0)              return 'Today';
        if (diffDays === 1)              return 'Tomorrow';
        if (diffDays === -1)             return 'Yesterday';
        if (diffDays > 0  && diffDays <= 7)  return `In ${diffDays} days`;
        if (diffDays < 0  && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day:   'numeric',
            year:  (diffDays < -180 || diffDays > 180) ? 'numeric' : undefined,
        });
    };

    /**
     * Check if a date string is overdue (before today).
     * @param {string} dateStr
     * @returns {boolean}
     */
    const isOverdue = (dateStr) => {
        if (!dateStr) return false;
        const date  = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    /**
     * Format a timestamp to a "time ago" string.
     * @param {string} isoString
     * @returns {string}
     */
    const timeAgo = (isoString) => {
        const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);

        if (diff < 60)     return 'Just now';
        if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

        return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    /**
     * Return a debounced version of a function.
     * @param {Function} fn
     * @param {number}   delay  - milliseconds
     * @returns {Function}
     */
    const debounce = (fn, delay) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    };

    /**
     * Sanitize a string to prevent XSS injection.
     * @param {string} str
     * @returns {string}
     */
    const sanitize = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Validate task text using limits defined in CONSTANTS.
     * @param {string} text
     * @returns {{ valid: boolean, error: string }}
     */
    const validateTask = (text) => {
        const { MIN_LENGTH, MAX_LENGTH } = CONSTANTS.VALIDATION;

        if (!text || !text.trim()) {
            return { valid: false, error: '⚠️ Task description cannot be empty.' };
        }
        if (text.trim().length < MIN_LENGTH) {
            return { valid: false, error: `⚠️ Task must be at least ${MIN_LENGTH} characters long.` };
        }
        if (text.trim().length > MAX_LENGTH) {
            return { valid: false, error: `⚠️ Task cannot exceed ${MAX_LENGTH} characters.` };
        }
        return { valid: true, error: '' };
    };

    /**
     * Sort a task array by a given key.
     * Priority order is driven by CONSTANTS.PRIORITY.ORDER.
     * @param {Object[]} tasks
     * @param {string}   sortBy
     * @returns {Object[]} New sorted array (source not mutated)
     */
    const sortTasks = (tasks, sortBy) => {
        const arr           = [...tasks];
        const priorityOrder = CONSTANTS.PRIORITY.ORDER;

        switch (sortBy) {
            case 'oldest':
                return arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case 'priority':
                return arr.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            case 'dueDate':
                return arr.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate)               return 1;
                    if (!b.dueDate)               return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                });
            case 'alphabetical':
                return arr.sort((a, b) => a.text.localeCompare(b.text));
            case 'newest':
            default:
                return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
    };

    /**
     * Trigger a browser file download.
     * @param {string} content   - File content
     * @param {string} filename
     * @param {string} [mime]    - MIME type
     */
    const downloadFile = (content, filename, mime = 'application/json') => {
        const blob = new Blob([content], { type: mime });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Highlight matching text within a sanitized string.
     * @param {string} text   - Raw task text (will be sanitized internally)
     * @param {string} query  - Search query
     * @returns {string} HTML string with <mark class="highlight"> tags
     */
    const highlightText = (text, query) => {
        if (!query || !query.trim()) return sanitize(text);
        const safe      = sanitize(text);
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return safe.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark class="highlight">$1</mark>');
    };

    /**
     * Return today's date string in YYYY-MM-DD format.
     * @returns {string}
     */
    const todayStr = () => new Date().toISOString().split('T')[0];

    return {
        generateId,
        formatDate,
        isOverdue,
        timeAgo,
        debounce,
        sanitize,
        validateTask,
        sortTasks,
        downloadFile,
        highlightText,
        todayStr,
    };
})();
