// Phase 5: Billing Management page.
// Generate bill from work record, show farmer/work/total/paid/pending/status.
// Phase 6: Pay button links to Payments page for that bill.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { createBill, deleteBill, listBills, listUnbilledWorks, updateBill } from '../services/bills';
import { listWorks } from '../services/works';

const STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid'];

export default function Bills() {
  const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [unbilled, setUnbilled] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // bill object when editing
  const [form, setForm] = useState({ work: '', bill_date: '', total_amount: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(searchText = search, status = filterStatus) {
    setLoading(true);
    setError('');
    try {
      const data = await listBills({ search: searchText.trim(), status });
      setBills(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadUnbilled() {
    try {
      const data = await listUnbilledWorks();
      setUnbilled(Array.isArray(data) ? data : data.results || []);
    } catch {
      setUnbilled([]);
    }
  }

  useEffect(() => {
    load('', '');
    loadUnbilled();
  }, []);

  function handleFilter(e) {
    e.preventDefault();
    load(search.trim(), filterStatus);
  }

  function startAdd() {
    setEditing(null);
    setForm({ work: '', bill_date: new Date().toISOString().slice(0, 10), total_amount: '' });
    setFormError('');
    setShowForm(true);
    loadUnbilled();
  }

  async function startEdit(bill) {
    setEditing(bill);
    setForm({
      work: String(bill.work),
      bill_date: bill.bill_date || new Date().toISOString().slice(0, 10),
      total_amount: String(bill.total_amount),
    });
    setFormError('');
    setShowForm(true);
  }

  // When work selected in add mode: auto-fill total from work amount
  async function handleWorkChange(workId) {
    setForm({ ...form, work: workId });
    if (!workId) {
      setForm((f) => ({ ...f, total_amount: '' }));
      return;
    }
    // Find in unbilled list first, else fetch all works
    let w = unbilled.find((x) => String(x.id) === String(workId));
    if (!w) {
      try {
        const all = await listWorks({});
        const arr = Array.isArray(all) ? all : all.results || [];
        w = arr.find((x) => String(x.id) === String(workId));
      } catch {
        w = null;
      }
    }
    if (w) {
      setForm((f) => ({ ...f, work: workId, total_amount: String(w.amount) }));
    }
  }

  function selectedWork() {
    return unbilled.find((x) => String(x.id) === String(form.work))
      || (editing && String(editing.work) === String(form.work) ? editing : null);
  }

  function validateForm() {
    if (!form.work) return 'Work record is required.';
    if (!form.bill_date) return 'Bill date is required.';
    if (form.bill_date > new Date().toISOString().slice(0, 10)) return 'Bill date cannot be in the future.';
    if (form.total_amount === '' || !(Number(form.total_amount) >= 0)) return 'Total amount cannot be negative.';
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
    try {
      if (editing) {
        // Edit: keep same farmer/work, update date + total
        await updateBill(editing.id, {
          farmer: editing.farmer,
          work: editing.work,
          bill_date: form.bill_date,
          total_amount: form.total_amount,
        });
      } else {
        await createBill({
          work: Number(form.work),
          bill_date: form.bill_date,
          total_amount: form.total_amount,
        });
      }
      setShowForm(false);
      setEditing(null);
      load(search.trim(), filterStatus);
      loadUnbilled();
    } catch {
      // Keep form data intact; show friendly message without technical details.
      setFormError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('Delete this bill?'))) return;
    try {
      await deleteBill(id);
      load(search.trim(), filterStatus);
      loadUnbilled();
    } catch {
      setError('Delete failed. Please try again.');
    }
  }

  const sel = selectedWork();

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/works" nextTo="/payments" />
      <h2 className="fw-bold">{t('Billing Management')}</h2>

      <form className="row g-2 mb-3" onSubmit={handleFilter}>
        <div className="col-12 col-md-5">
          <input
            className="form-control"
            placeholder={t('Search farmer, mobile, work type...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t('All status')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('Filter')}</button>
          <button className="btn btn-success" type="button" onClick={startAdd}>{t('Generate Bill')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim(), filterStatus)} />}

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{editing ? t('Update Bill') : t('Generate Bill from Work')}</h5>
            {formError && <div className="alert alert-danger">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label">{t('Work record *')}</label>
                  {editing ? (
                    <input
                      className="form-control"
                      disabled
                      value={`${editing.farmer_name || ''} - ${editing.work_type || ''} (${editing.work_date || ''})`}
                    />
                  ) : (
                    <select
                      className="form-select"
                      value={form.work}
                      onChange={(e) => handleWorkChange(e.target.value)}
                    >
                      <option value="">{t('Select unbilled work')}</option>
                      {unbilled.map((w) => (
                        <option key={w.id} value={w.id}>
                          #{w.id} {w.farmer_name || ''} – {t(w.work_type)} ({w.work_date}) Rs {w.amount}
                        </option>
                      ))}
                    </select>
                  )}
                  {!editing && unbilled.length === 0 && (
                    <div className="form-text">{t('No unbilled works. Add work first in Work page.')}</div>
                  )}
                </div>
                {sel && (
                  <div className="col-12">
                    <div className="alert alert-info small mb-0">
                      {t('Farmer: ')}<b>{sel.farmer_name || sel.farmer || ''}</b>
                      {sel.farmer_village ? ` (${sel.farmer_village})` : ''} |
                      {t('Work: ')}<b>{t(sel.work_type || '')}</b> ({sel.work_date || ''}) |
                      {t('Work amount: ')}<b>Rs {sel.amount || sel.total_amount || ''}</b>
                    </div>
                  </div>
                )}
                <div className="col-6">
                  <label className="form-label">{t('Bill date *')}</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.bill_date}
                    onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label">{t('Total amount (Rs) *')}</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.total_amount}
                    onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                    disabled={!!editing}
                    readOnly={!!editing}
                    title={editing ? t('Generated bill amount is locked.') : ''}
                  />
                  {editing && (
                    <div className="form-text">{t('Generated bill amount is locked and cannot be changed.')}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? t('Saving...') : editing ? t('Update') : t('Generate')}
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
        <p className="text-muted">{t('Loading bills...')}</p>
      ) : bills.length === 0 ? (
        <EmptyState message="No bills found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-success">
              <tr>
                <th>{t('Farmer')}</th>
                <th>{t('Work')}</th>
                <th>{t('Bill Date')}</th>
                <th>{t('Total')}</th>
                <th>{t('Paid')}</th>
                <th>{t('Pending')}</th>
                <th>{t('Status')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td>{b.farmer_name}<br /><small className="text-muted">{b.farmer_village}</small></td>
                  <td>{t(b.work_type)}<br /><small className="text-muted">{b.work_date}</small></td>
                  <td>{b.bill_date}</td>
                  <td>Rs {b.total_amount}</td>
                  <td>Rs {b.paid_amount}</td>
                  <td>Rs {b.pending_amount}</td>
                  <td><span className="badge bg-secondary">{t(b.status)}</span></td>
                  <td className="text-nowrap">
                    <Link className="btn btn-sm btn-success me-2" to={`/payments?bill=${b.id}`}>{t('Pay')}</Link>
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(b)}>{t('Edit')}</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(b.id)}>{t('Delete')}</button>
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
