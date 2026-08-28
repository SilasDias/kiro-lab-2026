/* ============================================================
   TasKiro — task manager prototype
   State is persisted in localStorage.
   ============================================================ */

const STORAGE_KEY = 'taskiro.state.v1';

const defaultState = {
  tasks: [
    { id: uid(), title: 'Revisar proposta do cliente', desc: 'Ajustar escopo e valores antes do envio.', due: todayISO(), priority: 'high', project: 'work', starred: true, done: false, created: Date.now() - 500000, subtasks: [
      { id: uid(), title: 'Ler briefing', done: true },
      { id: uid(), title: 'Revisar valores', done: true },
      { id: uid(), title: 'Ajustar escopo', done: false },
      { id: uid(), title: 'Enviar para aprovação', done: false },
    ] },
    { id: uid(), title: 'Enviar relatório mensal', desc: 'Consolidar métricas de agosto.', due: addDaysISO(-1), priority: 'medium', project: 'work', starred: false, done: true, created: Date.now() - 900000, subtasks: [] },
    { id: uid(), title: 'Planejar sprint de design', desc: 'Definir prioridades do time de UX.', due: addDaysISO(2), priority: 'medium', project: 'design', starred: false, done: false, created: Date.now() - 300000, subtasks: [
      { id: uid(), title: 'Coletar pendências', done: true },
      { id: uid(), title: 'Priorizar backlog', done: false },
      { id: uid(), title: 'Estimar esforço', done: false },
    ] },
    { id: uid(), title: 'Comprar mantimentos', desc: '', due: todayISO(), priority: 'low', project: 'personal', starred: false, done: false, created: Date.now() - 100000, subtasks: [] },
  ],
  projects: [
    { id: 'work', name: 'Trabalho', color: 'bg-brand-500' },
    { id: 'design', name: 'Design', color: 'bg-emerald-500' },
    { id: 'personal', name: 'Pessoal', color: 'bg-amber-500' },
  ],
  filter: 'all',
  sort: 'created',
  search: '',
  theme: 'light',
};

let state = loadState();

/* ---------- helpers ---------- */
function uid() { return 'id-' + Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return structuredClone(defaultState);
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- modal / overlay control ---------- */
// Uses [hidden] attribute which is forced to display:none !important + pointer-events:none in CSS.
function openLayer(el) {
  el.hidden = false;
  requestAnimationFrame(() => lucide.createIcons());
}
function closeLayer(el) { el.hidden = true; }
function isOpen(el) { return !el.hidden; }

/* ---------- toasts ---------- */
function toast(message, type = 'info') {
  const icons = { info: 'info', success: 'check-circle-2', error: 'alert-circle', warning: 'alert-triangle' };
  const colors = { info: 'bg-slate-800', success: 'bg-emerald-600', error: 'bg-rose-600', warning: 'bg-amber-600' };
  const el = document.createElement('div');
  el.className = `toast-enter pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg ${colors[type] || colors.info}`;
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4"></i><span></span>`;
  el.querySelector('span').textContent = message;
  $('#toastContainer').appendChild(el);
  lucide.createIcons();
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------- rendering ---------- */
const viewMeta = {
  all: { title: 'Todas as tarefas', subtitle: 'Organize seu dia com clareza' },
  today: { title: 'Para hoje', subtitle: 'Foque no que importa agora' },
  upcoming: { title: 'Próximas', subtitle: 'Planeje os próximos dias' },
  starred: { title: 'Favoritas', subtitle: 'Suas tarefas mais importantes' },
  completed: { title: 'Concluídas', subtitle: 'Tudo que você já finalizou' },
};

function priorityMeta(p) {
  return {
    high: { label: 'Alta', cls: 'text-rose-600 bg-rose-100 dark:bg-rose-500/20 dark:text-rose-300', dot: 'bg-rose-500' },
    medium: { label: 'Média', cls: 'text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300', dot: 'bg-amber-500' },
    low: { label: 'Baixa', cls: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300', dot: 'bg-emerald-500' },
  }[p] || {};
}

function projectById(id) { return state.projects.find(p => p.id === id); }

/* ---------- subtasks ---------- */
// Ensure every task has a subtasks array (backward compatible with older saved state).
function ensureSubtasks(t) { if (!Array.isArray(t.subtasks)) t.subtasks = []; return t.subtasks; }
function subtaskProgress(t) {
  const subs = ensureSubtasks(t);
  const total = subs.length;
  const done = subs.filter(s => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

function matchesFilter(t) {
  switch (state.filter) {
    case 'today': return !t.done && t.due === todayISO();
    case 'upcoming': return !t.done && t.due && t.due > todayISO();
    case 'starred': return t.starred;
    case 'completed': return t.done;
    case 'all': return true;
    default:
      // project filter
      return t.project === state.filter;
  }
}

function getVisibleTasks() {
  let list = state.tasks.filter(matchesFilter);
  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q));
  }
  const prioRank = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => {
    if (state.sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999');
    if (state.sort === 'priority') return prioRank[a.priority] - prioRank[b.priority];
    return b.created - a.created;
  });
  return list;
}

function formatDue(due, done) {
  if (!due) return { text: 'Sem prazo', cls: 'text-slate-400' };
  const today = todayISO();
  if (done) return { text: 'Concluída', cls: 'text-emerald-500' };
  if (due < today) return { text: 'Atrasada', cls: 'text-rose-500 font-semibold' };
  if (due === today) return { text: 'Hoje', cls: 'text-amber-500 font-semibold' };
  const d = new Date(due + 'T00:00:00');
  return { text: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), cls: 'text-slate-500 dark:text-slate-400' };
}

function render() {
  // meta title
  const meta = viewMeta[state.filter] || { title: projectById(state.filter)?.name || 'Tarefas', subtitle: 'Tarefas do projeto' };
  $('#viewTitle').textContent = meta.title;
  $('#viewSubtitle').textContent = meta.subtitle;

  // counts
  $('[data-count="all"]').textContent = state.tasks.length;
  $('[data-count="today"]').textContent = state.tasks.filter(t => !t.done && t.due === todayISO()).length;
  $('[data-count="upcoming"]').textContent = state.tasks.filter(t => !t.done && t.due && t.due > todayISO()).length;
  $('[data-count="starred"]').textContent = state.tasks.filter(t => t.starred).length;
  $('[data-count="completed"]').textContent = state.tasks.filter(t => t.done).length;

  // stats
  const open = state.tasks.filter(t => !t.done).length;
  const done = state.tasks.filter(t => t.done).length;
  $('#statOpen').textContent = open;
  $('#statToday').textContent = state.tasks.filter(t => !t.done && t.due === todayISO()).length;
  $('#statDone').textContent = done;
  $('#statProgress').textContent = state.tasks.length ? Math.round((done / state.tasks.length) * 100) + '%' : '0%';

  // active nav highlight
  $$('.nav-item, .project-item').forEach(el => {
    const active = el.dataset.filter === state.filter;
    el.classList.toggle('bg-brand-50', active);
    el.classList.toggle('dark:bg-slate-800', active);
    el.classList.toggle('text-brand-700', active);
    el.classList.toggle('dark:text-brand-300', active);
  });

  // sort highlight
  $$('.sort-btn').forEach(b => {
    const active = b.dataset.sort === state.sort;
    b.classList.toggle('bg-white', active);
    b.classList.toggle('dark:bg-slate-700', active);
    b.classList.toggle('shadow-sm', active);
    b.classList.toggle('text-slate-400', !active);
  });

  // task list
  const list = getVisibleTasks();
  const container = $('#taskList');
  container.innerHTML = '';

  if (list.length === 0) {
    openLayer($('#emptyState'));
  } else {
    closeLayer($('#emptyState'));
    list.forEach(t => container.appendChild(taskCard(t)));
  }
  lucide.createIcons();
}

function taskCard(t) {
  const pm = priorityMeta(t.priority);
  const proj = projectById(t.project);
  const dueInfo = formatDue(t.due, t.done);
  const prog = subtaskProgress(t);

  const card = document.createElement('div');
  card.className = `group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start gap-3 hover:shadow-md transition ${t.done ? 'opacity-70' : ''}`;
  card.draggable = true;
  card.dataset.id = t.id;

  card.innerHTML = `
    <button class="toggle-done mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${t.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-brand-500'}" aria-label="Concluir tarefa">
      ${t.done ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
    </button>
    <div class="flex-1 min-w-0">
      <div class="flex items-start gap-2">
        <h3 class="font-semibold ${t.done ? 'line-through text-slate-400' : ''} break-words">${escapeHtml(t.title)}</h3>
        <span class="ml-auto shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${pm.cls}">${pm.label}</span>
      </div>
      ${t.desc ? `<p class="text-sm text-slate-500 dark:text-slate-400 mt-1 break-words">${escapeHtml(t.desc)}</p>` : ''}
      <div class="flex flex-wrap items-center gap-3 mt-3 text-xs">
        <span class="inline-flex items-center gap-1 ${dueInfo.cls}"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${dueInfo.text}</span>
        ${proj ? `<span class="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><span class="w-2 h-2 rounded-full ${proj.color}"></span>${escapeHtml(proj.name)}</span>` : ''}
        ${prog.total ? `<button class="toggle-subtasks inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-medium" aria-label="Mostrar subtarefas">
          <i data-lucide="list-checks" class="w-3.5 h-3.5"></i> ${prog.done} de ${prog.total}
          <i data-lucide="chevron-down" class="subtasks-chevron w-3.5 h-3.5 transition-transform"></i>
        </button>` : ''}
      </div>
      ${prog.total ? `
        <div class="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div class="h-full rounded-full ${prog.pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'} transition-all" style="width: ${prog.pct}%"></div>
        </div>
        <div class="subtasks-panel mt-3 space-y-1.5" hidden></div>
      ` : ''}
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <button class="toggle-star p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Favoritar">
        <i data-lucide="star" class="w-4 h-4 ${t.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}"></i>
      </button>
      <button class="edit-task p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Editar">
        <i data-lucide="pencil" class="w-4 h-4 text-slate-400"></i>
      </button>
      <button class="delete-task p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Excluir">
        <i data-lucide="trash-2" class="w-4 h-4 text-slate-400 hover:text-rose-500"></i>
      </button>
    </div>
  `;

  // events
  $('.toggle-done', card).addEventListener('click', () => toggleDone(t.id));
  $('.toggle-star', card).addEventListener('click', () => toggleStar(t.id));
  $('.edit-task', card).addEventListener('click', () => openTaskModal(t.id));
  $('.delete-task', card).addEventListener('click', () => askDelete(t.id));

  // inline subtask expand/collapse + toggling
  if (prog.total) {
    const toggleBtn = $('.toggle-subtasks', card);
    const panel = $('.subtasks-panel', card);
    const chevron = $('.subtasks-chevron', card);
    toggleBtn.addEventListener('click', () => {
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      chevron.classList.toggle('rotate-180', willOpen);
      if (willOpen) {
        panel.innerHTML = '';
        ensureSubtasks(t).forEach(s => panel.appendChild(subtaskRow(t, s)));
        lucide.createIcons();
      }
    });
  }

  // drag & drop reorder
  card.addEventListener('dragstart', () => { card.classList.add('dragging'); dragId = t.id; });
  card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragId = null; $$('.drop-target').forEach(e => e.classList.remove('drop-target')); });
  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drop-target'); });
  card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
  card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('drop-target'); reorder(dragId, t.id); });

  return card;
}

let dragId = null;
function reorder(fromId, toId) {
  if (!fromId || fromId === toId) return;
  const from = state.tasks.findIndex(t => t.id === fromId);
  const to = state.tasks.findIndex(t => t.id === toId);
  if (from < 0 || to < 0) return;
  const [moved] = state.tasks.splice(from, 1);
  state.tasks.splice(to, 0, moved);
  saveState(); render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- inline subtask row (on the card) ---------- */
function subtaskRow(task, sub) {
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2 text-sm';
  row.innerHTML = `
    <button class="sub-toggle shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition ${sub.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-brand-500'}" aria-label="Concluir subtarefa">
      ${sub.done ? '<i data-lucide="check" class="w-2.5 h-2.5 text-white"></i>' : ''}
    </button>
    <span class="${sub.done ? 'line-through text-slate-400' : 'text-slate-600 dark:text-slate-300'} break-words">${escapeHtml(sub.title)}</span>
  `;
  $('.sub-toggle', row).addEventListener('click', () => toggleSubtask(task.id, sub.id));
  return row;
}

/* ---------- subtask CRUD (operates on state) ---------- */
function toggleSubtask(taskId, subId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  const s = ensureSubtasks(t).find(x => x.id === subId);
  if (!s) return;
  s.done = !s.done;
  saveState();
  render();
}

/* ---------- projects ---------- */
function renderProjects() {
  const wrap = $('#projectList');
  wrap.innerHTML = '';
  state.projects.forEach(p => {
    const count = state.tasks.filter(t => t.project === p.id).length;
    const btn = document.createElement('button');
    btn.className = 'project-item nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    btn.dataset.filter = p.id;
    btn.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${p.color}"></span><span class="truncate">${escapeHtml(p.name)}</span><span class="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">${count}</span>`;
    btn.addEventListener('click', () => { setFilter(p.id); });
    wrap.appendChild(btn);
  });

  // fill project select in task modal
  const sel = $('#taskProject');
  sel.innerHTML = '';
  state.projects.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.name;
    sel.appendChild(o);
  });
}

/* ---------- CRUD actions ---------- */
function toggleDone(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveState(); render();
  toast(t.done ? 'Tarefa concluída' : 'Tarefa reaberta', t.done ? 'success' : 'info');
}
function toggleStar(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.starred = !t.starred;
  saveState(); render();
  toast(t.starred ? 'Adicionada aos favoritos' : 'Removida dos favoritos', 'info');
}

let pendingDeleteId = null;
function askDelete(id) {
  pendingDeleteId = id;
  openLayer($('#confirmModal'));
}
function confirmDelete() {
  if (!pendingDeleteId) return;
  state.tasks = state.tasks.filter(t => t.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveState(); render();
  closeLayer($('#confirmModal'));
  toast('Tarefa excluída', 'error');
}

/* ---------- task modal ---------- */
// Draft subtasks being edited in the modal (committed to the task only on save).
let draftSubtasks = [];

function openTaskModal(id = null) {
  const form = $('#taskForm');
  form.reset();
  $('#taskId').value = '';
  if (id) {
    const t = state.tasks.find(x => x.id === id);
    if (t) {
      $('#modalTitle').textContent = 'Editar tarefa';
      $('#taskId').value = t.id;
      $('#taskTitle').value = t.title;
      $('#taskDesc').value = t.desc || '';
      $('#taskDue').value = t.due || '';
      $('#taskPriority').value = t.priority;
      $('#taskProject').value = t.project;
      // clone so edits are only applied on save
      draftSubtasks = ensureSubtasks(t).map(s => ({ ...s }));
    }
  } else {
    $('#modalTitle').textContent = 'Nova tarefa';
    $('#taskProject').value = (state.filter !== 'all' && projectById(state.filter)) ? state.filter : state.projects[0]?.id;
    draftSubtasks = [];
  }
  $('#subtaskInput').value = '';
  renderDraftSubtasks();
  openLayer($('#taskModal'));
  setTimeout(() => $('#taskTitle').focus(), 50);
}

/* ---------- modal subtask editor ---------- */
function renderDraftSubtasks() {
  const wrap = $('#subtaskList');
  wrap.innerHTML = '';
  const total = draftSubtasks.length;
  const done = draftSubtasks.filter(s => s.done).length;

  $('#subtaskEmpty').hidden = total > 0;
  $('#subtaskProgressLabel').textContent = total ? `${done} de ${total} concluídas` : '';

  draftSubtasks.forEach(s => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800';
    row.innerHTML = `
      <button type="button" class="draft-toggle shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition ${s.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-brand-500'}" aria-label="Concluir subtarefa">
        ${s.done ? '<i data-lucide="check" class="w-2.5 h-2.5 text-white"></i>' : ''}
      </button>
      <span class="flex-1 text-sm ${s.done ? 'line-through text-slate-400' : ''} break-words">${escapeHtml(s.title)}</span>
      <button type="button" class="draft-remove shrink-0 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Remover subtarefa">
        <i data-lucide="x" class="w-4 h-4 text-slate-400 hover:text-rose-500"></i>
      </button>
    `;
    $('.draft-toggle', row).addEventListener('click', () => {
      s.done = !s.done;
      renderDraftSubtasks();
    });
    $('.draft-remove', row).addEventListener('click', () => {
      draftSubtasks = draftSubtasks.filter(x => x.id !== s.id);
      renderDraftSubtasks();
    });
    wrap.appendChild(row);
  });
  lucide.createIcons();
}

function addDraftSubtask() {
  const input = $('#subtaskInput');
  const title = input.value.trim();
  if (!title) { toast('Informe o título da subtarefa', 'warning'); return; }
  draftSubtasks.push({ id: uid(), title, done: false });
  input.value = '';
  input.focus();
  renderDraftSubtasks();
}

function submitTask(e) {
  e.preventDefault();
  const id = $('#taskId').value;
  const data = {
    title: $('#taskTitle').value.trim(),
    desc: $('#taskDesc').value.trim(),
    due: $('#taskDue').value,
    priority: $('#taskPriority').value,
    project: $('#taskProject').value,
    subtasks: draftSubtasks.map(s => ({ ...s })),
  };
  if (!data.title) { toast('Informe um título', 'warning'); return; }

  if (id) {
    const t = state.tasks.find(x => x.id === id);
    Object.assign(t, data);
    toast('Tarefa atualizada', 'success');
  } else {
    state.tasks.unshift({ id: uid(), ...data, starred: false, done: false, created: Date.now() });
    toast('Tarefa criada', 'success');
  }
  saveState();
  closeLayer($('#taskModal'));
  render();
}

/* ---------- project modal ---------- */
let selectedColor = 'bg-brand-500';
function openProjectModal() {
  $('#projectForm').reset();
  selectedColor = 'bg-brand-500';
  highlightColor();
  openLayer($('#projectModal'));
  setTimeout(() => $('#projectName').focus(), 50);
}
function highlightColor() {
  $$('.color-swatch').forEach(s => {
    s.classList.toggle('ring-brand-400', s.dataset.color === selectedColor);
    s.classList.toggle('ring-transparent', s.dataset.color !== selectedColor);
  });
}
function submitProject(e) {
  e.preventDefault();
  const name = $('#projectName').value.trim();
  if (!name) { toast('Informe um nome', 'warning'); return; }
  const id = 'proj-' + uid();
  state.projects.push({ id, name, color: selectedColor });
  saveState();
  renderProjects();
  closeLayer($('#projectModal'));
  toast('Projeto criado', 'success');
}

/* ---------- filter / sort / search ---------- */
function setFilter(f) {
  state.filter = f;
  saveState();
  render();
  closeSidebar();
}
function setSort(s) { state.sort = s; saveState(); render(); }

/* ---------- theme ---------- */
function applyTheme() {
  document.documentElement.classList.toggle('dark', state.theme === 'dark');
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
  lucide.createIcons();
}

/* ---------- sidebar (mobile) ---------- */
function openSidebar() { $('#sidebar').classList.remove('-translate-x-full'); openLayer($('#sidebarBackdrop')); }
function closeSidebar() { if (window.innerWidth < 1024) { $('#sidebar').classList.add('-translate-x-full'); closeLayer($('#sidebarBackdrop')); } }

/* ---------- dropdown (notifications) ---------- */
function toggleNotif() { const m = $('#notifMenu'); isOpen(m) ? closeLayer(m) : openLayer(m); }

/* ============================================================
   Wiring — all interactive elements get real behaviour.
   ============================================================ */
function init() {
  applyTheme();
  renderProjects();
  render();
  lucide.createIcons();

  // Sidebar filters
  $$('#filterNav .nav-item[data-filter]').forEach(btn => {
    if (!btn.classList.contains('project-item')) {
      btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    }
  });

  // New task buttons
  $('#newTaskBtnTop').addEventListener('click', () => openTaskModal());
  $('#newTaskBtnEmpty').addEventListener('click', () => openTaskModal());
  $('#fab').addEventListener('click', () => openTaskModal());

  // Add project
  $('#addProjectBtn').addEventListener('click', openProjectModal);

  // Forms
  $('#taskForm').addEventListener('submit', submitTask);
  $('#projectForm').addEventListener('submit', submitProject);

  // Subtasks (inside task modal)
  $('#subtaskAddBtn').addEventListener('click', addDraftSubtask);
  $('#subtaskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addDraftSubtask(); }
  });

  // Color picker
  $$('.color-swatch').forEach(s => s.addEventListener('click', () => { selectedColor = s.dataset.color; highlightColor(); }));

  // Sort
  $$('.sort-btn').forEach(b => b.addEventListener('click', () => setSort(b.dataset.sort)));

  // Search
  $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; render(); });

  // Theme
  $('#themeToggle').addEventListener('click', toggleTheme);

  // Notifications dropdown
  $('#notifBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleNotif(); });
  $('#clearNotif').addEventListener('click', () => { closeLayer($('#notifMenu')); toast('Notificações marcadas como lidas', 'success'); });

  // Sidebar toggle (mobile)
  $('#sidebarOpen').addEventListener('click', openSidebar);
  $('#sidebarClose').addEventListener('click', closeSidebar);
  $('#sidebarBackdrop').addEventListener('click', closeSidebar);

  // Confirm modal
  $('#confirmOk').addEventListener('click', confirmDelete);
  $('#confirmCancel').addEventListener('click', () => { pendingDeleteId = null; closeLayer($('#confirmModal')); });

  // Close-modal buttons + backdrop clicks
  $$('[data-close-modal]').forEach(b => b.addEventListener('click', () => {
    closeLayer($('#taskModal')); closeLayer($('#projectModal'));
  }));
  $$('.modal-backdrop').forEach(bd => bd.addEventListener('click', () => {
    closeLayer($('#taskModal')); closeLayer($('#projectModal')); closeLayer($('#confirmModal'));
    pendingDeleteId = null;
  }));

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const notif = $('#notifMenu');
    if (!isOpen(notif)) return;
    if (!notif.contains(e.target) && !$('#notifBtn').contains(e.target)) closeLayer(notif);
  });

  // Escape closes any open layer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['#taskModal', '#projectModal', '#confirmModal', '#notifMenu'].forEach(sel => closeLayer($(sel)));
      pendingDeleteId = null;
      closeSidebar();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
