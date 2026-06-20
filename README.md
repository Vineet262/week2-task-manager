# TaskFlow — Interactive Task Manager

A sleek, feature-rich task management application built with vanilla HTML, CSS, and JavaScript.

---

## 🌟 Features

| Feature | Details |
|---|---|
| ✅ Add / Edit / Delete tasks | Full CRUD with smooth animations |
| 🏷️ Priority levels | High 🔴, Medium 🟡, Low 🟢 |
| 📅 Due dates | Overdue detection with visual warnings |
| 🗂️ Categories | Tag tasks with custom categories |
| 🔍 Live search | Real-time filtering with text highlighting |
| 📊 Statistics | Total, active, completed, and % completion |
| 🔀 Drag & Drop | Reorder tasks by dragging |
| ☑️ Bulk actions | Select multiple → complete or delete |
| 💾 Backup / Restore | Export and import JSON backups |
| 🌙 Dark / Light mode | OS preference detected + manual toggle |
| ⌨️ Keyboard shortcuts | Power-user shortcuts for all actions |
| 📱 Responsive | Works on mobile, tablet, and desktop |
| ♿ Accessible | ARIA roles, labels, live regions |

---

## 📁 Project Structure

```
week2-task-manager/
├── index.html          # Main HTML structure & semantic markup
├── css/
│   ├── style.css       # Layout, components, animations
│   └── theme.css       # Dark/Light theme CSS variables
├── js/
│   ├── utils.js        # Pure utility functions (no DOM)
│   ├── storage.js      # localStorage persistence layer
│   ├── ui.js           # DOM rendering & UI components
│   └── app.js          # Main TaskManager class & event handling
└── README.md
```

---

## 🚀 Getting Started

### Option 1 — Open directly
Just open `index.html` in any modern browser. No build step required!

### Option 2 — Local server (recommended)
```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .

# Then visit: http://localhost:8080
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl` + `Enter` | Add task (from anywhere on page) |
| `Ctrl` + `F` | Focus search box |
| `Ctrl` + `D` | Toggle dark/light mode |
| `Ctrl` + `S` | Backup tasks to JSON file |
| `Esc` | Clear search / cancel edit |
| `/` | Focus task input field |
| `Space` | Toggle complete (on focused task) |
| `E` | Edit focused task |
| `Delete` | Delete focused task |

---

## 🛠️ Technical Implementation

### Architecture

The app uses a clean **module pattern** with four layers:

```
┌─────────────────────────────────────┐
│           app.js (Controller)        │
│  TaskManager class — orchestrates   │
│  all state & event handling         │
├─────────────┬───────────────────────┤
│  ui.js      │  storage.js           │
│  DOM render │  localStorage I/O     │
├─────────────┴───────────────────────┤
│           utils.js                  │
│  Pure helpers — no side effects     │
└─────────────────────────────────────┘
```

### Key Concepts Demonstrated

| Concept | Where Used |
|---|---|
| **DOM Manipulation** | `ui.js` — `renderTasks()`, `renderTaskItem()` |
| **Event Handling** | `app.js` — event delegation on task list |
| **Array Methods** | `.filter()`, `.map()`, `.find()`, `.sort()`, `.reduce()` |
| **localStorage** | `storage.js` — `saveTasks()`, `loadTasks()` |
| **Form Validation** | `utils.js` — `validateTask()` |
| **Classes & OOP** | `app.js` — `TaskManager` class |
| **Drag & Drop API** | `app.js` — `_setupDragAndDrop()` |
| **Debouncing** | `utils.js` — `debounce()` for search |
| **CSS Custom Props** | `theme.css` — full dark/light variable system |
| **Animations** | `style.css` — keyframes, transitions |
| **ARIA Accessibility** | `index.html` — roles, labels, live regions |

### Data Model

```javascript
task = {
  id:        "lx9k2abc1",      // Unique ID (base36 timestamp + random)
  text:      "Task description",
  completed: false,
  priority:  "medium",         // "low" | "medium" | "high"
  dueDate:   "2025-12-31",     // YYYY-MM-DD or ""
  category:  "Work",           // Free-text tag
  createdAt: "2025-01-01T...", // ISO 8601
  updatedAt: "2025-01-02T...", // ISO 8601
  order:     0                 // Position for drag-and-drop
}
```

---

## 💾 Data Persistence

- Tasks are auto-saved to `localStorage` on every change
- Filter and sort preferences are also persisted
- Theme preference is saved and OS dark mode is detected on first visit
- Backup creates a timestamped `.json` file for download
- Restore supports merging backups into existing tasks

---

## 🎨 Design System

- **Font**: Inter (Google Fonts)
- **Color**: Indigo/Purple gradient palette (`#6366f1` → `#8b5cf6`)
- **Dark bg**: `#0d0f17` base, `#161826` surface
- **Light bg**: `#f8faff` base, `#ffffff` surface
- **Glassmorphism**: backdrop-filter blur on header and modals
- **Animations**: cubic-bezier easing on all transitions

---

## 📋 Browser Compatibility

| Browser | Support |
|---|---|
| Chrome / Edge 88+ | ✅ Full |
| Firefox 80+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Opera 75+ | ✅ Full |
| IE 11 | ❌ Not supported |

---

## 📝 License

MIT — Free to use, modify and distribute.
