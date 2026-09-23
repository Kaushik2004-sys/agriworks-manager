// Phase 6: Payment Management page.
// Record full/partial payments per bill, track pending, update status, view history.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import { useLanguage } from '../i18n/LanguageContext';
import { listBills } from '../services/bills';
import { listFarmers } from '../services/farmers';
import { listWorks } from '../services/works';
import { PAYMENT_METHODS, createPayment, deletePayment, listPayments } from '../services/payments';
import { formatRupees } from '../utils/formatRupees';

export default function Payments() {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const [farmers, setFarmers] = useState([]);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState('');
  const [worksMap, setWorksMap] = useState({});
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(searchParams.get('bill') || '');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ payment_date: '', method: 'Cash', amount: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const bill = useMemo(
    () => bills.find((b) => String(b.id) === String(selectedBill)),
    [bills, selectedBill]
  );
  const pending = bill ? Number(bill.pending_amount) : 0;
  const maxAllowed = pending;

  const farmer = useMemo(
    () => farmers.find((f) => String(f.id) === String(selectedFarmer)),
    [farmers, selectedFarmer]
  );

  function formatWorkDate(value) {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    // Localized like the rest of the UI: English keeps the existing
    // en-GB short form; Hindi/Marathi use the full month name in Devanagari.
    const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-GB';
    const month = lang === 'en' ? 'short' : 'long';
    return d.toLocaleDateString(locale, { day: 'numeric', month, year: 'numeric' });
  }

  function billLabel(b) {
    const area = worksMap[b.work]?.area;
    const parts = [t(b.work_type) || `Bill #${b.id}`, formatWorkDate(b.work_date)];
    if (area) parts.push(`${area} ${t('Acres')}`);
    parts.push(`${t('Total')} ₹${formatRupees(b.total_amount)}`);
    parts.push(b.status === 'Paid' ? t('Paid') : `${t('Pending')} ₹${formatRupees(b.pending_amount)}`);
    return parts.filter(Boolean).join(' | ');
  }

  // Paid bills cannot take another payment (backend would reject amount > 0 pending).
  function isBillDisabled(b) {
    return b.status === 'Paid';
  }

  async function loadFarmers(searchText = '') {
    try {
      const data = await listFarmers(searchText);
      setFarmers(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    }
  }

  function handleFarmerSearch(e) {
    e.preventDefault();
    loadFarmers(farmerSearch.trim());
  }

  async function loadBills(farmerId) {
    try {
      const data = await listBills(farmerId ? { farmer: farmerId } : {});
      const arr = Array.isArray(data) ? data : data.results || [];
      setBills(arr);
      // Changing farmer refreshes the work/bill list: drop a selection that
      // no longer belongs to this farmer (prevents cross-farmer payments).
      if (selectedBill && !arr.some((b) => String(b.id) === String(selectedBill))) {
        setSelectedBill('');
        setPayments([]);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  }

  async function loadWorksMap(farmerId) {
    if (!farmerId) {
      setWorksMap({});
      return;
    }
    try {
      const data = await listWorks({ farmer: farmerId });
      const arr = Array.isArray(data) ? data : data.results || [];
      const map = {};
      arr.forEach((w) => {
        map[w.id] = w;
      });
      setWorksMap(map);
    } catch {
      // area hints are optional; bills still work without them
    }
  }

  async function loadPayments(billId) {
    if (!billId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await listPayments({ bill: billId });
      setPayments(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    setError('');
    loadFarmers(farmerSearch.trim());
    loadBills(selectedFarmer);
    loadWorksMap(selectedFarmer);
    loadPayments(selectedBill);
  }

  // Resolve a ?bill= deep link to its farmer first, so the dependent
  // Farmer -> Work/Bill chain starts from the right farmer.
  useEffect(() => {
    async function init() {
      await loadFarmers('');
      const param = searchParams.get('bill') || '';
      if (param) {
        try {
          const data = await listBills({});
          const arr = Array.isArray(data) ? data : data.results || [];
          const found = arr.find((b) => String(b.id) === String(param));
          if (found) {
            setSelectedFarmer(String(found.farmer));
            setSelectedBill(String(found.id));
            return;
          }
        } catch {
          // fall through to unfiltered bills below
        }
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Farmer -> Work/Bill: every farmer change refreshes the bill/work list.
  useEffect(() => {
    loadBills(selectedFarmer);
    loadWorksMap(selectedFarmer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmer]);

  // Keep the selection in sync when the ?bill= URL changes during SPA navigation.
  const billParam = searchParams.get('bill') || '';
  useEffect(() => {
    if (!billParam || String(billParam) === String(selectedBill)) return;
    async function resolve() {
      try {
        const data = await listBills({});
        const arr = Array.isArray(data) ? data : data.results || [];
        const found = arr.find((b) => String(b.id) === String(billParam));
        if (found) {
          setSelectedFarmer(String(found.farmer));
          setSelectedBill(String(found.id));
        }
      } catch {
        // keep current selection on resolve fail
      }
    }
    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billParam]);

  useEffect(() => {
    loadPayments(selectedBill);
  }, [selectedBill]);

  async function refreshBill() {
    try {
      const data = await listBills(selectedFarmer ? { farmer: selectedFarmer } : {});
      const arr = Array.isArray(data) ? data : data.results || [];
      setBills(arr);
    } catch {
      // keep old bills on refresh fail
    }
  }

  function startAdd() {
    if (!selectedFarmer) {
      setFormError('Select a farmer first.');
      setShowForm(true);
      return;
    }
    if (!selectedBill) {
      setFormError('Select a bill first.');
      setShowForm(true);
      return;
    }
    if (bill && bill.status === 'Paid') {
      setFormError('This bill is already fully paid.');
      setShowForm(true);
      return;
    }
    setForm({ payment_date: new Date().toISOString().slice(0, 10), method: 'Cash', amount: '' });
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!selectedBill) return 'Bill is required.';
    if (!form.payment_date) return 'Payment date is required.';
    if (form.payment_date > new Date().toISOString().slice(0, 10)) return 'Payment date cannot be in the future.';
    // Whole rupees only, starting from Rs 1 (no zero, negatives or decimals).
    const amt = Number(form.amount);
    if (form.amount === '' || !Number.isInteger(amt) || amt < 1) {
      return 'Payment amount must be a whole number of at least Rs 1 (no decimals).';
    }
    if (amt > maxAllowed + 0.001) {
      return `Payment ₹${formatRupees(form.amount)} exceeds remaining ₹${formatRupees(maxAllowed)}.`;
    }
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
      // Saved payment records are locked: only recording is supported.
      await createPayment({
        bill: Number(selectedBill),
        payment_date: form.payment_date,
        method: form.method,
        amount: form.amount,
      });
      setShowForm(false);
      await refreshBill();
      await loadPayments(selectedBill);
    } catch (err) {
      // P11: show the backend message (e.g. exceeds remaining amount)
      // like Works does; keep form data intact.
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
      await deletePayment(pendingDeleteId);
      setPendingDeleteId(null);
      await refreshBill();
      await loadPayments(selectedBill);
    } catch {
      setError('Delete failed. Please try again.');
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/bills" nextTo="/expenses" />
      <PageHeader
        title="Payment Management"
        subtitle="Farmer → Bill → Payment. You always see what is remaining."
        actionLabel="💰 Record Payment"
        onAction={startAdd}
      />

      <form onSubmit={handleFarmerSearch} className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label">{t('Search Farmer')}</label>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder={t('Search by name, mobile or village')}
              value={farmerSearch}
              onChange={(e) => setFarmerSearch(e.target.value)}
            />
            <button className="btn btn-outline-primary" type="submit">{t('Search')}</button>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">{t('Select Farmer *')}</label>
          <select
            className="form-select"
            value={selectedFarmer}
            onChange={(e) => {
              setSelectedFarmer(e.target.value);
              setShowForm(false);
            }}
          >
            <option value="">{t('Select a farmer')}</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} – {f.mobile}
              </option>
            ))}
          </select>
          {farmer && (
            <div className="form-text">
              {farmer.name} – {farmer.mobile}{farmer.village ? ` – ${farmer.village}` : ''}
            </div>
          )}
        </div>
      </form>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label">{t('Select Work / Bill *')}</label>
          <select
            className="form-select"
            value={selectedBill}
            onChange={(e) => setSelectedBill(e.target.value)}
            disabled={!selectedFarmer}
          >
            <option value="">
              {selectedFarmer ? t('Select a work / bill') : t('Select a farmer first')}
            </option>
            {bills.map((b) => (
              <option key={b.id} value={b.id} disabled={isBillDisabled(b)}>
                {billLabel(b)}
              </option>
            ))}
          </select>
          {selectedFarmer && bills.length === 0 && (
            <div className="form-text">{t('No bills found for this farmer.')}</div>
          )}
        </div>
        <div className="col-12 col-md-6 d-flex align-items-end gap-2 flex-wrap">
          <button className="btn btn-success" type="button" onClick={startAdd} disabled={!selectedBill}>
            {t('Record Payment')}
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={handleRetry} />}

      {bill && (
        <div className="card mb-3 aw-form-block" aria-live="polite">
          <div className="card-body">
            <div className="row g-2 text-center">
              <div className="col-6 col-md-3"><small className="text-muted">{t('Total Bill')}</small><div className="aw-money">₹{formatRupees(bill.total_amount)}</div></div>
              <div className="col-6 col-md-3"><small className="text-muted">{t('Paid')}</small><div className="aw-money">₹{formatRupees(bill.paid_amount)}</div></div>
              <div className="col-6 col-md-3"><small className="text-muted">{t('Remaining')}</small><div className="aw-money aw-money-big">₹{formatRupees(bill.pending_amount)}</div></div>
              <div className="col-6 col-md-3"><small className="text-muted">{t('Status')}</small><div><span className={bill.status === 'Paid' ? 'aw-badge aw-badge-paid' : bill.status === 'Partial' ? 'aw-badge aw-badge-partial' : 'aw-badge aw-badge-pending'}>{t(bill.status)}</span></div></div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-3 aw-form-block">
          <div className="card-body">
            <h5 className="card-title">{t('💰 Record Payment')}</h5>
            {formError && <div className="alert alert-danger" role="alert">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="pay-date">{t('Payment date *')}</label>
                  <input
                    id="pay-date"
                    type="date"
                    className="form-control"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="pay-method">{t('Method *')}</label>
                  <select
                    id="pay-method"
                    className="form-select"
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{t(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="pay-amount">{t('Amount (₹) *')}</label>
                  <input
                    id="pay-amount"
                    type="number" step="1" min="1"
                    className="form-control aw-money-big"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="₹"
                  />
                  <div className="form-text">{t('Remaining to pay: ')}<strong className="aw-money">₹{formatRupees(maxAllowed)}</strong></div>
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

      {!selectedFarmer ? (
        <div className="alert alert-info">{t('Select a farmer to view their bills.')}</div>
      ) : !selectedBill ? (
        <div className="alert alert-info">{t('Select a work / bill to view payment history.')}</div>
      ) : loading ? (
        <p className="text-muted" role="status">{t('Loading payments...')}</p>
      ) : payments.length === 0 ? (
        <EmptyState
          icon="💰"
          title="No payments recorded yet."
          message="Record the first payment for this bill."
          actionLabel="💰 Record Payment"
          onAction={startAdd}
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
            <thead className="table-success">
              <tr>
                <th>{t('Date')}</th>
                <th>{t('Method')}</th>
                <th>{t('Amount')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td data-label={t('Date')}>{p.payment_date}</td>
                  <td data-label={t('Method')}>{t(p.method)}</td>
                  <td data-label={t('Amount')}><span className="aw-money">₹{formatRupees(p.amount)}</span></td>
                  <td data-label={t('Actions')} className="text-nowrap">
                    <span className="badge bg-secondary me-2" title={t('Saved payment records are locked and cannot be edited.')}>🔒 {t('Locked')}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)}>{t('🗑️ Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDeleteId != null && (
        <ConfirmDialog
          title="Delete this payment?"
          message="Bill status will update after deleting."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
