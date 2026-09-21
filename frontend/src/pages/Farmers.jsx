// Phase 3: Farmer Management page.
// Features: view table, search, add, update, delete + validation.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
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
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load(searchText = '') {
    setLoading(true);
    setError('');
    try {
      const data = await listFarmers(searchText);
      // DRF returns array (no pagination by default)
      setFarmers(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
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
    if (!/^\p{L}[\p{L}\p{M}]*( \p{L}[\p{L}\p{M}]*)*$/u.test(form.name)) {
      return 'Farmer name must contain only letters with single spaces between words.';
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) return 'Mobile number must be 10 digits.';
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
      // P11: show the backend validation message like Works does; keep
      // form data intact.
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

  // Same delete logic as before; only the confirmation UI is friendlier.
  // (Accessible dialog instead of window.confirm; backend call unchanged.)
  async function handleDelete(id) {
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (pendingDeleteId == null) return;
    setDeleting(true);
    try {
      await deleteFarmer(pendingDeleteId);
      setPendingDeleteId(null);
      load(search.trim());
    } catch (err) {
      // Surface the backend delete-guard message (e.g. farmer with work
      // records cannot be deleted); fall back to the generic message.
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

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <BackButton nextTo="/works" />
      <PageHeader
        title="Farmer Management"
        subtitle="Your farmer register — search, add, or update a farmer."
        actionLabel="+ Add Farmer"
        actionIcon="👨‍🌾"
        onAction={startAdd}
      />

      <form className="row g-2 mb-3" onSubmit={handleSearch} role="search">
        <div className="col-12 col-md-6">
          <label className="visually-hidden" htmlFor="farmer-search">{t('Search Farmers')}</label>
          <input
            id="farmer-search"
            className="form-control"
            type="search"
            placeholder={t('Search Farmers — name, mobile, village...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-6 d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" type="submit">{t('🔍 Search')}</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => load(search.trim())} />}

      {showForm && (
        <div className="card mb-3 aw-form-block">
          <div className="card-body">
            <h5 className="card-title">{editingId ? t('Update Farmer') : t('👨‍🌾 Add Farmer')}</h5>
            {formError && <div className="alert alert-danger" role="alert">{t(formError)}</div>}
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="farmer-name">{t('Farmer name *')}</label>
                  <input
                    id="farmer-name"
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('e.g. Ramesh Patil')}
                    autoComplete="name"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="farmer-mobile">{t('Mobile (10 digits) *')}</label>
                  <div className="input-group">
                    <span className="input-group-text" aria-hidden="true">+91</span>
                    <input
                      id="farmer-mobile"
                      className="form-control"
                      value={form.mobile}
                      onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                      maxLength={10}
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder={t('Enter 10-digit mobile number')}
                      pattern="[6-9][0-9]{9}"
                      aria-label={t('Mobile (10 digits) *')}
                    />
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="farmer-village">{t('Village *')}</label>
                  <input
                    id="farmer-village"
                    className="form-control"
                    value={form.village}
                    onChange={(e) => setForm({ ...form, village: e.target.value })}
                    placeholder={t('e.g. Shirur')}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="farmer-address">{t('Address')}</label>
                  <input
                    id="farmer-address"
                    className="form-control"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={t('House / street (optional)')}
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
        <p className="text-muted" role="status">{t('Loading farmers...')}</p>
      ) : farmers.length === 0 ? (
        <EmptyState
          icon="👨‍🌾"
          title="No farmers added yet."
          message="Add your first farmer to start recording work."
          actionLabel="+ Add Farmer"
          onAction={startAdd}
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
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
                  <td data-label={t('Name')}><strong>{f.name}</strong></td>
                  <td data-label={t('Mobile')}>📞 {f.mobile}</td>
                  <td data-label={t('Village')}>{f.village}</td>
                  <td data-label={t('Address')}>{f.address || '—'}</td>
                  <td data-label={t('Actions')} className="text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => startEdit(f)}
                    >
                      {t('✏️ Edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(f.id)}
                    >
                      {t('🗑️ Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDeleteId != null && (
        <ConfirmDialog
          title="Delete Farmer?"
          message="This will remove this farmer from your records."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
