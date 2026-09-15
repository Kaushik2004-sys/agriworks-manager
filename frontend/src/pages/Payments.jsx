// Phase 6: Payment Management page.
// Record full/partial payments per bill, track pending, update status, view history.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { listBills } from '../services/bills';
import { listFarmers } from '../services/farmers';
import { listWorks } from '../services/works';
import { PAYMENT_METHODS, createPayment, deletePayment, listPayments } from '../services/payments';

export default function Payments() {
  const { t } = useLanguage();
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
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function billLabel(b) {
    const area = worksMap[b.work]?.area;
    const parts = [b.work_type || `Bill #${b.id}`, formatWorkDate(b.work_date)];
    if (area) parts.push(`${area} Acres`);
    parts.push(`Total Rs ${b.total_amount}`);
    parts.push(b.status === 'Paid' ? 'Paid' : `Pending Rs ${b.pending_amount}`);
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
      return `Payment Rs ${form.amount} exceeds remaining Rs ${maxAllowed.toFixed(2)}.`;
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
    } catch {
      // Keep form data intact; show friendly message without technical details.
      setFormError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('Delete this payment? Bill status will update.'))) return;
    try {
      await deletePayment(id);
      await refreshBill();
      await loadPayments(selectedBill);
    } catch {
      setError('Delete failed. Please try again.');
    }
  }

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/bills" nextTo="/expenses" />
      <h2 className="fw-bold">{t('Payment Management')}</h2>

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
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-3"><div className="card"><div className="card-body py-2"><small className="text-muted">{t('Total')}</small><div className="fw-bold">Rs {bill.total_amount}</div></div></div></div>
          <div className="col-6 col-md-3"><div className="card"><div className="card-body py-2"><small className="text-muted">{t('Paid')}</small><div className="fw-bold">Rs {bill.paid_amount}</div></div></div></div>
          <div className="col-6 col-md-3"><div className="card"><div className="card-body py-2"><small className="text-muted">{t('Pending')}</small><div className="fw-bold">Rs {bill.pending_amount}</div></div></div></div>
          <div className="col-6 col-md-3"><div className="card"><div className="card-body py-2"><small className="text-muted">{t('Status')}</small><div><span className="badge bg-secondary">{t(bill.status)}</span></div></div></div></div>
        </div>
      )}

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{t('Record Payment')}</h5>
            {formError && <div className="alert alert-danger">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-4">
                  <label className="form-label">{t('Payment date *')}</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">{t('Method *')}</label>
                  <select
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
                  <label className="form-label">{t('Amount (Rs) *')}</label>
                  <input
                    type="number" step="1" min="1"
                    className="form-control"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                  <div className="form-text">{t('Whole rupees only, minimum Rs 1. Maximum allowed: Rs ')}{maxAllowed.toFixed(2)}</div>
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
        <p className="text-muted">{t('Loading payments...')}</p>
      ) : payments.length === 0 ? (
        <EmptyState message="No payments found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
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
                  <td>{p.payment_date}</td>
                  <td>{t(p.method)}</td>
                  <td>Rs {p.amount}</td>
                  <td className="text-nowrap">
                    <span className="badge bg-secondary me-2" title={t('Saved payment records are locked and cannot be edited.')}>🔒 {t('Locked')}</span>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)}>{t('Delete')}</button>
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
