// Phase 4: Agricultural Work Management page.
// Every work record is linked to a farmer (Farmer -> Work).
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { listFarmers } from '../services/farmers';
import { WORK_TYPES, createWork, deleteWork, listWorks, updateWork } from '../services/works';

const emptyForm = { farmer: '', work_type: '', work_date: '', field_location: '', remark: '', work_description: '', area: '', amount: '', irrigation_hours: '', irrigation_minutes: '', hourly_rate: '', rate_per_acre: '' };

// Work types billed as Area x Rate per Acre (same formula as Land Leveling).
const AREA_RATE_TYPES = ['Ploughing', 'Rotavator', 'Cultivation', 'Harvesting'];

// Total for irrigation time-based billing: (hours + minutes/60) x rate.
// Returns '' while inputs are incomplete; trims trailing zeros (1250, not 1250.00).
function irrigationTotal(h, m, r) {
  if (h === '' || m === '' || r === '') return '';
  const H = Number(h), M = Number(m), R = Number(r);
  if (!Number.isFinite(H) || !Number.isFinite(M) || !Number.isFinite(R)) return '';
  return String(Math.round((H + M / 60) * R * 100) / 100);
}

// Total for Land Leveling: Area x Rate per Acre. '' while inputs are incomplete.
function landLevelingTotal(a, r) {
  if (a === '' || r === '') return '';
  const A = Number(a), R = Number(r);
  if (!Number.isFinite(A) || !Number.isFinite(R)) return '';
  return String(Math.round(A * R * 100) / 100);
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
  const [editingId, setEditingId] = useState(null);
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
    setForm({ ...emptyForm, work_date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function startEdit(w) {
    setForm({
      farmer: String(w.farmer),
      work_type: w.work_type,
      work_date: w.work_date,
      field_location: w.field_location === null || w.field_location === undefined ? '' : String(w.field_location),
      remark: w.remark === null || w.remark === undefined ? '' : String(w.remark),
      work_description: w.work_description === null || w.work_description === undefined ? '' : String(w.work_description),
      area: w.area === null || w.area === undefined ? '' : String(w.area),
      amount: String(w.amount),
      irrigation_hours: w.irrigation_hours === null || w.irrigation_hours === undefined ? '' : String(w.irrigation_hours),
      irrigation_minutes: w.irrigation_minutes === null || w.irrigation_minutes === undefined ? '' : String(w.irrigation_minutes),
      hourly_rate: w.hourly_rate === null || w.hourly_rate === undefined ? '' : String(w.hourly_rate),
      rate_per_acre: w.rate_per_acre === null || w.rate_per_acre === undefined ? '' : String(w.rate_per_acre),
    });
    setEditingId(w.id);
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!form.farmer) return 'Farmer is required.';
    if (!WORK_TYPES.includes(form.work_type)) return 'Select a valid work type.';
    if (!form.work_date) return 'Work date is required.';
    if (!form.field_location || !String(form.field_location).trim()) return 'Field / Location is required.';
    if (form.work_type === 'Other' && !String(form.work_description || '').trim()) return 'Work Description is required.';
    if (form.work_date > new Date().toISOString().slice(0, 10)) return 'Work date cannot be in the future.';
    if (!(Number(form.area) > 0)) {
      // Acre is optional for Irrigation (time-based) and Other; mandatory for remaining work types.
      if ((form.work_type === 'Irrigation' || form.work_type === 'Other') && (form.area === '' || form.area === null || form.area === undefined)) {
        // leave empty: stored as NULL
      } else {
        return 'Area must be greater than 0.';
      }
    }
    if (form.work_type === 'Irrigation') {
      if (form.irrigation_hours === '' || !Number.isInteger(Number(form.irrigation_hours)) || Number(form.irrigation_hours) < 0) return 'Hours must be 0 or more.';
      if (form.irrigation_minutes === '' || !Number.isInteger(Number(form.irrigation_minutes)) || Number(form.irrigation_minutes) < 0 || Number(form.irrigation_minutes) > 59) return 'Minutes must be between 0 and 59.';
      if (form.hourly_rate === '' || !(Number(form.hourly_rate) >= 0)) return 'Rate per Hour must be 0 or more.';
      return '';
    }
    if (form.work_type === 'Land Leveling' || AREA_RATE_TYPES.includes(form.work_type)) {
      if (form.rate_per_acre === '' || !(Number(form.rate_per_acre) >= 0)) return 'Rate per Acre must be 0 or more.';
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
    if (form.work_type === 'Land Leveling' || AREA_RATE_TYPES.includes(form.work_type)) {
      payload.rate_per_acre = form.rate_per_acre;
      payload.amount = landLevelingTotal(form.area, form.rate_per_acre);
    }
    try {
      if (editingId) {
        await updateWork(editingId, payload);
      } else {
        await createWork(payload);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load(search.trim(), filterFarmer, filterType);
    } catch {
      // Keep form data intact; show friendly message without technical details.
      setFormError('Save failed. Please try again.');
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
            <h5 className="card-title">{editingId ? t('Update Work') : t('Add Work')}</h5>
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
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={isCalculated ? calculatedTotal : form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    readOnly={isCalculated}
                  />
                </div>
                {(isLandLeveling || isAreaRate) && (
                  <div className="col-6 col-md-4">
                    <label className="form-label">{t('Rate per Acre')} (Rs) *</label>
                    <input
                      type="number" step="0.01" min="0"
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
                        type="number" step="0.01" min="0"
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
                  <td>Rs {w.amount}</td>
                  <td className="text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(w)}>{t('Edit')}</button>
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
