// Phase 6: Payment Management page.
// Record full/partial payments per bill, track pending, update status, view history.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { listBills } from '../services/bills';
import { PAYMENT_METHODS, createPayment, deletePayment, listPayments, updatePayment } from '../services/payments';

export default function Payments() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(searchParams.get('bill') || '');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ payment_date: '', method: 'Cash', amount: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const bill = useMemo(
    () => bills.find((b) => String(b.id) === String(selectedBill)),
    [bills, selectedBill]
  );
  const pending = bill ? Number(bill.pending_amount) : 0;
  // When editing, remaining allowed = current pending + this payment's amount
  const maxAllowed = editing ? pending + Number(editing.amount) : pending;

  async function loadBills() {
    try {
      const data = await listBills({});
      const arr = Array.isArray(data) ? data : data.results || [];
      setBills(arr);
      if (!selectedBill && arr.length > 0 && searchParams.get('bill')) {
        setSelectedBill(searchParams.get('bill'));
      }
    } catch {
      setError('Something went wrong. Please try again.');
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
    loadBills();
    loadPayments(selectedBill);
  }

  useEffect(() => {
    loadBills();
  }, []);

  useEffect(() => {
    loadPayments(selectedBill);
  }, [selectedBill]);

  async function refreshBill() {
    try {
      const data = await listBills({});
      const arr = Array.isArray(data) ? data : data.results || [];
      setBills(arr);
    } catch {
      // keep old bills on refresh fail
    }
  }

  function startAdd() {
    if (!selectedBill) {
      setFormError('Select a bill first.');
      setShowForm(true);
      return;
    }
    setEditing(null);
    setForm({ payment_date: new Date().toISOString().slice(0, 10), method: 'Cash', amount: '' });
    setFormError('');
    setShowForm(true);
  }

  function startEdit(p) {
    setEditing(p);
    setForm({ payment_date: p.payment_date, method: p.method, amount: String(p.amount) });
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!selectedBill && !editing) return 'Bill is required.';
    if (!form.payment_date) return 'Payment date is required.';
    if (form.payment_date > new Date().toISOString().slice(0, 10)) return 'Payment date cannot be in the future.';
    if (!(Number(form.amount) > 0)) return 'Payment amount must be greater than 0.';
    if (Number(form.amount) > maxAllowed + 0.001) {
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
      if (editing) {
        await updatePayment(editing.id, {
          bill: editing.bill,
          payment_date: form.payment_date,
          method: form.method,
          amount: form.amount,
        });
      } else {
        await createPayment({
          bill: Number(selectedBill),
          payment_date: form.payment_date,
          method: form.method,
          amount: form.amount,
        });
      }
      setShowForm(false);
      setEditing(null);
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

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label">{t('Select Bill *')}</label>
          <select
            className="form-select"
            value={selectedBill}
            onChange={(e) => setSelectedBill(e.target.value)}
          >
            <option value="">{t('Select a bill')}</option>
            {bills.map((b) => (
              <option key={b.id} value={b.id}>
                Bill #{b.id} {b.farmer_name} – Total Rs {b.total_amount} / Pending Rs {b.pending_amount} ({t(b.status)})
              </option>
            ))}
          </select>
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
            <h5 className="card-title">{editing ? t('Update Payment') : t('Record Payment')}</h5>
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
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                  <div className="form-text">{t('Maximum allowed: Rs ')}{maxAllowed.toFixed(2)}</div>
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? t('Saving...') : editing ? t('Update') : t('Save')}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!selectedBill ? (
        <div className="alert alert-info">{t('Select a bill to view payment history.')}</div>
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
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(p)}>{t('Edit')}</button>
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
