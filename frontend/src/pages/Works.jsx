// Phase 4: Agricultural Work Management page.
// Every work record is linked to a farmer (Farmer -> Work).
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import WorkTypeIcon, { workTypeIconName } from '../components/WorkTypeIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { listFarmers } from '../services/farmers';
import { WORK_TYPES, createWork, deleteWork, listWorks } from '../services/works';

const emptyForm = { farmer: '', work_type: '', work_date: '', field_location: '', remark: '', work_description: '', area: '', amount: '', irrigation_hours: '', irrigation_minutes: '', hourly_rate: '', rate_per_acre: '' };

// Work types billed as Area x Rate per Acre (same formula as Land Leveling).
const AREA_RATE_TYPES = ['Ploughing', 'Rotavator', 'Cultivation', 'Harvesting'];

// Current local browser date as YYYY-MM-DD for date inputs. Computed fresh
// on each call — never hardcoded and never stored — so opening the form
// tomorrow defaults to tomorrow's date.
function todayLocal() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Total for irrigation time-based billing: (hours + minutes/60) x rate.
// Returns '' while inputs are incomplete; trims trailing zeros (1250, not 1250.00).
function irrigationTotal(h, m, r) {
  if (h === '' || m === '' || r === '') return '';
  const H = Number(h), M = Number(m), R = Number(r);
  if (!Number.isFinite(H) || !Number.isFinite(M) || !Number.isFinite(R)) return '';
  return String(Math.round((H + M / 60) * R * 100) / 100);
}

// Total for Land Leveling: Area x Rate per Acre. '' while inputs are incomplete.
// Rounded to whole rupees for billing (area may be decimal, rate is whole).
function landLevelingTotal(a, r) {
  if (a === '' || r === '') return '';
  const A = Number(a), R = Number(r);
  if (!Number.isFinite(A) || !Number.isFinite(R)) return '';
  return String(Math.round(A * R));
}

// Area accepts decimal acres (> 0). Empty is allowed only when the caller
// says so (Irrigation/Other where acre is optional).
function isValidArea(value, { allowEmpty = false } = {}) {
  if (value === '' || value === null || value === undefined) return allowEmpty;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

// Rate per Acre accepts whole rupees only, minimum Rs 1.
// Rejects 0, negatives, and decimals like 1000.50.
function isValidRatePerAcre(value) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

// Rate per Hour accepts whole rupees only, minimum Rs 1.
// Rejects 0, negatives, and decimals like 500.50.
function isValidRatePerHour(value) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

// Total Amount for Other is billed in whole rupees (minimum Rs 1).
function isValidWholeTotal(value) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

// Display stored amounts as whole rupees (1500, not 1500.00).
// Non-whole legacy values are trimmed without adding decimals.
function displayRupees(v) {
  if (v === '' || v === null || v === undefined) return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export default function Works() {
  const { t } = useLanguage();
  const [works, setWorks] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterFarmer, setFilterFarmer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load(searchText = search, farmerId = filterFarmer, workType = filterType) {
    setLoading(true);
    setError('');
    try {
      const data = await listWorks({
        search: searchText.trim(),
        farmer: farmerId,
        work_type: workType,
      });
      setWorks(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadFarmers() {
    try {
      const data = await listFarmers('');
      setFarmers(Array.isArray(data) ? data : data.results || []);
    } catch {
      setFarmers([]);
    }
  }

  useEffect(() => {
    load('', '', '');
    loadFarmers();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(search.trim(), filterFarmer, filterType);
  }

  function startAdd() {
    setForm({ ...emptyForm, work_date: todayLocal() });
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!form.farmer) return 'Farmer is required.';
    if (!WORK_TYPES.includes(form.work_type)) return 'Select a valid work type.';
    if (!form.work_date) return 'Work date is required.';
    if (!form.field_location || !String(form.field_location).trim()) return 'Field / Location is required.';
    if (form.work_type === 'Other' && !String(form.work_description || '').trim()) return 'Work Description is required.';
    if (form.work_date > todayLocal()) return 'Work date cannot be in the future.';
    // Area accepts decimals (0.5, 1.25...); rejects 0, negatives, empty/invalid.
    // Acre is optional for Irrigation (time-based) and Other; mandatory otherwise.
    const areaOptional = form.work_type === 'Irrigation' || form.work_type === 'Other';
    if (!isValidArea(form.area, { allowEmpty: areaOptional })) {
      return 'Area must be greater than 0.';
    }
    if (form.work_type === 'Irrigation') {
      if (form.irrigation_hours === '' || !Number.isInteger(Number(form.irrigation_hours)) || Number(form.irrigation_hours) < 0) return 'Hours must be 0 or more.';
      if (form.irrigation_minutes === '' || !Number.isInteger(Number(form.irrigation_minutes)) || Number(form.irrigation_minutes) < 0 || Number(form.irrigation_minutes) > 59) return 'Minutes must be between 0 and 59.';
      if (!isValidRatePerHour(form.hourly_rate)) return 'Rate per Hour must be a whole number of at least Rs 1.';
      return '';
    }
    if (form.work_type === 'Land Leveling' || AREA_RATE_TYPES.includes(form.work_type)) {
      if (!isValidRatePerAcre(form.rate_per_acre)) return 'Rate per Acre must be a whole number of at least Rs 1.';
      return '';
    }
    if (form.work_type === 'Other') {
      // Rate per Acre is optional for Other; when entered it must be
      // a whole number of at least Rs 1.
      const r = form.rate_per_acre;
      if (r !== '' && r !== null && r !== undefined && !isValidRatePerAcre(r)) {
        return 'Rate per Acre must be a whole number of at least Rs 1.';
      }
      if (!isValidWholeTotal(form.amount)) return 'Total Amount must be a whole number of at least Rs 1.';
      return '';
    }
    if (!(Number(form.amount) >= 0) || form.amount === '') return 'Amount cannot be negative.';
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
      farmer: Number(form.farmer),
      work_type: form.work_type,
      work_date: form.work_date,
      field_location: String(form.field_location).trim(),
      remark: String(form.remark || '').trim(),
      work_description: form.work_type === 'Other' ? String(form.work_description || '').trim() : null,
      area: form.area,
      amount: form.amount,
    };
    if (form.work_type === 'Irrigation') {
      payload.irrigation_hours = Number(form.irrigation_hours);
      payload.irrigation_minutes = Number(form.irrigation_minutes);
      payload.hourly_rate = form.hourly_rate;
      payload.amount = irrigationTotal(form.irrigation_hours, form.irrigation_minutes, form.hourly_rate);
      if (form.area === '' || form.area === null || form.area === undefined) payload.area = null;
    }
    if (form.work_type === 'Other' && (form.area === '' || form.area === null || form.area === undefined)) {
      payload.area = null;
    }
    if (form.work_type === 'Other') {
      // Rate per Acre is optional for Other: blank is stored as NULL,
      // entered values are whole rupees (validated above).
      if (form.rate_per_acre === '' || form.rate_per_acre === null || form.rate_per_acre === undefined) {
        payload.rate_per_acre = null;
      } else {
        payload.rate_per_acre = form.rate_per_acre;
      }
      // Total Amount is billed in whole rupees.
      payload.amount = String(Math.round(Number(form.amount)));
    }
    if (form.work_type === 'Land Leveling' || AREA_RATE_TYPES.includes(form.work_type)) {
      payload.rate_per_acre = form.rate_per_acre;
      payload.amount = landLevelingTotal(form.area, form.rate_per_acre);
    }
    try {
      // Saved work records are locked (source of truth for billing):
      // only creation is supported, never updates.
      await createWork(payload);
      setShowForm(false);
      setForm(emptyForm);
      load(search.trim(), filterFarmer, filterType);
    } catch (err) {
      // Show the backend validation message (e.g. duplicate work entry)
      // when available; keep form data intact.
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
      await deleteWork(pendingDeleteId);
      setPendingDeleteId(null);
      load(search.trim(), filterFarmer, filterType);
    } catch (err) {
      // Surface the backend delete-guard message (e.g. billed work cannot
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

  const isIrrigation = form.work_type === 'Irrigation';
  const isLandLeveling = form.work_type === 'Land Leveling';
  const isAreaRate = AREA_RATE_TYPES.includes(form.work_type);
  const isOther = form.work_type === 'Other';
  const irrigationTotalValue = isIrrigation
    ? irrigationTotal(form.irrigation_hours, form.irrigation_minutes, form.hourly_rate)
    : '';
  const landLevelingTotalValue = isLandLeveling
    ? landLevelingTotal(form.area, form.rate_per_acre)
    : '';
  const areaRateTotalValue = isAreaRate
    ? landLevelingTotal(form.area, form.rate_per_acre)
    : '';
  const isCalculated = isIrrigation || isLandLeveling || isAreaRate;
  const calculatedTotal = isIrrigation ? irrigationTotalValue : isLandLeveling ? landLevelingTotalValue : areaRateTotalValue;

  function farmerName(id) {
    const f = farmers.find((x) => String(x.id) === String(id));
    return f ? `${f.name} (${f.village})` : id;
  }

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/farmers" nextTo="/bills" />
      <PageHeader
        title="Agricultural Work"
        subtitle="Record farm work for a farmer — it becomes the bill later."
        actionLabel="+ Add Work"
        actionIcon="🚜"
        onAction={startAdd}
      />

      <form className="row g-2 mb-3" onSubmit={handleSearch} role="search">
        <div className="col-12 col-md-4">
          <label className="visually-hidden" htmlFor="work-search">{t('Search work')}</label>
          <input
            id="work-search"
            className="form-control"
            type="search"
            placeholder={t('Search work — farmer, work type...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="visually-hidden" htmlFor="work-filter-farmer">{t('Select Farmer')}</label>
          <select id="work-filter-farmer" className="form-select" value={filterFarmer} onChange={(e) => setFilterFarmer(e.target.value)}>
            <option value="">{t('All farmers')}</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.village})</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="visually-hidden" htmlFor="work-filter-type">{t('Select Work Type')}</label>
          <select id="work-filter-type" className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">{t('All work types')}</option>
            {WORK_TYPES.map((wt) => (
              <option key={wt} value={wt}>{t(wt)}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-2 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('🔍 Filter')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim(), filterFarmer, filterType)} />}
      {farmers.length === 0 && !loading && (
        <div className="alert alert-warning">
          {t('No farmers found. Add a farmer first in Farmer Management, then add work.')}
        </div>
      )}

      {showForm && (
        <div className="card mb-3 aw-form-block">
          <div className="card-body">
            <h5 className="card-title">{t('🚜 Add Work')}</h5>
            {formError && <div className="alert alert-danger" role="alert">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <h6 className="aw-section-title">{t('1. Farmer')}</h6>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label" htmlFor="work-farmer">{t('Farmer *')}</label>
                  <select
                    id="work-farmer"
                    className="form-select"
                    value={form.farmer}
                    onChange={(e) => setForm({ ...form, farmer: e.target.value })}
                  >
                    <option value="">{t('Select farmer')}</option>
                    {farmers.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.village})</option>
                    ))}
                  </select>
                </div>
              </div>
              <h6 className="aw-section-title">{t('2. Work Type')}</h6>
              {/* Visual chips write to the same work_type state; the select
                  below stays as the accessible source of truth. */}
              <div className="aw-chip-row mb-2" role="group" aria-label={t('Work type')}>
                {WORK_TYPES.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    className="aw-chip"
                    aria-pressed={form.work_type === wt}
                    onClick={() => setForm({
                      ...form,
                      work_type: wt,
                      work_description: wt === 'Other' ? form.work_description : '',
                    })}
                  >
                    <span aria-hidden="true">{workTypeIconName(wt)}</span> {t(wt)}
                  </button>
                ))}
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label" htmlFor="work-type">{t('Work type *')}</label>
                  <select
                    id="work-type"
                    className="form-select"
                    value={form.work_type}
                    onChange={(e) => setForm({
                      ...form,
                      work_type: e.target.value,
                      work_description: e.target.value === 'Other' ? form.work_description : '',
                    })}
                  >
                    <option value="">{t('Select type')}</option>
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>{t(wt)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <h6 className="aw-section-title">{t('3. Date & Place')}</h6>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="work-date">{t('Work date *')}</label>
                  <input
                    id="work-date"
                    type="date"
                    className="form-control"
                    value={form.work_date}
                    onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="work-location">{t('Field / Location *')}</label>
                  <input
                    id="work-location"
                    className="form-control"
                    value={form.field_location}
                    onChange={(e) => setForm({ ...form, field_location: e.target.value })}
                    placeholder={t('e.g. North field, Gat No. 12')}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="work-remark">{t('Note (optional)')}</label>
                  <textarea
                    id="work-remark"
                    className="form-control"
                    rows={2}
                    value={form.remark}
                    onChange={(e) => setForm({ ...form, remark: e.target.value })}
                    placeholder={t('Any extra detail (optional)')}
                  />
                </div>
              </div>
              <h6 className="aw-section-title">{t('4. Work Details')}</h6>
                <div className="row g-2">
                {isOther && (
                  <div className="col-12">
                    <label className="form-label" htmlFor="work-desc">{t('Work Description *')}</label>
                    <textarea
                      id="work-desc"
                      className="form-control"
                      rows={2}
                      value={form.work_description}
                      onChange={(e) => setForm({ ...form, work_description: e.target.value })}
                      placeholder={t('Describe the work done')}
                    />
                  </div>
                )}
                <div className="col-6 col-md-4">
                  <label className="form-label" htmlFor="work-area">{(isIrrigation || isOther) ? t('Area (acres)') : t('Area (acres) *')}</label>
                  <input
                    id="work-area"
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="0.0"
                  />
                </div>
                {(isLandLeveling || isAreaRate || isOther) && (
                  <div className="col-6 col-md-4">
                    <label className="form-label" htmlFor="work-rate-acre">{t('Rate per Acre (₹)')}{isOther ? '' : ' *'}</label>
                    <input
                      id="work-rate-acre"
                      type="number" step="1" min="1"
                      className="form-control"
                      value={form.rate_per_acre}
                      onChange={(e) => setForm({ ...form, rate_per_acre: e.target.value })}
                      placeholder="₹"
                    />
                  </div>
                )}
                {isIrrigation && (
                  <>
                    <div className="col-12">
                      <h6 className="fw-semibold mb-0 mt-1">{t('💧 Irrigation Time')}</h6>
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label" htmlFor="work-hours">{t('Hours *')}</label>
                      <input
                        id="work-hours"
                        type="number" step="1" min="0"
                        className="form-control"
                        value={form.irrigation_hours}
                        onChange={(e) => setForm({ ...form, irrigation_hours: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label" htmlFor="work-minutes">{t('Minutes *')}</label>
                      <input
                        id="work-minutes"
                        type="number" step="1" min="0" max="59"
                        className="form-control"
                        value={form.irrigation_minutes}
                        onChange={(e) => setForm({ ...form, irrigation_minutes: e.target.value })}
                        placeholder="0–59"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="work-rate-hour">{t('Rate per Hour (₹) *')}</label>
                      <input
                        id="work-rate-hour"
                        type="number" step="1" min="1"
                        className="form-control"
                        value={form.hourly_rate}
                        onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                        placeholder="₹"
                      />
                    </div>
                  </>
                )}
                </div>
                <h6 className="aw-section-title">{t('5. Amount')}</h6>
                <div className="row g-2">
                <div className="col-12">
                  <label className="form-label" htmlFor="work-amount">{isCalculated ? t('Total Amount (auto)') : isOther ? t('Total Amount (₹) *') : t('Amount (₹) *')}</label>
                  <input
                    id="work-amount"
                    type="number" step={isOther ? '1' : '0.01'} min={isOther ? '1' : '0'}
                    className="form-control aw-money-big"
                    value={isCalculated ? calculatedTotal : form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    readOnly={isCalculated}
                    placeholder="₹"
                  />
                  {isCalculated && calculatedTotal !== '' && (
                    <div className="form-text">{t('Calculated automatically: ')}<strong className="aw-money">₹{calculatedTotal}</strong></div>
                  )}
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
        <p className="text-muted" role="status">{t('Loading work records...')}</p>
      ) : works.length === 0 ? (
        <EmptyState
          icon="🚜"
          title="No work records found."
          message="Record your first work — it becomes the bill later."
          actionLabel="+ Add Work"
          onAction={startAdd}
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
            <thead className="table-success">
              <tr>
                <th>{t('Farmer')}</th>
                <th>{t('Work Type')}</th>
                <th>{t('Date')}</th>
                <th>{t('Area')}</th>
                <th>{t('Amount')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id}>
                  <td data-label={t('Farmer')}><strong>{w.farmer_name || farmerName(w.farmer)}</strong></td>
                  <td data-label={t('Work Type')}><WorkTypeIcon type={w.work_type} />{t(w.work_type)}</td>
                  <td data-label={t('Date')}>{w.work_date}</td>
                  <td data-label={t('Area')}>{w.area || '—'}</td>
                  <td data-label={t('Amount')}><span className="aw-money">₹{displayRupees(w.amount)}</span></td>
                  <td data-label={t('Actions')} className="text-nowrap">
                    <span className="badge bg-secondary me-2" title={t('Saved work records are locked and cannot be edited.')}>🔒 {t('Locked')}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(w.id)}>{t('🗑️ Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDeleteId != null && (
        <ConfirmDialog
          title="Delete this work record?"
          message="This will remove this work from your records. Billed work may be protected."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
