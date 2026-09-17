// Phase 7: Expense Management page.
// Diesel, Maintenance, Driver Wages, Other with amount/date/description.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import { useLanguage } from '../i18n/LanguageContext';
import { EXPENSE_TYPES, createExpense, deleteExpense, listExpenses } from '../services/expenses';

const EXPENSE_ICONS = { Diesel: '🛢️', Maintenance: '🔧', 'Driver Wages': '👷', Other: '🧾' };

const emptyForm = { expense_type: '', amount: '', date: '', description: '' };

export default function Expenses() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load(searchText = search, type = filterType) {
    setLoading(true);
    setError('');
    try {
      const data = await listExpenses({ search: searchText.trim(), expense_type: type });
      setExpenses(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('', '');
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(search.trim(), filterType);
  }

  function startAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!EXPENSE_TYPES.includes(form.expense_type)) return 'Select a valid expense type.';
    // Amount accepts whole rupees only, minimum Rs 1.
    // Rejects 0, negatives, and decimals like 500.50.
    if (form.amount === '' || form.amount === null || form.amount === undefined) {
      return 'Amount must be a whole number of at least Rs 1.';
    }
    {
      const n = Number(form.amount);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        return 'Amount must be a whole number of at least Rs 1.';
      }
    }
    if (!form.date) return 'Date is required.';
    if (form.date > new Date().toISOString().slice(0, 10)) return 'Date cannot be in the future.';
    return '';
  }

  async function handleSave(e) {
    e.preventDefault();
    const localError = validateForm();
    if (localError) {
      setFormError(localError);
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      expense_type: form.expense_type,
      amount: form.amount,
      date: form.date,
      description: form.description.trim(),
    };
    try {
      // Saved expense records are locked: only creation is supported.
      await createExpense(payload);
      setShowForm(false);
      setForm(emptyForm);
      load(search.trim(), filterType);
    } catch (err) {
      // P11: show the backend validation message like Works does; keep
      // form data intact.
      const data = err?.response?.data;
      let msg = 'Save failed. Please try again.';
      if (data && typeof data === 'object') {
        const first = Object.values(data).flat().find((v) => typeof v === 'string' && v);
        if (first) msg = first;
      } else if (typeof data === 'string' && data) {
        msg = data;
      }
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  // Same delete logic; friendlier accessible dialog instead of window.confirm.
  async function handleDelete(id) {
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (pendingDeleteId == null) return;
    setDeleting(true);
    try {
      await deleteExpense(pendingDeleteId);
      setPendingDeleteId(null);
      load(search.trim(), filterType);
    } catch {
      setError('Delete failed. Please try again.');
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/payments" nextTo="/reports" />
      <PageHeader
        title="Expense Management"
        subtitle="Diesel, repairs, wages — write every kharcha here."
        actionLabel="+ Add Expense"
        actionIcon="💸"
        onAction={startAdd}
      />

      <form className="row g-2 mb-3" onSubmit={handleSearch} role="search">
        <div className="col-12 col-md-5">
          <label className="visually-hidden" htmlFor="expense-search">{t('Search expenses')}</label>
          <input
            id="expense-search"
            className="form-control"
            type="search"
            placeholder={t('Search expenses — type, note...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="visually-hidden" htmlFor="expense-type-filter">{t('Expense type')}</label>
          <select id="expense-type-filter" className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">{t('All types')}</option>
            {EXPENSE_TYPES.map((et) => (
              <option key={et} value={et}>{t(et)}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('🔍 Filter')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim(), filterType)} />}

      <div className="alert alert-secondary">{t('Total shown:')} <span className="aw-money">₹{total.toFixed(2)}</span> ({expenses.length} {t('records')})</div>

      {showForm && (
        <div className="card mb-3 aw-form-block">
          <div className="card-body">
            <h5 className="card-title">{t('💸 Add Expense')}</h5>
            {formError && <div className="alert alert-danger" role="alert">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="aw-chip-row mb-2" role="group" aria-label={t('Expense type')}>
                {EXPENSE_TYPES.map((et) => (
                  <button
                    key={et}
                    type="button"
                    className="aw-chip"
                    aria-pressed={form.expense_type === et}
                    onClick={() => setForm({ ...form, expense_type: et })}
                  >
                    <span aria-hidden="true">{EXPENSE_ICONS[et] || '💸'}</span> {t(et)}
                  </button>
                ))}
              </div>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="expense-type">{t('Expense type *')}</label>
                  <select
                    id="expense-type"
                    className="form-select"
                    value={form.expense_type}
                    onChange={(e) => setForm({ ...form, expense_type: e.target.value })}
                  >
                    <option value="">{t('Select type')}</option>
                    {EXPENSE_TYPES.map((et) => (
                      <option key={et} value={et}>{t(et)}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="expense-amount">{t('Amount (₹) *')}</label>
                  <input
                    id="expense-amount"
                    type="number" step="1" min="1"
                    className="form-control"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="₹"
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="expense-date">{t('Date *')}</label>
                  <input
                    id="expense-date"
                    type="date"
                    className="form-control"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="expense-desc">{t('Note (optional)')}</label>
                  <input
                    id="expense-desc"
                    className="form-control"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={t('e.g. 50L diesel for tractor (optional)')}
                  />
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? t('Saving...') : t('Save')}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted" role="status">{t('Loading expenses...')}</p>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="💸"
          title="No expenses yet."
          message="Write your first kharcha above."
          actionLabel="+ Add Expense"
          onAction={startAdd}
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
            <thead className="table-success">
              <tr>
                <th>{t('Type')}</th>
                <th>{t('Amount')}</th>
                <th>{t('Date')}</th>
                <th>{t('Description')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td data-label={t('Type')}><span aria-hidden="true">{EXPENSE_ICONS[e.expense_type] || '💸'} </span><strong>{t(e.expense_type)}</strong></td>
                  <td data-label={t('Amount')}><span className="aw-money">₹{e.amount}</span></td>
                  <td data-label={t('Date')}>{e.date}</td>
                  <td data-label={t('Description')}>{e.description || '—'}</td>
                  <td data-label={t('Actions')} className="text-nowrap">
                    <span className="badge bg-secondary me-2" title={t('Saved expense records are locked and cannot be edited.')}>🔒 {t('Locked')}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(e.id)}>{t('🗑️ Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDeleteId != null && (
        <ConfirmDialog
          title="Delete this expense?"
          message="This will remove this expense from your records."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
