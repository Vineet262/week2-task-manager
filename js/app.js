/**
 * app.js — TaskFlow Main Application Controller
 * Orchestrates the TaskManager class, event listeners,
 * drag-and-drop, keyboard shortcuts, and all interactions.
 */

'use strict';

class TaskManager {
    constructor() {
        this.tasks         = Storage.loadTasks();
        this.currentFilter = Storage.loadFilter();
        this.currentSort   = Storage.loadSort();
        this.searchQuery   = '';
        this.selectedIds   = new Set();
        this._dragSrcId    = null;

        this._init();
    }

    // ═══════════════════════════════════════════════════════
    //  INITIALIZATION
    // ═══════════════════════════════════════════════════════

    _init() {
        // Apply saved theme
        const theme = Storage.loadTheme();
        UI.applyTheme(theme);

        // Restore filter tab state
        this._setActiveFilter(this.currentFilter);

        // Restore sort select state
        const sortEl = document.getElementById('sortSelect');
        if (sortEl) sortEl.value = this.currentSort;

        // Initial render
        this._refresh();

        // Event listeners
        this._setupFormListeners();
        this._setupFilterListeners();
        this._setupSearchListeners();
        this._setupTaskListListeners();
        this._setupModalListeners();
        this._setupThemeToggle();
        this._setupBackupRestore();
        this._setupBulkActions();
        this._setupKeyboardShortcuts();
        this._setupSortListener();

        console.log(`[TaskFlow] Initialized with ${this.tasks.length} tasks.`);
    }

    // ═══════════════════════════════════════════════════════
    //  CORE TASK OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Add a new task
     * @param {Object} opts
     */
    addTask({ text, priority = 'medium', dueDate = '', category = '' }) {
        const { valid, error } = Utils.validateTask(text);
        if (!valid) {
            UI.showError(error);
            return false;
        }

        const task = {
            id:        Utils.generateId(),
            text:      text.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            priority,
            dueDate,
            category:  category.trim(),
            order:     this.tasks.length
        };

        this.tasks.unshift(task); // Add to beginning (newest first)
        this._save();
        this._refresh();
        UI.showToast('Task added successfully! ✨', 'success');
        return true;
    }

    /**
     * Delete a task by ID (with animation)
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
     * Toggle task completed state
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
     * Update an existing task
     * @param {string} id
     * @param {Object} updates
     */
    updateTask(id, updates) {
        const { valid, error } = Utils.validateTask(updates.text);
        if (!valid) {
            UI.showError(error);
            return false;
        }

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
     * Clear all completed tasks
     */
    clearCompleted() {
        const count = this.tasks.filter(t => t.completed).length;
        if (count === 0) {
            UI.showToast('No completed tasks to clear.', 'info');
            return;
        }
        this.tasks = this.tasks.filter(t => !t.completed);
        this.selectedIds.clear();
        this._save();
        this._refresh();
        UI.showToast(`🗑️ Cleared ${count} completed task${count !== 1 ? 's' : ''}.`, 'info');
    }

    // ═══════════════════════════════════════════════════════
    //  FILTERING, SORTING, SEARCHING
    // ═══════════════════════════════════════════════════════

    /**
     * Get tasks after applying filter, search, and sort
     * @returns {Array}
     */
    _getDisplayTasks() {
        let tasks = [...this.tasks];

        // Filter
        switch (this.currentFilter) {
            case 'active':
                tasks = tasks.filter(t => !t.completed);
                break;
            case 'completed':
                tasks = tasks.filter(t => t.completed);
                break;
            case 'high':
                tasks = tasks.filter(t => t.priority === 'high');
                break;
            default:
                break;
        }

        // Search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            tasks = tasks.filter(t =>
                t.text.toLowerCase().includes(q) ||
                (t.category && t.category.toLowerCase().includes(q))
            );
        }

        // Sort
        tasks = Utils.sortTasks(tasks, this.currentSort);

        return tasks;
    }

    // ═══════════════════════════════════════════════════════
    //  BULK OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Bulk mark selected tasks as complete
     */
    bulkComplete() {
        if (this.selectedIds.size === 0) return;
        this.tasks = this.tasks.map(t =>
            this.selectedIds.has(t.id) ? { ...t, completed: true, updatedAt: new Date().toISOString() } : t
        );
        const count = this.selectedIds.size;
        this.selectedIds.clear();
        this._save();
        this._refresh();
        UI.showToast(`✅ ${count} task${count !== 1 ? 's' : ''} marked complete.`, 'success');
    }

    /**
     * Bulk delete selected tasks
     */
    bulkDelete() {
        if (this.selectedIds.size === 0) return;
        const count = this.selectedIds.size;
        this.tasks = this.tasks.filter(t => !this.selectedIds.has(t.id));
        this.selectedIds.clear();
        this._save();
        this._refresh();
        UI.showToast(`🗑️ Deleted ${count} task${count !== 1 ? 's' : ''}.`, 'info');
    }

    /**
     * Select/deselect all visible tasks
     */
    toggleSelectAll() {
        const visible = this._getDisplayTasks();
        const allSelected = visible.every(t => this.selectedIds.has(t.id));

        if (allSelected) {
            visible.forEach(t => this.selectedIds.delete(t.id));
        } else {
            visible.forEach(t => this.selectedIds.add(t.id));
        }

        // Update checkboxes
        document.querySelectorAll('.task-select-cb').forEach(cb => {
            const id = cb.closest('.task-item')?.dataset.id;
            if (id) cb.checked = this.selectedIds.has(id);
        });

        UI.updateBulkActions(this.selectedIds.size);
    }

    // ═══════════════════════════════════════════════════════
    //  DRAG AND DROP
    // ═══════════════════════════════════════════════════════

    _setupDragAndDrop() {
        const list = document.getElementById('taskList');
        if (!list) return;

        list.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.task-item');
            if (!item) return;
            this._dragSrcId = item.dataset.id;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.id);
        });

        list.addEventListener('dragend', (e) => {
            const item = e.target.closest('.task-item');
            if (item) item.classList.remove('dragging');
            document.querySelectorAll('.task-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            this._dragSrcId = null;
        });

        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const item = e.target.closest('.task-item');
            if (!item || item.dataset.id === this._dragSrcId) return;
            document.querySelectorAll('.task-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            item.classList.add('drag-over');
            e.dataTransfer.dropEffect = 'move';
        });

        list.addEventListener('dragleave', (e) => {
            const item = e.target.closest('.task-item');
            if (item) item.classList.remove('drag-over');
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.task-item');
            if (!targetItem || !this._dragSrcId || targetItem.dataset.id === this._dragSrcId) return;

            targetItem.classList.remove('drag-over');

            const srcIdx    = this.tasks.findIndex(t => t.id === this._dragSrcId);
            const targetIdx = this.tasks.findIndex(t => t.id === targetItem.dataset.id);

            if (srcIdx === -1 || targetIdx === -1) return;

            // Reorder tasks array
            const [moved] = this.tasks.splice(srcIdx, 1);
            this.tasks.splice(targetIdx, 0, moved);

            // Update order field
            this.tasks.forEach((t, i) => { t.order = i; });

            this._save();
            this._refresh();
        });
    }

    // ═══════════════════════════════════════════════════════
    //  EVENT LISTENERS SETUP
    // ═══════════════════════════════════════════════════════

    _setupFormListeners() {
        const form      = document.getElementById('taskForm');
        const input     = document.getElementById('taskInput');
        const charCount = document.getElementById('charCount');

        // Character counter
        if (input && charCount) {
            input.addEventListener('input', () => {
                const len = input.value.length;
                charCount.textContent = `${len}/200`;
                charCount.style.color = len > 180
                    ? '#f87171'
                    : len > 150 ? '#fbbf24' : '';
                UI.showError(''); // Clear error on type
            });
        }

        // Form submit
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this._handleAddTask();
            });
        }
    }

    _handleAddTask() {
        const input    = document.getElementById('taskInput');
        const priority = document.getElementById('prioritySelect');
        const dueDate  = document.getElementById('dueDateInput');
        const category = document.getElementById('categoryInput');

        const success = this.addTask({
            text:     input?.value || '',
            priority: priority?.value || 'medium',
            dueDate:  dueDate?.value || '',
            category: category?.value || ''
        });

        if (success) {
            // Reset form
            if (input)    { input.value = ''; document.getElementById('charCount').textContent = '0/200'; }
            if (dueDate)  dueDate.value = '';
            if (category) category.value = '';
            if (priority) priority.value = 'medium';
            input?.focus();
        }
    }

    _setupFilterListeners() {
        document.querySelectorAll('.filter-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.currentFilter = filter;
                Storage.saveFilter(filter);
                this._setActiveFilter(filter);
                this.selectedIds.clear();
                UI.updateBulkActions(0);
                this._refresh();
            });
        });

        // Clear completed
        const clearBtn = document.getElementById('clearCompletedBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCompleted());
        }

        // Select all
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        }
    }

    _setupSearchListeners() {
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');

        if (!searchInput) return;

        const debouncedSearch = Utils.debounce((val) => {
            this.searchQuery = val;
            this._refresh();
        }, 250);

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            debouncedSearch(val);
            if (clearSearch) clearSearch.style.display = val ? 'flex' : 'none';
        });

        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                clearSearch.style.display = 'none';
                searchInput.focus();
                this._refresh();
            });
        }
    }

    _setupTaskListListeners() {
        const list = document.getElementById('taskList');
        if (!list) return;

        // Event delegation for all task interactions
        list.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            const id = taskItem.dataset.id;

            // Checkbox (complete toggle)
            if (e.target.classList.contains('task-checkbox')) {
                this.toggleComplete(id);
                return;
            }

            // Select checkbox (bulk)
            if (e.target.classList.contains('task-select-cb')) {
                if (e.target.checked) {
                    this.selectedIds.add(id);
                } else {
                    this.selectedIds.delete(id);
                }
                UI.updateBulkActions(this.selectedIds.size);
                return;
            }

            // Edit button
            if (e.target.closest('.edit-btn')) {
                const task = this.tasks.find(t => t.id === id);
                if (task) UI.openEditModal(task);
                return;
            }

            // Delete button
            if (e.target.closest('.delete-btn')) {
                this.deleteTask(id);
                return;
            }
        });

        // Keyboard accessibility on task items
        list.addEventListener('keydown', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            const id = taskItem.dataset.id;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (document.activeElement === taskItem) {
                    e.preventDefault();
                    this.deleteTask(id);
                }
            }
            if (e.key === 'e' || e.key === 'E') {
                if (document.activeElement === taskItem) {
                    const task = this.tasks.find(t => t.id === id);
                    if (task) UI.openEditModal(task);
                }
            }
            if (e.key === ' ') {
                if (document.activeElement === taskItem) {
                    e.preventDefault();
                    this.toggleComplete(id);
                }
            }
        });

        // Setup drag and drop
        this._setupDragAndDrop();
    }

    _setupModalListeners() {
        const modal     = document.getElementById('editModal');
        const closeBtn  = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelEdit');
        const saveBtn   = document.getElementById('saveEdit');

        const closeModal = () => UI.closeEditModal();

        if (closeBtn)  closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Close on overlay click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        // Save edits
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const id = document.getElementById('editModal')?.dataset.editId;
                if (!id) return;

                const success = this.updateTask(id, {
                    text:     document.getElementById('editTaskInput')?.value || '',
                    priority: document.getElementById('editPriority')?.value  || 'medium',
                    dueDate:  document.getElementById('editDueDate')?.value   || '',
                    category: document.getElementById('editCategory')?.value  || ''
                });

                if (success) closeModal();
            });
        }

        // Keyboard shortcuts in modal
        document.addEventListener('keydown', (e) => {
            if (!modal?.classList.contains('open')) return;
            if (e.key === 'Escape') closeModal();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                saveBtn?.click();
            }
        });
    }

    _setupThemeToggle() {
        const btn = document.getElementById('themeToggle');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next    = current === 'dark' ? 'light' : 'dark';
            UI.applyTheme(next);
            Storage.saveTheme(next);
            UI.showToast(`${next === 'dark' ? '🌙 Dark' : '☀️ Light'} mode activated`, 'info', 2000);
        });
    }

    _setupBackupRestore() {
        const backupBtn  = document.getElementById('backupBtn');
        const restoreBtn = document.getElementById('restoreBtn');
        const fileInput  = document.getElementById('restoreInput');

        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                if (this.tasks.length === 0) {
                    UI.showToast('No tasks to backup.', 'warning');
                    return;
                }
                Storage.backup(this.tasks);
                UI.showToast(`📦 Backed up ${this.tasks.length} tasks!`, 'success');
            });
        }

        if (restoreBtn && fileInput) {
            restoreBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    const { success, tasks, error } = Storage.parseBackup(ev.target.result);
                    if (!success) {
                        UI.showToast(`❌ Restore failed: ${error}`, 'error');
                        return;
                    }

                    // Merge or replace?
                    const existing = this.tasks.length;
                    if (existing > 0) {
                        // Merge: add only tasks not already present
                        const existingIds = new Set(this.tasks.map(t => t.id));
                        const newTasks = tasks.filter(t => !existingIds.has(t.id));
                        this.tasks = [...this.tasks, ...newTasks];
                        Storage.saveTasks(this.tasks);
                        this._refresh();
                        UI.showToast(`✅ Restored ${newTasks.length} new tasks (merged).`, 'success');
                    } else {
                        this.tasks = tasks;
                        Storage.saveTasks(this.tasks);
                        this._refresh();
                        UI.showToast(`✅ Restored ${tasks.length} tasks successfully!`, 'success');
                    }
                };
                reader.onerror = () => UI.showToast('❌ Failed to read file.', 'error');
                reader.readAsText(file);

                // Reset file input
                fileInput.value = '';
            });
        }
    }

    _setupBulkActions() {
        const completeBtn = document.getElementById('bulkComplete');
        const deleteBtn   = document.getElementById('bulkDelete');
        const cancelBtn   = document.getElementById('bulkCancel');

        if (completeBtn) completeBtn.addEventListener('click', () => this.bulkComplete());
        if (deleteBtn)   deleteBtn.addEventListener('click',   () => this.bulkDelete());
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.selectedIds.clear();
                document.querySelectorAll('.task-select-cb').forEach(cb => cb.checked = false);
                UI.updateBulkActions(0);
            });
        }
    }

    _setupSortListener() {
        const select = document.getElementById('sortSelect');
        if (!select) return;
        select.addEventListener('change', () => {
            this.currentSort = select.value;
            Storage.saveSort(this.currentSort);
            this._refresh();
        });
    }

    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement?.tagName;
            const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
            const modalOpen = document.getElementById('editModal')?.classList.contains('open');

            // Ctrl+Enter — Add task (even from input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !modalOpen) {
                e.preventDefault();
                this._handleAddTask();
                return;
            }

            // Ctrl+F — Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !modalOpen) {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
                return;
            }

            // Ctrl+D — Toggle theme
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                document.getElementById('themeToggle')?.click();
                return;
            }

            // Ctrl+S — Backup
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                document.getElementById('backupBtn')?.click();
                return;
            }

            // Escape — Clear search or blur
            if (e.key === 'Escape' && !modalOpen) {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.value = '';
                    this.searchQuery = '';
                    document.getElementById('clearSearch').style.display = 'none';
                    searchInput.blur();
                    this._refresh();
                }
                return;
            }

            // "/" — Focus task input (when not in a field)
            if (e.key === '/' && !inInput && !modalOpen) {
                e.preventDefault();
                document.getElementById('taskInput')?.focus();
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════

    _setActiveFilter(filter) {
        document.querySelectorAll('.filter-tab').forEach(btn => {
            const isActive = btn.dataset.filter === filter;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    _save() {
        Storage.saveTasks(this.tasks);
    }

    _refresh() {
        const displayTasks = this._getDisplayTasks();
        UI.renderTasks(displayTasks, this.searchQuery);
        UI.updateStats(this.tasks);
        UI.updateListTitle(this.currentFilter, displayTasks.length);

        // Re-attach drag & drop after re-render
        this._setupDragAndDrop();

        // Sync selection state after re-render
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
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════

let taskManager;

document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();

    // Seed demo data for first-time users
    if (taskManager.tasks.length === 0) {
        const demos = [
            { text: 'Welcome to TaskFlow! Click the checkbox to complete a task ✅', priority: 'high',   category: 'Guide'  },
            { text: 'Edit this task by clicking the pencil icon ✏️',                priority: 'medium', category: 'Guide'  },
            { text: 'Use drag and drop to reorder tasks 🖱️',                        priority: 'medium', category: 'Guide'  },
            { text: 'Try the dark/light mode toggle in the top-right corner 🌙',    priority: 'low',    category: 'Guide'  },
            { text: 'Filter tasks using the tabs: All, Active, Completed 📋',       priority: 'low',    category: 'Guide'  },
            { text: 'Use Ctrl+Enter to quickly add a task from anywhere ⌨️',        priority: 'low',    category: 'Tips'   },
            { text: 'Backup your tasks with the download button 💾',               priority: 'medium', category: 'Tips', dueDate: Utils.todayStr() }
        ];

        demos.forEach(d => taskManager.addTask(d));
        UI.showToast('👋 Welcome to TaskFlow! Demo tasks loaded.', 'info', 4000);
    }
});
