/**
 * utils.js — TaskFlow Utility Functions
 * Pure helper utilities with no side effects
 */

'use strict';

const Utils = (() => {

    /**
     * Generate a unique ID using timestamp + random suffix
     */
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    /**
     * Format a date string (YYYY-MM-DD) into a human-readable label
     * @param {string} dateStr
     * @returns {string}
     */
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

        if (diffDays === 0)  return 'Today';
        if (diffDays === 1)  return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays < -180 || diffDays > 180 ? 'numeric' : undefined });
    };

    /**
     * Check if a date string is overdue (before today)
     * @param {string} dateStr
     * @returns {boolean}
     */
    const isOverdue = (dateStr) => {
        if (!dateStr) return false;
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    /**
     * Format a timestamp to "time ago" string
     * @param {string} isoString
     * @returns {string}
     */
    const timeAgo = (isoString) => {
        const now = Date.now();
        const then = new Date(isoString).getTime();
        const diff = Math.floor((now - then) / 1000);

        if (diff < 60)    return 'Just now';
        if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    /**
     * Debounce a function call
     * @param {Function} fn
     * @param {number} delay
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
     * Sanitize text to prevent XSS
     * @param {string} str
     * @returns {string}
     */
    const sanitize = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Validate task text
     * @param {string} text
     * @returns {{ valid: boolean, error: string }}
     */
    const validateTask = (text) => {
        if (!text || !text.trim()) {
            return { valid: false, error: '⚠️ Task description cannot be empty.' };
        }
        if (text.trim().length < 2) {
            return { valid: false, error: '⚠️ Task must be at least 2 characters long.' };
        }
        if (text.trim().length > 200) {
            return { valid: false, error: '⚠️ Task cannot exceed 200 characters.' };
        }
        return { valid: true, error: '' };
    };

    /**
     * Priority sort order map
     */
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

    /**
     * Sort tasks by different criteria
     * @param {Array} tasks
     * @param {string} sortBy
     * @returns {Array}
     */
    const sortTasks = (tasks, sortBy) => {
        const arr = [...tasks];
        switch (sortBy) {
            case 'oldest':
                return arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case 'priority':
                return arr.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
            case 'dueDate':
                return arr.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
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
     * Download a file in the browser
     * @param {string} content
     * @param {string} filename
     * @param {string} mime
     */
    const downloadFile = (content, filename, mime = 'application/json') => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Highlight matching text in a string
     * @param {string} text
     * @param {string} query
     * @returns {string} HTML string with <mark> tags
     */
    const highlightText = (text, query) => {
        if (!query || !query.trim()) return sanitize(text);
        const safe = sanitize(text);
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        return safe.replace(regex, '<mark class="highlight">$1</mark>');
    };

    /**
     * Get today's date string in YYYY-MM-DD format
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
        todayStr
    };
})();
