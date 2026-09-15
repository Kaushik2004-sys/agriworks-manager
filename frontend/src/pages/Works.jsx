// Phase 4: Agricultural Work Management page.
// Every work record is linked to a farmer (Farmer -> Work).
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
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

  async function handleDelete(id) {
    if (!window.confirm(t('Delete this work record?'))) return;
    try {
      await deleteWork(id);
      load(search.trim(), filterFarmer, filterType);
    } catch {
      setError('Delete failed. Please try again.');
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
      <h2 className="fw-bold">{t('Agricultural Work')}</h2>

      <form className="row g-2 mb-3" onSubmit={handleSearch}>
        <div className="col-12 col-md-4">
          <input
            className="form-control"
            placeholder={t('Search work type, farmer...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" value={filterFarmer} onChange={(e) => setFilterFarmer(e.target.value)}>
            <option value="">{t('All farmers')}</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.village})</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">{t('All work types')}</option>
            {WORK_TYPES.map((wt) => (
              <option key={wt} value={wt}>{t(wt)}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-2 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('Filter')}</button>
          <button className="btn btn-success" type="button" onClick={startAdd}>{t('Add Work')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim(), filterFarmer, filterType)} />}
      {farmers.length === 0 && !loading && (
        <div className="alert alert-warning">
          {t('No farmers found. Add a farmer first in Farmer Management, then add work.')}
        </div>
      )}

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{t('Add Work')}</h5>
            {formError && <div className="alert alert-danger">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Farmer *')}</label>
                  <select
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
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Work type *')}</label>
                  <select
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
                <div className="col-12 col-md-4">
                  <label className="form-label">{t('Work date *')}</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.work_date}
                    onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">{t('Field / Location')} *</label>
                  <input
                    className="form-control"
                    value={form.field_location}
                    onChange={(e) => setForm({ ...form, field_location: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">{t('Remark')}</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.remark}
                    onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  />
                </div>
                {isOther && (
                  <div className="col-12">
                    <label className="form-label">{t('Work Description')} *</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={form.work_description}
                      onChange={(e) => setForm({ ...form, work_description: e.target.value })}
                    />
                  </div>
                )}
                <div className="col-6 col-md-4">
                  <label className="form-label">{(isIrrigation || isOther) ? t('Area (acres)') : t('Area (acres) *')}</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">{isCalculated ? t('Total Amount') : isOther ? `${t('Total Amount')} (Rs) *` : t('Amount (Rs) *')}</label>
                  <input
                    type="number" step={isOther ? '1' : '0.01'} min={isOther ? '1' : '0'}
                    className="form-control"
                    value={isCalculated ? calculatedTotal : form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    readOnly={isCalculated}
                  />
                </div>
                {(isLandLeveling || isAreaRate || isOther) && (
                  <div className="col-6 col-md-4">
                    <label className="form-label">{t('Rate per Acre')} (Rs){isOther ? '' : ' *'}</label>
                    <input
                      type="number" step="1" min="1"
                      className="form-control"
                      value={form.rate_per_acre}
                      onChange={(e) => setForm({ ...form, rate_per_acre: e.target.value })}
                    />
                  </div>
                )}
                {isIrrigation && (
                  <>
                    <div className="col-12">
                      <h6 className="fw-semibold mb-0 mt-1">{t('Irrigation Duration')}</h6>
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label">{t('Hours')} *</label>
                      <input
                        type="number" step="1" min="0"
                        className="form-control"
                        value={form.irrigation_hours}
                        onChange={(e) => setForm({ ...form, irrigation_hours: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label">{t('Minutes')} *</label>
                      <input
                        type="number" step="1" min="0" max="59"
                        className="form-control"
                        value={form.irrigation_minutes}
                        onChange={(e) => setForm({ ...form, irrigation_minutes: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">{t('Rate per Hour')} (Rs) *</label>
                      <input
                        type="number" step="1" min="1"
                        className="form-control"
                        value={form.hourly_rate}
                        onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                      />
                    </div>
                  </>
                )}
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
        <p className="text-muted">{t('Loading work records...')}</p>
      ) : works.length === 0 ? (
        <EmptyState message="No work records found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
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
                  <td>{w.farmer_name || farmerName(w.farmer)}</td>
                  <td>{t(w.work_type)}</td>
                  <td>{w.work_date}</td>
                  <td>{w.area}</td>
                  <td>Rs {displayRupees(w.amount)}</td>
                  <td className="text-nowrap">
                    <span className="badge bg-secondary me-2" title={t('Saved work records are locked and cannot be edited.')}>🔒 {t('Locked')}</span>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(w.id)}>{t('Delete')}</button>
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
