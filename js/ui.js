/**
 * ui.js — TaskFlow UI Layer
 * Handles all DOM rendering, toast notifications, modal management
 */

'use strict';

const UI = (() => {

    // ─── Toast Notifications ─────────────────────────────────────────────────

    const TOAST_DURATION = 3500;
    let _toastCounter = 0;

    /**
     * Show a toast notification
     * @param {string} message
     * @param {'success'|'error'|'info'|'warning'} type
     * @param {number} duration
     */
    const showToast = (message, type = 'info', duration = TOAST_DURATION) => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const id = `toast-${++_toastCounter}`;
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.id = id;
        toast.setAttribute('role', 'status');
        toast.innerHTML = `${icons[type] || icons.info}<span>${Utils.sanitize(message)}</span>`;

        container.appendChild(toast);

        const timer = setTimeout(() => removeToast(id), duration);

        toast.addEventListener('click', () => {
            clearTimeout(timer);
            removeToast(id);
        });
    };

    const removeToast = (id) => {
        const toast = document.getElementById(id);
        if (!toast) return;
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    // ─── Error Message ────────────────────────────────────────────────────────

    /**
     * Show or clear form error message
     * @param {string} message - empty string to clear
     */
    const showError = (message) => {
        const el = document.getElementById('taskError');
        if (!el) return;
        el.textContent = message;
        if (message) {
            el.classList.remove('show');
            void el.offsetWidth; // Reflow to restart animation
            el.classList.add('show');
        } else {
            el.classList.remove('show');
        }
    };

    // ─── Task Item Rendering ──────────────────────────────────────────────────

    /**
     * Render a single task item DOM element
     * @param {Object} task
     * @param {string} searchQuery
     * @returns {HTMLLIElement}
     */
    const renderTaskItem = (task, searchQuery = '') => {
        const li = document.createElement('li');
        li.className = `task-item priority-${task.priority}${task.completed ? ' completed' : ''}`;
        li.dataset.id = task.id;
        li.setAttribute('draggable', 'true');
        li.setAttribute('role', 'listitem');
        li.setAttribute('tabindex', '0');
        li.setAttribute('aria-label', `Task: ${task.text}, ${task.completed ? 'completed' : 'active'}, ${task.priority} priority`);

        const overdueClass = (!task.completed && Utils.isOverdue(task.dueDate)) ? ' overdue' : '';
        const dueDateHtml = task.dueDate
            ? `<span class="due-date-badge${overdueClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                ${Utils.formatDate(task.dueDate)}${!task.completed && Utils.isOverdue(task.dueDate) ? ' ⚠️' : ''}
               </span>`
            : '';

        const categoryHtml = task.category
            ? `<span class="category-badge">${Utils.sanitize(task.category)}</span>`
            : '';

        const displayText = Utils.highlightText(task.text, searchQuery);

        li.innerHTML = `
            <input type="checkbox"
                   class="task-select-cb"
                   aria-label="Select task for bulk action"
                   title="Select task"
            />
            <input type="checkbox"
                   class="task-checkbox"
                   id="check-${task.id}"
                   ${task.completed ? 'checked' : ''}
                   aria-checked="${task.completed}"
                   aria-label="${task.completed ? 'Mark as active' : 'Mark as complete'}"
            />
            <div class="drag-handle" title="Drag to reorder" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="5" r="1" fill="currentColor"/>  <circle cx="15" cy="5" r="1" fill="currentColor"/>
                    <circle cx="9" cy="12" r="1" fill="currentColor"/> <circle cx="15" cy="12" r="1" fill="currentColor"/>
                    <circle cx="9" cy="19" r="1" fill="currentColor"/> <circle cx="15" cy="19" r="1" fill="currentColor"/>
                </svg>
            </div>
            <div class="task-content">
                <span class="task-text">${displayText}</span>
                <div class="task-meta">
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                    ${dueDateHtml}
                    ${categoryHtml}
                    <span class="created-at">${Utils.timeAgo(task.createdAt)}</span>
                </div>
            </div>
            <div class="task-actions" role="group" aria-label="Task actions">
                <button class="task-action-btn edit-btn"
                        data-id="${task.id}"
                        aria-label="Edit task"
                        title="Edit task (E)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="task-action-btn delete-btn"
                        data-id="${task.id}"
                        aria-label="Delete task"
                        title="Delete task (Del)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                </button>
            </div>
        `;

        return li;
    };

    // ─── Render Task List ─────────────────────────────────────────────────────

    /**
     * Render all filtered/sorted tasks into the DOM
     * @param {Array} tasks
     * @param {string} searchQuery
     */
    const renderTasks = (tasks, searchQuery = '') => {
        const taskList   = document.getElementById('taskList');
        const emptyState = document.getElementById('emptyState');
        const emptyTitle = document.getElementById('emptyTitle');
        const emptyDesc  = document.getElementById('emptyDesc');

        if (!taskList || !emptyState) return;

        // Inject highlight style if not present
        if (!document.getElementById('highlightStyle')) {
            const style = document.createElement('style');
            style.id = 'highlightStyle';
            style.textContent = `mark.highlight { background: rgba(251, 191, 36, 0.3); color: inherit; border-radius: 2px; padding: 0 1px; }`;
            document.head.appendChild(style);
        }

        if (tasks.length === 0) {
            taskList.innerHTML = '';
            emptyState.classList.add('visible');

            if (searchQuery) {
                emptyTitle.textContent = 'No results found';
                emptyDesc.textContent  = `No tasks match "${searchQuery}". Try a different search.`;
            } else {
                emptyTitle.textContent = 'No tasks here!';
                emptyDesc.textContent  = 'Add your first task above to get started. Stay productive! 🚀';
            }
            return;
        }

        emptyState.classList.remove('visible');

        // Diff rendering: remove items not in new tasks, add/update
        const existingItems = new Map();
        taskList.querySelectorAll('.task-item').forEach(el => {
            existingItems.set(el.dataset.id, el);
        });

        const newIds = new Set(tasks.map(t => t.id));

        // Remove items not in new list
        existingItems.forEach((el, id) => {
            if (!newIds.has(id)) {
                el.classList.add('removing');
                el.addEventListener('animationend', () => el.remove(), { once: true });
            }
        });

        // Add or reorder items
        tasks.forEach((task, index) => {
            const existing = existingItems.get(task.id);
            const newEl = renderTaskItem(task, searchQuery);

            if (existing) {
                // Replace if content changed
                taskList.insertBefore(newEl, taskList.children[index] || null);
                existing.remove();
            } else {
                taskList.insertBefore(newEl, taskList.children[index] || null);
            }
        });
    };

    // ─── Stats ────────────────────────────────────────────────────────────────

    /**
     * Update the stats cards and progress bar
     * @param {Array} allTasks
     */
    const updateStats = (allTasks) => {
        const total     = allTasks.length;
        const completed = allTasks.filter(t => t.completed).length;
        const active    = total - completed;
        const percent   = total > 0 ? Math.round((completed / total) * 100) : 0;

        const animate = (el, value) => {
            if (!el) return;
            const current = parseInt(el.textContent) || 0;
            if (current === value) return;
            // Micro animation: count up/down
            const diff = value - current;
            const step = diff > 0 ? 1 : -1;
            const steps = Math.min(Math.abs(diff), 20);
            const interval = 15;
            let count = 0;
            const timer = setInterval(() => {
                count++;
                el.textContent = current + Math.round(diff * (count / steps));
                if (count >= steps) {
                    clearInterval(timer);
                    el.textContent = value;
                }
            }, interval);
        };

        animate(document.getElementById('totalTasks'),     total);
        animate(document.getElementById('activeTasks'),    active);
        animate(document.getElementById('completedTasks'), completed);

        const pctEl = document.getElementById('progressPercent');
        if (pctEl) pctEl.textContent = percent + '%';

        const bar = document.getElementById('progressBar');
        if (bar) bar.style.width = percent + '%';
    };

    // ─── Modal ────────────────────────────────────────────────────────────────

    /**
     * Open the edit modal for a task
     * @param {Object} task
     */
    const openEditModal = (task) => {
        const modal = document.getElementById('editModal');
        if (!modal) return;

        document.getElementById('editTaskInput').value = task.text;
        document.getElementById('editPriority').value  = task.priority;
        document.getElementById('editDueDate').value   = task.dueDate || '';
        document.getElementById('editCategory').value  = task.category || '';
        modal.dataset.editId = task.id;

        modal.classList.add('open');
        document.getElementById('editTaskInput').focus();
        document.body.style.overflow = 'hidden';
    };

    /**
     * Close the edit modal
     */
    const closeEditModal = () => {
        const modal = document.getElementById('editModal');
        if (!modal) return;
        modal.classList.remove('open');
        delete modal.dataset.editId;
        document.body.style.overflow = '';
    };

    // ─── Theme ────────────────────────────────────────────────────────────────

    /**
     * Apply a theme to the document
     * @param {'dark'|'light'} theme
     */
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
    };

    // ─── List Title ──────────────────────────────────────────────────────────

    /**
     * Update the list title based on current filter
     * @param {string} filter
     * @param {number} count
     */
    const updateListTitle = (filter, count) => {
        const el = document.getElementById('listTitle');
        if (!el) return;
        const labels = {
            all:       'All Tasks',
            active:    'Active Tasks',
            completed: 'Completed Tasks',
            high:      '🔴 High Priority'
        };
        el.textContent = `${labels[filter] || 'All Tasks'} (${count})`;
    };

    // ─── Bulk Actions UI ─────────────────────────────────────────────────────

    /**
     * Update bulk actions bar visibility and count
     * @param {number} count
     */
    const updateBulkActions = (count) => {
        const bar = document.getElementById('bulkActions');
        const countEl = document.getElementById('bulkSelectedCount');
        if (!bar || !countEl) return;
        countEl.textContent = `${count} selected`;
        bar.classList.toggle('visible', count > 0);
    };

    return {
        showToast,
        showError,
        renderTaskItem,
        renderTasks,
        updateStats,
        openEditModal,
        closeEditModal,
        applyTheme,
        updateListTitle,
        updateBulkActions
    };
})();
