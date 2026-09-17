// Phase 5: Billing Management page.
// Generate bill from work record, show farmer/work/total/paid/pending/status.
// Phase 6: Pay button links to Payments page for that bill.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import WorkTypeIcon from '../components/WorkTypeIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { createBill, deleteBill, listBills, listUnbilledWorks } from '../services/bills';
import { listWorks } from '../services/works';

const STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid'];

// Simple trustworthy status words; CSS class only changes presentation.
function statusBadgeClass(status) {
  if (status === 'Paid') return 'aw-badge aw-badge-paid';
  if (status === 'Partial') return 'aw-badge aw-badge-partial';
  return 'aw-badge aw-badge-pending';
}

function statusIcon(status) {
  if (status === 'Paid') return '✅ ';
  if (status === 'Partial') return '◐ ';
  return '⏳ ';
}

export default function Bills() {
  const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [unbilled, setUnbilled] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ work: '', bill_date: '', total_amount: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    setForm({ work: '', bill_date: '', total_amount: '' });
    setFormError('');
    setShowForm(true);
    loadUnbilled();
  }

  // When work selected in add mode: auto-fill bill date from work date
  // and total from work amount (both locked, work is the source of truth)
  async function handleWorkChange(workId) {
    setForm({ ...form, work: workId });
    if (!workId) {
      setForm((f) => ({ ...f, bill_date: '', total_amount: '' }));
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
      setForm((f) => ({ ...f, work: workId, bill_date: w.work_date || '', total_amount: String(w.amount) }));
    }
  }

  function selectedWork() {
    return unbilled.find((x) => String(x.id) === String(form.work)) || null;
  }

  function validateForm() {
    if (!form.work) return 'Work record is required.';
    if (!form.bill_date) return 'Bill date is required.';
    if (form.bill_date > new Date().toISOString().slice(0, 10)) return 'Bill date cannot be in the future.';
    if (form.total_amount === '' || !(Number(form.total_amount) > 0)) return 'Total amount must be greater than 0.';
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
      // Generated bills are finalized records: only creation is supported.
      await createBill({
        work: Number(form.work),
        bill_date: form.bill_date,
        total_amount: form.total_amount,
      });
      setShowForm(false);
      load(search.trim(), filterStatus);
      loadUnbilled();
    } catch (err) {
      // P11: show the backend validation message (e.g. duplicate bill,
      // locked total) like Works does; keep form data intact.
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
      await deleteBill(pendingDeleteId);
      setPendingDeleteId(null);
      load(search.trim(), filterStatus);
      loadUnbilled();
    } catch (err) {
      // Surface the backend delete-guard message (e.g. paid bill cannot
      // be deleted); fall back to the generic message.
      const data = err.response?.data;
      let msg = '';
      if (Array.isArray(data) && data.length) msg = data[0];
      else if (data && typeof data === 'object') {
        const first = Object.values(data).flat().find(Boolean);
        msg = Array.isArray(first) ? first[0] : first;
      } else if (typeof data === 'string') msg = data;
      setError(msg ? String(msg) : 'Delete failed. Please try again.');
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  const sel = selectedWork();

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/works" nextTo="/payments" />
      <PageHeader
        title="Billing Management"
        subtitle="Bills made from work — see paid, pending, and status."
        actionLabel="🧾 Generate Bill"
        onAction={startAdd}
      />

      <form className="row g-2 mb-3" onSubmit={handleFilter} role="search">
        <div className="col-12 col-md-5">
          <label className="visually-hidden" htmlFor="bill-search">{t('Search bills')}</label>
          <input
            id="bill-search"
            className="form-control"
            type="search"
            placeholder={t('Search bills — farmer, mobile, work type...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="visually-hidden" htmlFor="bill-status">{t('Bill status')}</label>
          <select id="bill-status" className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t('All status')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('🔍 Filter')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim(), filterStatus)} />}

      {showForm && (
        <div className="card mb-3 aw-form-block">
          <div className="card-body">
            <h5 className="card-title">{t('🧾 Generate Bill from Work')}</h5>
            {formError && <div className="alert alert-danger" role="alert">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label" htmlFor="bill-work">{t('Work record *')}</label>
                  <select
                    id="bill-work"
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
                  {unbilled.length === 0 && (
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
                  <label className="form-label">{t('Bill date *')} 🔒</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.bill_date}
                    readOnly
                    disabled
                    title={t('Bill date is taken from the work date and locked.')}
                  />
                  <div className="form-text">
                    {t('Bill date is taken from the selected work date and locked.')}
                  </div>
                </div>
                <div className="col-6">
                  <label className="form-label">{t('Billed amount (Rs) *')} 🔒</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.total_amount}
                    readOnly
                    disabled
                    title={t('Billed amount is taken from the work amount and locked.')}
                  />
                  <div className="form-text">
                    {t('Billed amount is taken from the selected work amount and locked.')}
                  </div>
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? t('Saving...') : t('Generate')}
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
        <p className="text-muted" role="status">{t('Loading bills...')}</p>
      ) : bills.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No bills yet."
          message="Make a bill from finished work."
          actionLabel="🧾 Generate Bill"
          onAction={startAdd}
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
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
                  <td data-label={t('Farmer')}><strong>{b.farmer_name}</strong><br /><small className="text-muted">{b.farmer_village}</small></td>
                  <td data-label={t('Work')}><WorkTypeIcon type={b.work_type} />{t(b.work_type)}<br /><small className="text-muted">{b.work_date}</small></td>
                  <td data-label={t('Bill Date')}>{b.bill_date}</td>
                  <td data-label={t('Total')}><span className="aw-money">₹{b.total_amount}</span></td>
                  <td data-label={t('Paid')}>₹{b.paid_amount}</td>
                  <td data-label={t('Pending')}><strong>₹{b.pending_amount}</strong></td>
                  <td data-label={t('Status')}><span className={statusBadgeClass(b.status)}>{statusIcon(b.status)}{t(b.status === 'Partial' ? 'Partially Paid' : b.status === 'Unpaid' ? 'Pending' : b.status)}</span></td>
                  <td data-label={t('Actions')} className="text-nowrap">
                    <Link className="btn btn-sm btn-success me-2" to={`/payments?bill=${b.id}`}>{t('💰 Pay')}</Link>
                    <span className="badge bg-secondary me-2" title={t('Generated bills are finalized and cannot be edited.')}>🔒 {t('Final')}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(b.id)}>{t('🗑️ Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDeleteId != null && (
        <ConfirmDialog
          title="Delete this bill?"
          message="This will remove this bill from your records. Paid bills may be protected."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
