// Phase 3: Farmer Management page.
// Features: view table, search, add, update, delete + validation.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { useLanguage } from '../i18n/LanguageContext';
import { createFarmer, deleteFarmer, listFarmers, updateFarmer } from '../services/farmers';

const emptyForm = { name: '', mobile: '', village: '', address: '' };

export default function Farmers() {
  const { t } = useLanguage();
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(searchText = '') {
    setLoading(true);
    setError('');
    try {
      const data = await listFarmers(searchText);
      // DRF returns array (no pagination by default)
      setFarmers(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Cannot load farmers. Check backend is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(search.trim());
  }

  function startAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function startEdit(farmer) {
    setForm({
      name: farmer.name || '',
      mobile: farmer.mobile || '',
      village: farmer.village || '',
      address: farmer.address || '',
    });
    setEditingId(farmer.id);
    setFormError('');
    setShowForm(true);
  }

  function validateForm() {
    if (!form.name.trim()) return 'Farmer name is required.';
    if (!/^\d{10}$/.test(form.mobile.trim())) return 'Mobile number must be 10 digits.';
    if (!form.village.trim()) return 'Village is required.';
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
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      village: form.village.trim(),
      address: form.address.trim(),
    };
    try {
      if (editingId) {
        await updateFarmer(editingId, payload);
      } else {
        await createFarmer(payload);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load(search.trim());
    } catch (err) {
      // Show backend validation errors, e.g. { mobile: ['...'] }
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        const firstMsg = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
        setFormError(`${firstKey}: ${firstMsg}`);
      } else {
        setFormError('Save failed. Check values and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('Delete this farmer?'))) return;
    try {
      await deleteFarmer(id);
      load(search.trim());
    } catch {
      setError('Delete failed.');
    }
  }

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton to="/" nextTo="/works" />
      <h2 className="fw-bold">{t('Farmer Management')}</h2>
      <p className="text-muted">{t('Phase 3 – Add, view, search, update, delete farmers.')}</p>

      <form className="row g-2 mb-3" onSubmit={handleSearch}>
        <div className="col-12 col-md-6">
          <input
            className="form-control"
            placeholder={t('Search name, mobile, village...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-6 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('Search')}</button>
          <button className="btn btn-success" type="button" onClick={startAdd}>{t('Add Farmer')}</button>
        </div>
      </form>

      {error && <div className="alert alert-danger">{t(error)}</div>}

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{editingId ? t('Update Farmer') : t('Add Farmer')}</h5>
            {formError && <div className="alert alert-danger">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Farmer name *')}</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Mobile (10 digits) *')}</label>
                  <input
                    className="form-control"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    maxLength={10}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Village *')}</label>
                  <input
                    className="form-control"
                    value={form.village}
                    onChange={(e) => setForm({ ...form, village: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">{t('Address')}</label>
                  <input
                    className="form-control"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-3 d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? t('Saving...') : editingId ? t('Update') : t('Save')}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  {t('Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">{t('Loading farmers...')}</p>
      ) : farmers.length === 0 ? (
        <div className="alert alert-info">{t('No farmers found. Click Add Farmer.')}</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-success">
              <tr>
                <th>{t('Name')}</th>
                <th>{t('Mobile')}</th>
                <th>{t('Village')}</th>
                <th>{t('Address')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.mobile}</td>
                  <td>{f.village}</td>
                  <td>{f.address}</td>
                  <td className="text-nowrap">
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => startEdit(f)}
                    >
                      {t('Edit')}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(f.id)}
                    >
                      {t('Delete')}
                    </button>
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
