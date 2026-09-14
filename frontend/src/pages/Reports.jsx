// Phase 9: Report Generation page.
// 6 reports from actual DB records with filters, print and CSV export.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { listFarmers } from '../services/farmers';
import { REPORT_TYPES, getReport } from '../services/reports';

function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

const WORK_TYPE_OPTIONS = ['Ploughing', 'Rotavator', 'Cultivation', 'Harvesting', 'Irrigation', 'Other', 'Land Leveling'];
const EXPENSE_TYPE_OPTIONS = ['Diesel', 'Maintenance', 'Driver Wages', 'Other'];
const METHOD_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
const STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid'];

// Raw API field names mapped to translatable UI labels (values stay English).
const COLUMN_LABELS = {
  id: 'ID', farmer: 'Farmer', village: 'Village', work_type: 'Work Type',
  field_location: 'Field / Location', remark: 'Remark', work_description: 'Work Description',
  date: 'Date', area: 'Area', amount: 'Amount', work: 'Work',
  hours: 'Hours', minutes: 'Minutes', hourly_rate: 'Rate per Hour', rate_per_acre: 'Rate per Acre',
  bill_date: 'Bill Date', total: 'Total', paid: 'Paid', pending: 'Pending',
  status: 'Status', bill_id: 'Bill ID', mobile: 'Mobile',
  expense_type: 'Expense Type', description: 'Description',
  count: 'Count', total_area: 'Total Area', total_amount: 'Total Amount',
  total_pending: 'Total Pending',
};

export default function Reports() {
  const { t } = useLanguage();
  const [type, setType] = useState('work');
  const [farmers, setFarmers] = useState([]);
  const [filters, setFilters] = useState({
    farmer: '', status: '', work_type: '', expense_type: '', method: '',
    from: '', to: '', search: '',
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listFarmers('').then((d) => setFarmers(Array.isArray(d) ? d : d.results || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await getReport(type, filters);
      setData(res);
    } catch {
      setError('Something went wrong. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  function handleFilter(e) {
    e.preventDefault();
    load();
  }

  function handlePrint() {
    window.print();
  }

  function handleCSV() {
    if (!data?.records?.length) return;
    const csv = toCSV(data.records);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report.csv`;
    // Attached to the DOM so the download also triggers on Firefox/Safari.
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const label = t(REPORT_TYPES.find((r) => r.value === type)?.label || type);
  const records = data?.records || [];
  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  // Print header meta: only filters that actually have values are shown.
  // Database values (farmer name, dates, search) stay untranslated;
  // UI enum values reuse t() exactly like the on-screen report.
  const farmerName = farmers.find((f) => String(f.id) === String(filters.farmer))?.name || '';
  const appliedFilters = [
    farmerName ? { label: t('Farmer'), value: farmerName } : null,
    filters.from ? { label: t('From date'), value: filters.from } : null,
    filters.to ? { label: t('To date'), value: filters.to } : null,
    filters.work_type ? { label: t('Work Type'), value: t(filters.work_type) } : null,
    filters.expense_type ? { label: t('Expense Type'), value: t(filters.expense_type) } : null,
    filters.method ? { label: t('Method'), value: t(filters.method) } : null,
    filters.status ? { label: t('Status'), value: t(filters.status) } : null,
    filters.search ? { label: t('Search'), value: filters.search } : null,
  ].filter(Boolean);
  // Defensive defaults: an incomplete summary must show dashes, never crash.
  const summary = data?.summary || {};
  const byWorkType = summary.by_work_type || [];
  const byExpenseType = summary.by_expense_type || [];

  return (
    <div className="container py-4 reports-print-page">
      <div className="d-print-none">
        <BackButton to="/" label="Back to Home" />
        <BackButton to="/expenses" nextTo="/profile" />
      </div>

      {/* Print-only report header (screen shows the h2 + cards below). */}
      <div className="d-none d-print-block report-print-header mb-3">
        <div className="d-flex align-items-center gap-2">
          <img src="/logo.png" alt="AgriWorks logo" className="report-print-logo" />
          <div>
            <h4 className="mb-0 fw-bold">AgriWorks Manager</h4>
            <div className="small">{t('Smart Farm Work & Irrigation Management System')}</div>
          </div>
        </div>
        <hr />
        <h5 className="fw-bold">{t('Agricultural Report')} — {label}</h5>
        <div className="small">
          <span className="me-3">{t('Report Type')}: {label}</span>
          <span>{t('Generated on')}: {new Date().toLocaleDateString()}</span>
        </div>
        {appliedFilters.length > 0 && (
          <div className="small mt-1">
            {appliedFilters.map((f, i) => (
              <span key={i} className="me-3">{f.label}: <b>{f.value}</b></span>
            ))}
          </div>
        )}
      </div>

      <h2 className="fw-bold d-print-none">{t('Reports')}</h2>

      <div className="row g-2 mb-3 d-print-none">
        {REPORT_TYPES.map((r) => (
          <div key={r.value} className="col-6 col-md-4 col-lg-2">
            <button
              className={`btn w-100 btn-sm ${type === r.value ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setType(r.value)}
            >
              {t(r.label)}
            </button>
          </div>
        ))}
      </div>

      <form className="card mb-3 d-print-none" onSubmit={handleFilter}>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-md-3">
              <input
                className="form-control" placeholder={t('Search...')}
                value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select" value={filters.farmer} onChange={(e) => setFilters({ ...filters, farmer: e.target.value })}>
                <option value="">{t('All farmers')}</option>
                {farmers.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <input type="date" className="form-control" value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })} title={t('From date')} />
            </div>
            <div className="col-6 col-md-2">
              <input type="date" className="form-control" value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })} title={t('To date')} />
            </div>
            <div className="col-12 col-md-3 d-flex gap-2 flex-wrap">
              <button className="btn btn-outline-success" type="submit">{t('Apply')}</button>
              <button className="btn btn-outline-secondary" type="button" onClick={handlePrint}>{t('Print')}</button>
              <button className="btn btn-outline-secondary" type="button" onClick={handleCSV} disabled={!records.length}>CSV</button>
            </div>
          </div>
          <div className="row g-2 mt-1">
            {type === 'billing' && (
              <div className="col-6 col-md-2">
                <select className="form-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">{t('All status')}</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t(s)}</option>
                  ))}
                </select>
              </div>
            )}
            {(type === 'work' || type === 'performance') && (
              <div className="col-6 col-md-2">
                <select className="form-select" value={filters.work_type} onChange={(e) => setFilters({ ...filters, work_type: e.target.value })}>
                  <option value="">{t('All work types')}</option>
                  {WORK_TYPE_OPTIONS.map((wt) => (
                    <option key={wt} value={wt}>{t(wt)}</option>
                  ))}
                </select>
              </div>
            )}
            {type === 'expense' && (
              <div className="col-6 col-md-2">
                <select className="form-select" value={filters.expense_type} onChange={(e) => setFilters({ ...filters, expense_type: e.target.value })}>
                  <option value="">{t('All expense types')}</option>
                  {EXPENSE_TYPE_OPTIONS.map((et) => (
                    <option key={et} value={et}>{t(et)}</option>
                  ))}
                </select>
              </div>
            )}
            {type === 'payment' && (
              <div className="col-6 col-md-2">
                <select className="form-select" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
                  <option value="">{t('All methods')}</option>
                  {METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{t(m)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </form>

      {error && <div className="d-print-none"><ErrorState message={error} onRetry={load} /></div>}
      {loading && <p className="text-muted d-print-none">{t('Loading')} {label}...</p>}

      {!loading && data && (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">{label}</h5>
              {type === 'performance' ? (
                <div className="row g-2 small">
                  <div className="col-6 col-md-3">{t('Income:')} <b>Rs {summary.income ?? '—'}</b></div>
                  <div className="col-6 col-md-3">{t('Received:')} <b>Rs {summary.received ?? '—'}</b></div>
                  <div className="col-6 col-md-3">{t('Pending:')} <b>Rs {summary.pending ?? '—'}</b></div>
                  <div className="col-6 col-md-3">{t('Expenses:')} <b>Rs {summary.expenses ?? '—'}</b></div>
                  <div className="col-6 col-md-3">{t('Profit (cash):')} <b>Rs {summary.profit_cash ?? '—'}</b></div>
                  <div className="col-6 col-md-3">{t('Profit (billed):')} <b>Rs {summary.profit_billed ?? '—'}</b></div>
                  <div className="col-12 mt-2">
                    <b>{t('By work type:')}</b> {byWorkType.map((r) => `${t(r.work_type)} x${r.count} Rs${r.amount}`).join(' | ') || '—'}
                  </div>
                  <div className="col-12">
                    <b>{t('By expense type:')}</b> {byExpenseType.map((r) => `${t(r.expense_type)} x${r.count} Rs${r.amount}`).join(' | ') || '—'}
                  </div>
                </div>
              ) : (
                <div className="small text-muted">
                  {Object.entries(summary).map(([k, v]) => `${t(COLUMN_LABELS[k] || k)}: ${v}`).join(' | ')}
                </div>
              )}
            </div>
          </div>

          {type !== 'performance' && (
            records.length === 0 ? (
              <EmptyState message="No records found for the selected filters." />
            ) : (
              <div className="table-responsive report-print-table">
                <table className="table table-striped table-bordered">
                  <thead className="table-success">
                    <tr>{columns.map((c) => <th key={c}>{t(COLUMN_LABELS[c] || c)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={i}>{columns.map((c) => <td key={c}>{c === 'work_type' ? t(String(r[c] ?? '')) : String(r[c] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Print-only footer (the large green website footer is hidden in print). */}
          <div className="d-none d-print-block text-center small mt-3 report-print-footer">
            AgriWorks Manager — {t('Smart Farm Work & Irrigation Management System')}
          </div>
        </>
      )}
    </div>
  );
}
