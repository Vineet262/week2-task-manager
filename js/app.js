/**
 * app.js — TaskFlow Application Controller
 *
 * This file is organized into four clearly separated sections:
 *
 *   1. Filter        — Pure filter / search / sort pipeline
 *   2. DragDrop      — Self-contained drag-and-drop subsystem
 *   3. TaskManager   — Business logic & application state
 *   4. EventHandlers — All DOM event wiring (separated from business logic)
 *
 * Dependencies (loaded before this file):
 *   utils.js   → CONSTANTS, Utils
 *   storage.js → Storage
 *   ui.js      → UI
 */

'use strict';

// ═══════════════════════════════════════════════════════
//  SECTION 1 — FILTER
//  Pure filter / search / sort pipeline.
//  No DOM access, no side-effects — independently testable.
// ═══════════════════════════════════════════════════════

const Filter = (() => {

    /**
     * Apply filter, search query, and sort to a task array.
     * @param {Object[]} tasks
     * @param {Object}   options
     * @param {string}   options.filter  - 'all' | 'active' | 'completed' | 'high'
     * @param {string}   options.query   - Free-text search string
     * @param {string}   options.sort    - Sort key
     * @returns {Object[]} New filtered + sorted array
     */
    const apply = (tasks, { filter = CONSTANTS.DEFAULTS.FILTER, query = '', sort = CONSTANTS.DEFAULTS.SORT } = {}) => {
        let result = _applyFilter(tasks, filter);
        result     = _applySearch(result, query);
        result     = Utils.sortTasks(result, sort);
        return result;
    };

    const _applyFilter = (tasks, filter) => {
        switch (filter) {
            case 'active':    return tasks.filter(t => !t.completed);
            case 'completed': return tasks.filter(t => t.completed);
            case 'high':      return tasks.filter(t => t.priority === 'high');
            default:          return [...tasks];
        }
    };

    const _applySearch = (tasks, query) => {
        if (!query || !query.trim()) return tasks;
        const q = query.toLowerCase();
        return tasks.filter(t =>
            t.text.toLowerCase().includes(q) ||
            (t.category && t.category.toLowerCase().includes(q))
        );
    };

    return { apply };
})();


// ═══════════════════════════════════════════════════════
//  SECTION 2 — DRAGDROP
//  Self-contained drag-and-drop subsystem.
//  Communicates via a single onReorder(srcId, targetId)
//  callback — zero coupling to TaskManager internals.
// ═══════════════════════════════════════════════════════

const DragDrop = (() => {

    let _srcId     = null;
    let _listEl    = null;
    let _onReorder = null;
    let _handlers  = {};

    /**
     * Initialise drag-and-drop on a list element (idempotent).
     * @param {HTMLElement} listEl
     * @param {Function}    onReorder - Called with (srcId, targetId) on drop
     */
    const init = (listEl, onReorder) => {
        if (!listEl || typeof onReorder !== 'function') return;
        teardown(); // Remove any stale listeners first

        _listEl    = listEl;
        _onReorder = onReorder;

        _handlers = {
            dragstart: _onDragStart,
            dragend:   _onDragEnd,
            dragover:  _onDragOver,
            dragleave: _onDragLeave,
            drop:      _onDrop,
        };

        Object.entries(_handlers).forEach(([evt, fn]) => _listEl.addEventListener(evt, fn));
    };

    /** Remove all drag-and-drop listeners. */
    const teardown = () => {
        if (!_listEl || !Object.keys(_handlers).length) return;
        Object.entries(_handlers).forEach(([evt, fn]) => _listEl.removeEventListener(evt, fn));
        _handlers = {};
        _listEl   = null;
    };

    const _onDragStart = (e) => {
        const item = e.target.closest('.task-item');
        if (!item) return;
        _srcId = item.dataset.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', _srcId);
    };

    const _onDragEnd = (e) => {
        e.target.closest('.task-item')?.classList.remove('dragging');
        _clearDragOver();
        _srcId = null;
    };

    const _onDragOver = (e) => {
        e.preventDefault();
        const item = e.target.closest('.task-item');
        if (!item || item.dataset.id === _srcId) return;
        _clearDragOver();
        item.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    };

    const _onDragLeave = (e) => {
        e.target.closest('.task-item')?.classList.remove('drag-over');
    };

    const _onDrop = (e) => {
        e.preventDefault();
        const targetItem = e.target.closest('.task-item');
        if (!targetItem || !_srcId || targetItem.dataset.id === _srcId) return;
        targetItem.classList.remove('drag-over');
        const srcId    = _srcId;
        _srcId = null;
        _onReorder?.(srcId, targetItem.dataset.id);
    };

    const _clearDragOver = () => {
        _listEl?.querySelectorAll('.task-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    };

    return { init, teardown };
})();


// ═══════════════════════════════════════════════════════
//  SECTION 3 — TASK MANAGER
//  Holds application state and implements business logic.
//  Delegates all DOM wiring to EventHandlers (Section 4).
// ═══════════════════════════════════════════════════════

class TaskManager {
    constructor() {
        this.tasks         = Storage.loadTasks();
        this.currentFilter = Storage.loadFilter();
        this.currentSort   = Storage.loadSort();
        this.searchQuery   = '';
        this.selectedIds   = new Set();

        this._init();
    }

    // ─── Initialization ───────────────────────────────────────────────────────

    _init() {
        UI.applyTheme(Storage.loadTheme());
        this._setActiveFilter(this.currentFilter);

        const sortEl = document.getElementById('sortSelect');
        if (sortEl) sortEl.value = this.currentSort;

        this._refresh();
        EventHandlers.bind(this);

        console.log(`[TaskFlow] Initialized with ${this.tasks.length} tasks.`);
    }

    // ─── Core CRUD ────────────────────────────────────────────────────────────

    /**
     * Add a new task.
     * @param {{ text: string, priority?: string, dueDate?: string, category?: string }} opts
     * @returns {boolean} success
     */
    addTask({ text, priority = CONSTANTS.PRIORITY.DEFAULT, dueDate = '', category = '' }) {
        const { valid, error } = Utils.validateTask(text);
        if (!valid) { UI.showError(error); return false; }

        const task = {
            id:        Utils.generateId(),
            text:      text.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            priority,
            dueDate,
            category:  category.trim(),
            order:     this.tasks.length,
        };

        this.tasks.unshift(task);
        this._save();
        this._refresh();
        UI.showToast('Task added successfully! ✨', 'success');
        return true;
    }

    /**
     * Delete a task by ID (with removal animation).
     * @param {string} id
     */
    deleteTask(id) {
        const el = document.querySelector(`.task-item[data-id="${id}"]`);
        if (el) {
            el.classList.add('removing');
            el.addEventListener('animationend', () => {
                this.tasks = this.tasks.filter(t => t.id !== id);
                this.selectedIds.delete(id);
                this._save();
                this._refresh();
            }, { once: true });
        } else {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this._save();
            this._refresh();
        }
        UI.showToast('Task deleted.', 'info');
    }

    /**
     * Toggle the completed state of a task.
     * @param {string} id
     */
    toggleComplete(id) {
        this.tasks = this.tasks.map(t =>
            t.id === id
                ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
                : t
        );
        this._save();
        this._refresh();

        const task = this.tasks.find(t => t.id === id);
        if (task) {
            UI.showToast(
                task.completed ? '✅ Task completed!' : '↩️ Task marked as active.',
                task.completed ? 'success' : 'info'
            );
        }
    }

    /**
     * Update an existing task's fields.
     * @param {string} id
     * @param {Object} updates
     * @returns {boolean} success
     */
    updateTask(id, updates) {
        const { valid, error } = Utils.validateTask(updates.text);
        if (!valid) { UI.showError(error); return false; }

        this.tasks = this.tasks.map(t =>
            t.id === id
                ? { ...t, ...updates, text: updates.text.trim(), updatedAt: new Date().toISOString() }
                : t
        );
        this._save();
        this._refresh();
        UI.showToast('Task updated! 💾', 'success');
        return true;
    }

    /**
     * Remove all completed tasks.
     */
    clearCompleted() {
        const count = this.tasks.filter(t => t.completed).length;
        if (count === 0) { UI.showToast('No completed tasks to clear.', 'info'); return; }
        this.tasks = this.tasks.filter(t => !t.completed);
        this.selectedIds.clear();
        this._save();
        this._refresh();
        UI.showToast(`🗑️ Cleared ${count} completed task${count !== 1 ? 's' : ''}.`, 'info');
    }

    // ─── Reorder (called by DragDrop) ─────────────────────────────────────────

    /**
     * Move a task from one position to another after a drag-and-drop.
     * @param {string} srcId
     * @param {string} targetId
     */
    reorderTask(srcId, targetId) {
        const srcIdx    = this.tasks.findIndex(t => t.id === srcId);
        const targetIdx = this.tasks.findIndex(t => t.id === targetId);
        if (srcIdx === -1 || targetIdx === -1) return;

        const [moved] = this.tasks.splice(srcIdx, 1);
        this.tasks.splice(targetIdx, 0, moved);
        this.tasks.forEach((t, i) => { t.order = i; });

        this._save();
        this._refresh();
    }

    // ─── Bulk Operations ──────────────────────────────────────────────────────

    /** Mark all selected tasks as complete. */
    bulkComplete() {
        if (this.selectedIds.size === 0) return;
        this.tasks = this.tasks.map(t =>
            this.selectedIds.has(t.id)
                ? { ...t, completed: true, updatedAt: new Date().toISOString() }
                : t
        );
        const count = this.selectedIds.size;
        this.selectedIds.clear();
        this._save();
        this._refresh();
        UI.showToast(`✅ ${count} task${count !== 1 ? 's' : ''} marked complete.`, 'success');
    }

    /** Delete all selected tasks. */
    bulkDelete() {
        if (this.selectedIds.size === 0) return;
        const count = this.selectedIds.size;
        this.tasks  = this.tasks.filter(t => !this.selectedIds.has(t.id));
        this.selectedIds.clear();
        this._save();
        this._refresh();
        UI.showToast(`🗑️ Deleted ${count} task${count !== 1 ? 's' : ''}.`, 'info');
    }

    /** Toggle selection of all currently visible tasks. */
    toggleSelectAll() {
        const visible     = this._getDisplayTasks();
        const allSelected = visible.every(t => this.selectedIds.has(t.id));

        visible.forEach(t => allSelected
            ? this.selectedIds.delete(t.id)
            : this.selectedIds.add(t.id)
        );

        document.querySelectorAll('.task-select-cb').forEach(cb => {
            const id = cb.closest('.task-item')?.dataset.id;
            if (id) cb.checked = this.selectedIds.has(id);
        });

        UI.updateBulkActions(this.selectedIds.size);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /** Delegate filter / search / sort to the Filter module. */
    _getDisplayTasks() {
        return Filter.apply(this.tasks, {
            filter: this.currentFilter,
            query:  this.searchQuery,
            sort:   this.currentSort,
        });
    }

    _setActiveFilter(filter) {
        document.querySelectorAll('.filter-tab').forEach(btn => {
            const isActive = btn.dataset.filter === filter;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    _save() { Storage.saveTasks(this.tasks); }

    _refresh() {
        const displayTasks = this._getDisplayTasks();
        UI.renderTasks(displayTasks, this.searchQuery);
        UI.updateStats(this.tasks);
        UI.updateListTitle(this.currentFilter, displayTasks.length);

        // Re-init drag-and-drop after re-render (idempotent)
        DragDrop.init(
            document.getElementById('taskList'),
            (srcId, targetId) => this.reorderTask(srcId, targetId)
        );

        // Restore checkbox states after re-render
        if (this.selectedIds.size > 0) {
            document.querySelectorAll('.task-select-cb').forEach(cb => {
                const id = cb.closest('.task-item')?.dataset.id;
                if (id) cb.checked = this.selectedIds.has(id);
            });
            UI.updateBulkActions(this.selectedIds.size);
        }
    }
}


// ═══════════════════════════════════════════════════════
//  SECTION 4 — EVENT HANDLERS
//  All DOM event wiring in one place, separated from
//  business logic. Calls back into TaskManager methods.
// ═══════════════════════════════════════════════════════

const EventHandlers = (() => {

    /**
     * Bind all application event listeners to the given TaskManager instance.
     * @param {TaskManager} manager
     */
    const bind = (manager) => {
        _bindForm(manager);
        _bindFilters(manager);
        _bindSearch(manager);
        _bindTaskList(manager);
        _bindModal(manager);
        _bindThemeToggle();
        _bindBackupRestore(manager);
        _bindBulkActions(manager);
        _bindSort(manager);
        _bindKeyboardShortcuts(manager);
    };

    // ─── Form ─────────────────────────────────────────────────────────────────

    const _bindForm = (manager) => {
        const form      = document.getElementById('taskForm');
        const input     = document.getElementById('taskInput');
        const charCount = document.getElementById('charCount');
        const maxLen    = CONSTANTS.VALIDATION.MAX_LENGTH;

        if (input && charCount) {
            input.addEventListener('input', () => {
                const len = input.value.length;
                charCount.textContent = `${len}/${maxLen}`;
                charCount.style.color = len > maxLen - 20
                    ? '#f87171'
                    : len > maxLen - 50 ? '#fbbf24' : '';
                UI.showError('');
            });
        }

        form?.addEventListener('submit', (e) => { e.preventDefault(); _handleAddTask(manager); });
    };

    const _handleAddTask = (manager) => {
        const input    = document.getElementById('taskInput');
        const priority = document.getElementById('prioritySelect');
        const dueDate  = document.getElementById('dueDateInput');
        const category = document.getElementById('categoryInput');
        const maxLen   = CONSTANTS.VALIDATION.MAX_LENGTH;

        const success = manager.addTask({
            text:     input?.value    || '',
            priority: priority?.value || CONSTANTS.PRIORITY.DEFAULT,
            dueDate:  dueDate?.value  || '',
            category: category?.value || '',
        });

        if (success) {
            if (input)    { input.value = ''; document.getElementById('charCount').textContent = `0/${maxLen}`; }
            if (dueDate)  dueDate.value  = '';
            if (category) category.value = '';
            if (priority) priority.value = CONSTANTS.PRIORITY.DEFAULT;
            input?.focus();
        }
    };

    // ─── Filters ─────────────────────────────────────────────────────────────

    const _bindFilters = (manager) => {
        document.querySelectorAll('.filter-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                manager.currentFilter = btn.dataset.filter;
                Storage.saveFilter(manager.currentFilter);
                manager._setActiveFilter(manager.currentFilter);
                manager.selectedIds.clear();
                UI.updateBulkActions(0);
                manager._refresh();
            });
        });

        document.getElementById('clearCompletedBtn')
            ?.addEventListener('click', () => manager.clearCompleted());

        document.getElementById('selectAllBtn')
            ?.addEventListener('click', () => manager.toggleSelectAll());
    };

    // ─── Search ───────────────────────────────────────────────────────────────

    const _bindSearch = (manager) => {
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        if (!searchInput) return;

        const debouncedSearch = Utils.debounce((val) => {
            manager.searchQuery = val;
            manager._refresh();
        }, 250);

        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
            if (clearSearch) clearSearch.style.display = e.target.value ? 'flex' : 'none';
        });

        clearSearch?.addEventListener('click', () => {
            searchInput.value   = '';
            manager.searchQuery = '';
            clearSearch.style.display = 'none';
            searchInput.focus();
            manager._refresh();
        });
    };

    // ─── Task List (event delegation) ────────────────────────────────────────

    const _bindTaskList = (manager) => {
        const list = document.getElementById('taskList');
        if (!list) return;

        list.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            const id = taskItem.dataset.id;

            if (e.target.classList.contains('task-checkbox')) {
                manager.toggleComplete(id);
            } else if (e.target.classList.contains('task-select-cb')) {
                e.target.checked ? manager.selectedIds.add(id) : manager.selectedIds.delete(id);
                UI.updateBulkActions(manager.selectedIds.size);
            } else if (e.target.closest('.edit-btn')) {
                const task = manager.tasks.find(t => t.id === id);
                if (task) UI.openEditModal(task);
            } else if (e.target.closest('.delete-btn')) {
                manager.deleteTask(id);
            }
        });

        list.addEventListener('keydown', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem || document.activeElement !== taskItem) return;
            const id = taskItem.dataset.id;

            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); manager.deleteTask(id); }
            if (e.key === 'e' || e.key === 'E') { const t = manager.tasks.find(x => x.id === id); if (t) UI.openEditModal(t); }
            if (e.key === ' ') { e.preventDefault(); manager.toggleComplete(id); }
        });
    };

    // ─── Modal ────────────────────────────────────────────────────────────────

    const _bindModal = (manager) => {
        const modal     = document.getElementById('editModal');
        const saveBtn   = document.getElementById('saveEdit');
        const closeModal = () => UI.closeEditModal();

        document.getElementById('modalClose') ?.addEventListener('click', closeModal);
        document.getElementById('cancelEdit') ?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        saveBtn?.addEventListener('click', () => {
            const id = modal?.dataset.editId;
            if (!id) return;
            const success = manager.updateTask(id, {
                text:     document.getElementById('editTaskInput')?.value || '',
                priority: document.getElementById('editPriority')?.value  || CONSTANTS.PRIORITY.DEFAULT,
                dueDate:  document.getElementById('editDueDate')?.value   || '',
                category: document.getElementById('editCategory')?.value  || '',
            });
            if (success) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (!modal?.classList.contains('open')) return;
            if (e.key === 'Escape')                             closeModal();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveBtn?.click();
        });
    };

    // ─── Theme Toggle ─────────────────────────────────────────────────────────

    const _bindThemeToggle = () => {
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            UI.applyTheme(next);
            Storage.saveTheme(next);
            UI.showToast(`${next === 'dark' ? '🌙 Dark' : '☀️ Light'} mode activated`, 'info', 2000);
        });
    };

    // ─── Backup / Restore ─────────────────────────────────────────────────────

    const _bindBackupRestore = (manager) => {
        const fileInput = document.getElementById('restoreInput');

        document.getElementById('backupBtn')?.addEventListener('click', () => {
            if (manager.tasks.length === 0) { UI.showToast('No tasks to backup.', 'warning'); return; }
            Storage.backup(manager.tasks, Utils.downloadFile);
            UI.showToast(`📦 Backed up ${manager.tasks.length} tasks!`, 'success');
        });

        document.getElementById('restoreBtn')?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader   = new FileReader();
            reader.onload  = (ev) => {
                const { success, tasks, error } = Storage.parseBackup(ev.target.result);
                if (!success) { UI.showToast(`❌ Restore failed: ${error}`, 'error'); return; }

                if (manager.tasks.length > 0) {
                    const existingIds = new Set(manager.tasks.map(t => t.id));
                    const newTasks    = tasks.filter(t => !existingIds.has(t.id));
                    manager.tasks     = [...manager.tasks, ...newTasks];
                    Storage.saveTasks(manager.tasks);
                    manager._refresh();
                    UI.showToast(`✅ Restored ${newTasks.length} new tasks (merged).`, 'success');
                } else {
                    manager.tasks = tasks;
                    Storage.saveTasks(manager.tasks);
                    manager._refresh();
                    UI.showToast(`✅ Restored ${tasks.length} tasks successfully!`, 'success');
                }
            };
            reader.onerror = () => UI.showToast('❌ Failed to read file.', 'error');
            reader.readAsText(file);
            fileInput.value = '';
        });
    };

    // ─── Bulk Actions ─────────────────────────────────────────────────────────

    const _bindBulkActions = (manager) => {
        document.getElementById('bulkComplete')?.addEventListener('click', () => manager.bulkComplete());
        document.getElementById('bulkDelete')  ?.addEventListener('click', () => manager.bulkDelete());
        document.getElementById('bulkCancel')  ?.addEventListener('click', () => {
            manager.selectedIds.clear();
            document.querySelectorAll('.task-select-cb').forEach(cb => cb.checked = false);
            UI.updateBulkActions(0);
        });
    };

    // ─── Sort ─────────────────────────────────────────────────────────────────

    const _bindSort = (manager) => {
        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            manager.currentSort = e.target.value;
            Storage.saveSort(manager.currentSort);
            manager._refresh();
        });
    };

    // ─── Keyboard Shortcuts ───────────────────────────────────────────────────

    const _bindKeyboardShortcuts = (manager) => {
        document.addEventListener('keydown', (e) => {
            const tag       = document.activeElement?.tagName;
            const inInput   = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
            const modalOpen = document.getElementById('editModal')?.classList.contains('open');

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !modalOpen) {
                e.preventDefault(); _handleAddTask(manager); return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !modalOpen) {
                e.preventDefault(); document.getElementById('searchInput')?.focus(); return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault(); document.getElementById('themeToggle')?.click(); return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); document.getElementById('backupBtn')?.click(); return;
            }
            if (e.key === 'Escape' && !modalOpen) {
                const si = document.getElementById('searchInput');
                if (si && document.activeElement === si) {
                    si.value = ''; manager.searchQuery = '';
                    document.getElementById('clearSearch').style.display = 'none';
                    si.blur(); manager._refresh();
                }
                return;
            }
            if (e.key === '/' && !inInput && !modalOpen) {
                e.preventDefault(); document.getElementById('taskInput')?.focus();
            }
        });
    };

    return { bind };
})();


// ═══════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════

let taskManager;

document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();

    // Seed demo data for first-time users (config-driven via CONSTANTS)
    if (taskManager.tasks.length === 0) {
        CONSTANTS.DEMO_TASKS.forEach(d => taskManager.addTask({
            ...d,
            dueDate: d.useTodayAsDate ? Utils.todayStr() : (d.dueDate || ''),
        }));
        UI.showToast('👋 Welcome to TaskFlow! Demo tasks loaded.', 'info', 4000);
    }
});
