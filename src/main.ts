import './style.css';
import { downloadText, el, render } from './dom.ts';
import { toCsv } from './csv.ts';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  createTransaction,
  inMonth,
  monthOf,
  removeTransaction,
  restoreTransaction,
  shiftMonth,
  sortNewestFirst,
  summarize,
  today,
  validate,
  type Kind,
  type Removal,
  type Transaction,
} from './ledger.ts';
import { formatCents, parseAmount } from './money.ts';
import { load, loadPrefs, newId, save, savePrefs } from './storage.ts';

// ---- State ---------------------------------------------------------------------------------

const loaded = load(window.localStorage);
let transactions: Transaction[] = loaded.transactions;
let month = monthOf(today());
let kind: Kind = 'expense';
const prefs = loadPrefs(window.localStorage);
let notice: string | null =
  loaded.skipped > 0
    ? `${loaded.skipped} saved ${loaded.skipped === 1 ? 'entry was' : 'entries were'} damaged and could not be loaded.`
    : null;

const money = (cents: number) => formatCents(cents);
const monthName = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
const dayName = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function persist(): void {
  if (!save(window.localStorage, transactions)) {
    notice = "Your browser didn't let PocketLedger save. Changes will be lost when you close this tab.";
  }
}

// ---- Layout --------------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');

const noticeBox = el('div', { class: 'notice', role: 'status' });
const monthLabel = el('h2', { class: 'month-label', 'aria-live': 'polite' });
const summaryBox = el('section', { class: 'summary', 'aria-label': 'Month summary' });
const categoriesBox = el('section', { class: 'card categories', 'aria-label': 'Spending by category' });
const listBox = el('section', { class: 'card entries', 'aria-label': 'Entries this month' });
const toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
toast.hidden = true;

const prevButton = el('button', { type: 'button', class: 'icon', 'aria-label': 'Previous month' }, '‹');
const nextButton = el('button', { type: 'button', class: 'icon', 'aria-label': 'Next month' }, '›');
const exportButton = el('button', { type: 'button', class: 'ghost' }, 'Export CSV');
prevButton.addEventListener('click', () => {
  month = shiftMonth(month, -1);
  update();
});
nextButton.addEventListener('click', () => {
  month = shiftMonth(month, 1);
  update();
});
exportButton.addEventListener('click', () => {
  downloadText(`pocketledger-${today()}.csv`, toCsv(transactions), 'text/csv');
});

// ---- Add form ------------------------------------------------------------------------------

const expenseTab = el('button', { type: 'button', class: 'tab' }, 'Expense');
const incomeTab = el('button', { type: 'button', class: 'tab' }, 'Income');
const amountInput = el('input', {
  id: 'amount', name: 'amount', inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00', required: true,
});
const categorySelect = el('select', { id: 'category', name: 'category' });
const dateInput = el('input', { id: 'date', name: 'date', type: 'date', required: true, value: today() });
const noteInput = el('input', { id: 'note', name: 'note', maxlength: 200, placeholder: 'Optional', autocomplete: 'off' });
const formError = el('p', { class: 'form-error', role: 'alert' });
const addButton = el('button', { type: 'submit', class: 'primary' }, 'Add');

function field(label: string, id: string, input: HTMLElement): HTMLElement {
  return el('label', { class: 'field', for: id }, el('span', {}, label), input);
}

const form = el(
  'form',
  { class: 'card add-form', 'aria-label': 'Add an entry', novalidate: true },
  el('div', { class: 'tabs', role: 'group', 'aria-label': 'Entry type' }, expenseTab, incomeTab),
  el('div', { class: 'fields' },
    field('Amount', 'amount', amountInput),
    field('Category', 'category', categorySelect),
    field('Date', 'date', dateInput),
    field('Note', 'note', noteInput),
  ),
  formError,
  addButton,
);

function setKind(next: Kind): void {
  kind = next;
  expenseTab.setAttribute('aria-pressed', String(kind === 'expense'));
  incomeTab.setAttribute('aria-pressed', String(kind === 'income'));
  form.dataset['kind'] = kind;
  const options = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  render(categorySelect, ...options.map((c) => el('option', { value: c }, c)));
  const remembered = prefs.lastCategory[kind];
  if (remembered !== undefined && (options as readonly string[]).includes(remembered)) {
    categorySelect.value = remembered;
  }
  addButton.textContent = kind === 'expense' ? 'Add expense' : 'Add income';
}

expenseTab.addEventListener('click', () => setKind('expense'));
incomeTab.addEventListener('click', () => setKind('income'));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const amount = parseAmount(amountInput.value);
  if (amount === null) {
    formError.textContent = 'Enter an amount like 12.50.';
    amountInput.focus();
    return;
  }
  const entry = { kind, amount, category: categorySelect.value, date: dateInput.value, note: noteInput.value };
  const problems = validate(entry);
  if (problems.length > 0) {
    formError.textContent = problems.join(' ');
    return;
  }
  transactions = [...transactions, createTransaction(entry, newId())];
  persist();
  prefs.lastCategory[kind] = entry.category;
  savePrefs(window.localStorage, prefs);
  formError.textContent = '';
  amountInput.value = '';
  noteInput.value = '';
  month = monthOf(entry.date); // show the month you just added to
  update();
  amountInput.focus();
});

// ---- Undo --------------------------------------------------------------------------------

const UNDO_SECONDS = 6;
let toastTimer: number | undefined;

function hideToast(): void {
  window.clearTimeout(toastTimer);
  toast.hidden = true;
  render(toast);
}

/** Shows "Deleted … Undo" for a few seconds; Undo puts the entry back where it was. */
function showUndo(removal: Removal): void {
  window.clearTimeout(toastTimer);
  const t = removal.transaction;
  const undo = el('button', { type: 'button', class: 'toast-action' }, 'Undo');
  undo.addEventListener('click', () => {
    transactions = restoreTransaction(transactions, removal);
    persist();
    month = monthOf(t.date);
    hideToast();
    update();
  });
  render(toast, el('span', {}, `Deleted ${t.category} ${money(t.amount)}`), undo);
  toast.hidden = false;
  toastTimer = window.setTimeout(hideToast, UNDO_SECONDS * 1000);
}

// ---- Rendering -----------------------------------------------------------------------------

function renderSummary(): void {
  const s = summarize(transactions, month);
  const stat = (label: string, value: number, cls: string) =>
    el('div', { class: `card stat ${cls}` }, el('span', { class: 'stat-label' }, label), el('strong', {}, money(value)));
  render(
    summaryBox,
    stat('Income', s.income, 'income'),
    stat('Spent', s.expenses, 'expense'),
    stat('Balance', s.balance, s.balance < 0 ? 'negative' : 'positive'),
  );

  if (s.byCategory.length === 0) {
    render(categoriesBox, el('h3', {}, 'Spending by category'), el('p', { class: 'muted' }, 'No spending this month.'));
    return;
  }
  render(
    categoriesBox,
    el('h3', {}, 'Spending by category'),
    el('ul', { class: 'bars' },
      ...s.byCategory.map((c) => {
        const percent = Math.round(c.share * 100);
        return el('li', {},
          el('div', { class: 'bar-label' }, el('span', {}, c.category), el('span', {}, `${money(c.total)} · ${percent}%`)),
          el('div', { class: 'bar-track', role: 'img', 'aria-label': `${c.category}: ${percent}% of spending` },
            el('div', { class: 'bar-fill', style: `width: ${Math.max(c.share * 100, 1)}%` }),
          ),
        );
      }),
    ),
  );
}

function renderList(): void {
  const items = sortNewestFirst(inMonth(transactions, month));
  if (items.length === 0) {
    render(listBox, el('h3', {}, 'Entries'), el('p', { class: 'muted' }, 'Nothing here yet. Add your first entry above.'));
    return;
  }
  render(
    listBox,
    el('h3', {}, 'Entries'),
    el('ul', { class: 'entry-list' },
      ...items.map((t) => {
        const remove = el('button', { type: 'button', class: 'icon delete', 'aria-label': `Delete ${t.category} ${money(t.amount)}` }, '×');
        remove.addEventListener('click', () => {
          const result = removeTransaction(transactions, t.id);
          if (!result.removed) return;
          transactions = result.items;
          persist();
          update();
          showUndo(result.removed);
        });
        return el('li', { class: `entry ${t.kind}` },
          el('div', { class: 'entry-main' },
            el('span', { class: 'entry-category' }, t.category),
            t.note ? el('span', { class: 'entry-note' }, t.note) : null,
          ),
          el('span', { class: 'entry-date' }, dayName(t.date)),
          el('span', { class: 'entry-amount' }, `${t.kind === 'expense' ? '−' : '+'}${money(t.amount)}`),
          remove,
        );
      }),
    ),
  );
}

function update(): void {
  monthLabel.textContent = monthName(month);
  noticeBox.textContent = notice ?? '';
  noticeBox.hidden = notice === null;
  exportButton.disabled = transactions.length === 0;
  renderSummary();
  renderList();
}

render(
  app,
  el('header', { class: 'top' },
    el('h1', {}, 'PocketLedger'),
    exportButton,
  ),
  noticeBox,
  el('main', {},
    form,
    el('div', { class: 'month-nav' }, prevButton, monthLabel, nextButton),
    summaryBox,
    categoriesBox,
    listBox,
  ),
  el('footer', {}, 'Your data stays in this browser. Nothing is uploaded.'),
  toast,
);
setKind('expense');
update();
