// Phase 7: Expense Management page.
// Diesel, Maintenance, Driver Wages, Other with amount/date/description.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { useLanguage } from '../i18n/LanguageContext';
import { EXPENSE_TYPES, createExpense, deleteExpense, listExpenses, updateExpense } from '../services/expenses';

const emptyForm = { expense_type: '', amount: '', date: '', description: '' };

export default function Expenses() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
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
      setError('Cannot load expenses. Check backend is running.');
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
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function startEdit(exp) {
    setForm({
      expense_type: exp.expense_type,
      amount: String(exp.amount),
      date: exp.date,
      description: exp.description || '',
    });
    setEditingId(exp.id);
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!EXPENSE_TYPES.includes(form.expense_type)) return 'Select a valid expense type.';
    if (!(Number(form.amount) > 0)) return 'Amount must be greater than 0.';
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
      if (editingId) {
        await updateExpense(editingId, payload);
      } else {
        await createExpense(payload);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load(search.trim(), filterType);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        const val = data[firstKey];
        const firstMsg = Array.isArray(val) ? val[0] : typeof val === 'string' ? val : JSON.stringify(val);
        setFormError(`${firstKey}: ${firstMsg}`);
      } else {
        setFormError('Save failed. Check values and try again.');
      }
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
      setError('Delete failed.');
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/payments" nextTo="/reports" />
      <h2 className="fw-bold">{t('Expense Management')}</h2>
      <p className="text-muted">{t('Phase 7 – Diesel, maintenance, wages and other expenses.')}</p>

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

      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="alert alert-secondary">{t('Total shown:')} <b>Rs {total.toFixed(2)}</b> ({expenses.length} {t('records')})</div>

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{editingId ? t('Update Expense') : t('Add Expense')}</h5>
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
                    type="number" step="0.01" min="0"
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
                  {saving ? t('Saving...') : editingId ? t('Update') : t('Save')}
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
        <div className="alert alert-info">{t('No expenses found. Click Add Expense.')}</div>
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
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(e)}>{t('Edit')}</button>
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
