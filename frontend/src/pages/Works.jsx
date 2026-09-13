// Phase 4: Agricultural Work Management page.
// Every work record is linked to a farmer (Farmer -> Work).
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { useLanguage } from '../i18n/LanguageContext';
import { listFarmers } from '../services/farmers';
import { WORK_TYPES, createWork, deleteWork, listWorks, updateWork } from '../services/works';

const emptyForm = { farmer: '', work_type: '', work_date: '', area: '', amount: '' };

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
      setError('Cannot load work records. Check backend is running.');
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
      area: String(w.area),
      amount: String(w.amount),
    });
    setEditingId(w.id);
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!form.farmer) return 'Farmer is required.';
    if (!WORK_TYPES.includes(form.work_type)) return 'Select a valid work type.';
    if (!form.work_date) return 'Work date is required.';
    if (form.work_date > new Date().toISOString().slice(0, 10)) return 'Work date cannot be in the future.';
    if (!(Number(form.area) > 0)) return 'Area must be greater than 0.';
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
      area: form.area,
      amount: form.amount,
    };
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
    if (!window.confirm(t('Delete this work record?'))) return;
    try {
      await deleteWork(id);
      load(search.trim(), filterFarmer, filterType);
    } catch {
      setError('Delete failed.');
    }
  }

  function farmerName(id) {
    const f = farmers.find((x) => String(x.id) === String(id));
    return f ? `${f.name} (${f.village})` : id;
  }

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/farmers" nextTo="/bills" />
      <h2 className="fw-bold">{t('Agricultural Work')}</h2>
      <p className="text-muted">{t('Phase 4 – Work records linked to farmers.')}</p>

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

      {error && <div className="alert alert-danger">{t(error)}</div>}
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
                    onChange={(e) => setForm({ ...form, work_type: e.target.value })}
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
                <div className="col-6 col-md-4">
                  <label className="form-label">{t('Area (acres) *')}</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">{t('Amount (Rs) *')}</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="form-control"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
        <p className="text-muted">{t('Loading work records...')}</p>
      ) : works.length === 0 ? (
        <div className="alert alert-info">{t('No work records found. Click Add Work.')}</div>
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
