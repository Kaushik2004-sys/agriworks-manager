// Phase 7: Expense Management page.
// Diesel, Maintenance, Driver Wages, Other with amount/date/description.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { EXPENSE_TYPES, createExpense, deleteExpense, listExpenses } from '../services/expenses';

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
    } catch {
      // Keep form data intact; show friendly message without technical details.
      setFormError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('Delete this expense?'))) return;
    try {
      await deleteExpense(id);
      load(search.trim(), filterType);
    } catch {
      setError('Delete failed. Please try again.');
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/payments" nextTo="/reports" />
      <h2 className="fw-bold">{t('Expense Management')}</h2>

      <form className="row g-2 mb-3" onSubmit={handleSearch}>
        <div className="col-12 col-md-5">
          <input
            className="form-control"
            placeholder={t('Search type, description...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">{t('All types')}</option>
            {EXPENSE_TYPES.map((et) => (
              <option key={et} value={et}>{t(et)}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('Filter')}</button>
          <button className="btn btn-success" type="button" onClick={startAdd}>{t('Add Expense')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim(), filterType)} />}

      <div className="alert alert-secondary">{t('Total shown:')} <b>Rs {total.toFixed(2)}</b> ({expenses.length} {t('records')})</div>

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{t('Add Expense')}</h5>
            {formError && <div className="alert alert-danger">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Expense type *')}</label>
                  <select
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
                  <label className="form-label">{t('Amount (Rs) *')}</label>
                  <input
                    type="number" step="1" min="1"
                    className="form-control"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">{t('Date *')}</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">{t('Description')}</label>
                  <input
                    className="form-control"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={t('Optional note, e.g. 50L diesel for tractor')}
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
        <p className="text-muted">{t('Loading expenses...')}</p>
      ) : expenses.length === 0 ? (
        <EmptyState message="No expenses found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
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
                  <td>{t(e.expense_type)}</td>
                  <td>Rs {e.amount}</td>
                  <td>{e.date}</td>
                  <td>{e.description}</td>
                  <td className="text-nowrap">
                    <span className="badge bg-secondary me-2" title={t('Saved expense records are locked and cannot be edited.')}>🔒 {t('Locked')}</span>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(e.id)}>{t('Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
