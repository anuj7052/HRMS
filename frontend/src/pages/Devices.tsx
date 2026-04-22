import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Wifi, WifiOff, CircleDot, Loader2, X, Pencil, Trash2, Calendar, Info, Settings, Upload, Zap } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import type { Device } from '../types';

interface DeviceForm {
  name: string; ip: string; port: string; serialNumber: string; username: string; password: string;
}

const defaultForm: DeviceForm = { name: '', ip: '', port: '80', serialNumber: '', username: 'admin', password: '' };

function DeviceCard({ device, onSyncFromDate, onConfigure, onSyncNow, onManualImport, onTest, onEdit, onDelete }: {
  device: Device;
  onSyncFromDate: () => void;
  onConfigure: () => void;
  onSyncNow: () => void;
  onManualImport: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleTest() {
    setTesting(true);
    await onTest();
    setTesting(false);
  }

  async function handleSyncNow() {
    setSyncing(true);
    await onSyncNow();
    setSyncing(false);
  }

  const statusIcon = device.status === 'Online'
    ? <Wifi className="w-4 h-4 text-secondary-500" />
    : device.status === 'Offline'
    ? <WifiOff className="w-4 h-4 text-red-500" />
    : <CircleDot className="w-4 h-4 text-gray-400" />;

  const statusBadge = device.status === 'Online'
    ? 'badge-green'
    : device.status === 'Offline'
    ? 'badge-red'
    : 'badge-gray';

  const hasEtl = Boolean(device.etlUsername);
  const lastEtlStr = device.lastEtlSync
    ? new Date(device.lastEtlSync).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div className="card p-5 space-y-4 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{device.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{device.ip}:{device.port}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className={statusBadge}>
            {statusIcon}
            {device.status}
          </span>
          {device.autoSync && (
            <span className="badge-green">
              <Zap className="w-3 h-3" />
              Auto
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Serial No.</p>
          <p className="font-medium text-gray-700 dark:text-gray-300 text-xs truncate">{device.serialNumber}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Last Sync</p>
          <p className="font-medium text-gray-700 dark:text-gray-300 text-xs">
            {lastEtlStr || (device.lastSync
              ? new Date(device.lastSync).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
              : 'Never')}
          </p>
        </div>
      </div>

      {/* Only show lastError when not using auto-sync (ETL handles its own errors) */}
      {device.lastError && !device.autoSync && (
        <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2 truncate">{device.lastError}</p>
      )}
      {/* Show error from ETL sync for autoSync devices too */}
      {device.lastError && device.autoSync && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          <span className="font-medium">Sync error:</span>
          <span className="truncate flex-1">{device.lastError.includes('credentials') || device.lastError.includes('login') || device.lastError.includes('Invalid') ? 'Wrong portal credentials — click Configure to update' : device.lastError}</span>
          <button onClick={onConfigure} className="flex-shrink-0 underline font-medium">Fix</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleTest} disabled={testing} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
          Test
        </button>
        {hasEtl ? (
          <button onClick={handleSyncNow} disabled={syncing} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        ) : (
          <button onClick={onConfigure} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Settings className="w-3.5 h-3.5" />
            Configure
          </button>
        )}
        <button onClick={onManualImport} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
          <Upload className="w-3.5 h-3.5" />
          Import
        </button>
        <div className="ml-auto flex gap-1">
          <button onClick={onConfigure} title="Configure Live Sync" className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={onSyncFromDate} title="Sync from Date" className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <Calendar className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card w-full max-w-md p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [syncTarget, setSyncTarget] = useState<Device | null>(null);
  const [syncFromDate, setSyncFromDate] = useState('2026-04-01');
  const [syncing, setSyncing] = useState(false);
  // Configure Live Sync state
  const [configTarget, setConfigTarget] = useState<Device | null>(null);
  const [configForm, setConfigForm] = useState({ username: '', password: '', autoSync: true, syncInterval: '5', fetchFrom: '2026-04-01' });
  const [configuring, setConfiguring] = useState(false);
  const [testingLogin, setTestingLogin] = useState(false);
  const [loginTestResult, setLoginTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // Manual import state
  const [importTarget, setImportTarget] = useState<Device | null>(null);
  const [importData, setImportData] = useState('');
  const [importFromDate, setImportFromDate] = useState('2026-04-01');
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<DeviceForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Device[]>('/devices');
      setDevices(res.data);
    } catch {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  function openAdd() { setForm(defaultForm); setEditDevice(null); setShowModal(true); }
  function openEdit(d: Device) {
    setEditDevice(d);
    setForm({ name: d.name, ip: d.ip, port: String(d.port), serialNumber: d.serialNumber, username: d.username, password: '' });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editDevice) {
        await api.put(`/devices/${editDevice._id}`, { ...form, port: Number(form.port) });
        toast.success('Device updated');
      } else {
        await api.post('/devices', { ...form, port: Number(form.port) });
        toast.success('Device added');
      }
      setShowModal(false);
      fetchDevices();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSync(device: Device, fromDate?: string) {
    setSyncing(true);
    try {
      const body = fromDate ? { fromDate } : {};
      const res = await api.post(`/devices/${device._id}/sync`, body);
      toast.success(res.data.message || 'Sync complete');
      fetchDevices();
      setSyncTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Sync failed';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncNow(device: Device) {
    try {
      const res = await api.post(`/devices/${device._id}/sync-now`);
      toast.success(res.data.message || 'Sync complete');
      fetchDevices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Sync failed';
      toast.error(msg);
    }
  }

  async function handleTest(device: Device) {
    try {
      const res = await api.post(`/devices/${device._id}/test-connection`);
      if (res.data.online) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
      }
      fetchDevices();
    } catch {
      toast.error('Connection test failed');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/devices/${deleteTarget._id}`);
      toast.success('Device removed');
      setDeleteTarget(null);
      fetchDevices();
    } catch {
      toast.error('Delete failed');
    }
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">eSSL biometric device management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDevices} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Device
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && devices.length > 0 && (
        <div className="flex gap-4">
          <span className="badge-green">{devices.filter((d) => d.status === 'Online').length} Online</span>
          <span className="badge-red">{devices.filter((d) => d.status === 'Offline').length} Offline</span>
          <span className="badge-gray">{devices.filter((d) => d.status === 'Unknown').length} Unknown</span>
        </div>
      )}

      {/* Device cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-4">
              <div className="flex justify-between"><div className="skeleton h-5 w-32 rounded" /><div className="skeleton h-5 w-16 rounded" /></div>
              <div className="grid grid-cols-2 gap-3"><div className="skeleton h-8 rounded" /><div className="skeleton h-8 rounded" /></div>
              <div className="flex gap-2"><div className="skeleton h-8 w-20 rounded" /><div className="skeleton h-8 w-20 rounded" /></div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="card p-12 text-center">
          <Monitor className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No devices configured yet.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Add your first device</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <DeviceCard
              key={device._id}
              device={device}
              onSyncFromDate={() => { setSyncTarget(device); setSyncFromDate('2026-04-01'); }}
              onConfigure={() => {
                setConfigTarget(device);
                setConfigForm({
                  username: device.etlUsername || '',
                  password: '',
                  autoSync: device.autoSync ?? true,
                  syncInterval: String(device.syncInterval || 5),
                  fetchFrom: '2026-04-01',
                });
              }}
              onSyncNow={() => handleSyncNow(device)}
              onManualImport={() => { setImportTarget(device); setImportData(''); }}
              onTest={() => handleTest(device)}
              onEdit={() => openEdit(device)}
              onDelete={() => setDeleteTarget(device)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editDevice ? 'Edit Device' : 'Add Device'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Name</label>
              <input className="input" placeholder="Main Office Biometric" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address</label>
                <input className="input" placeholder="192.168.1.100" value={form.ip} onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))} required pattern="(\d{1,3}\.){3}\d{1,3}" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                <input type="number" className="input" placeholder="80" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} required min={1} max={65535} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
              <input className="input" placeholder="XXXXXXXX" value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!editDevice} placeholder={editDevice ? 'Leave blank to keep' : ''} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editDevice ? 'Save Changes' : 'Add Device'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Sync from Date Modal */}
      {syncTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="card w-full max-w-sm p-6 animate-slide-in space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Sync Attendance Data</h2>
              <button onClick={() => setSyncTarget(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Fetch all punch records from <strong className="text-gray-700 dark:text-gray-300">{syncTarget.name}</strong> starting on this date.
            </p>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
              <input
                type="date"
                className="input"
                value={syncFromDate}
                onChange={e => setSyncFromDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* iClock server info */}
            <div className="flex gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">For live data: configure device server URL</p>
                <p className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-[11px] break-all">
                  {window.location.protocol}//{window.location.hostname}:5000
                </p>
                <p className="text-blue-600 dark:text-blue-400">Device will push punch logs directly to this HRMS.</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setSyncTarget(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => handleSync(syncTarget, syncFromDate)}
                disabled={syncing || !syncFromDate}
                className="btn-primary flex items-center gap-2"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {syncing ? 'Syncing…' : 'Start Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Live Sync Modal */}
      {configTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="card w-full max-w-md p-6 animate-slide-in space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Configure Live Sync</h2>
              <button onClick={() => { setConfigTarget(null); setLoginTestResult(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your <strong className="text-gray-700 dark:text-gray-300">eTimeTrackLite</strong> web portal credentials for{' '}
              <strong className="text-gray-700 dark:text-gray-300">{configTarget.ip}:{configTarget.port}</strong>
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                <input className="input" placeholder="admin"
                  value={configForm.username}
                  onChange={e => setConfigForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password{configTarget.etlUsername ? ' (leave blank to keep current)' : ''}
                </label>
                <input type="password" className="input" placeholder="Web portal password"
                  value={configForm.password}
                  onChange={e => { setConfigForm(f => ({ ...f, password: e.target.value })); setLoginTestResult(null); }} />
              </div>

              {/* Test login button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={testingLogin || !configForm.username || !configForm.password}
                  onClick={async () => {
                    setTestingLogin(true);
                    setLoginTestResult(null);
                    try {
                      const res = await api.post(`/devices/${configTarget._id}/test-etl-credentials`, {
                        username: configForm.username,
                        password: configForm.password,
                      });
                      setLoginTestResult({ ok: true, msg: res.data.message });
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
                      setLoginTestResult({ ok: false, msg });
                    } finally {
                      setTestingLogin(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {testingLogin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  {testingLogin ? 'Testing…' : 'Test Login'}
                </button>
                {loginTestResult && (
                  <span className={`text-xs font-medium ${loginTestResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {loginTestResult.ok ? '✓ ' : '✗ '}{loginTestResult.msg}
                  </span>
                )}
              </div>
              {!loginTestResult && configForm.username && configForm.password && (
                <p className="text-xs text-gray-400">↑ Test your credentials before saving to avoid sync failures</p>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fetch historical data from</label>
                <input type="date" className="input" value={configForm.fetchFrom}
                  onChange={e => setConfigForm(f => ({ ...f, fetchFrom: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Auto-Sync</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Automatically fetch new punches every few minutes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigForm(f => ({ ...f, autoSync: !f.autoSync }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configForm.autoSync ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configForm.autoSync ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {configForm.autoSync && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sync every</label>
                  <select className="input" value={configForm.syncInterval}
                    onChange={e => setConfigForm(f => ({ ...f, syncInterval: e.target.value }))}>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                <p className="font-medium">What happens when you save:</p>
                <p>1. Credentials are saved securely (AES-encrypted)</p>
                <p>2. Employee list is synced from the device</p>
                <p>3. All punch data since {configForm.fetchFrom} is imported</p>
                {configForm.autoSync && <p>4. New punches will auto-sync every {configForm.syncInterval} min</p>}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfigTarget(null)} className="btn-secondary">Cancel</button>
              <button
                disabled={configuring || !configForm.username || (!configForm.password && !configTarget.etlUsername)}
                className="btn-primary flex items-center gap-2"
                onClick={async () => {
                  setConfiguring(true);
                  try {
                    const body: Record<string, unknown> = {
                      etlUsername: configForm.username,
                      autoSync: configForm.autoSync,
                      syncInterval: Number(configForm.syncInterval),
                      fetchFrom: configForm.fetchFrom,
                      syncEmployees: true,
                    };
                    if (configForm.password) body.etlPassword = configForm.password;
                    // If no new password and credentials already saved, use empty string to trigger saved-creds path
                    else if (!configTarget.etlUsername) {
                      toast.error('Password is required');
                      setConfiguring(false);
                      return;
                    } else {
                      // re-save with existing password — fetch then re-encrypt (not ideal; require password re-entry instead)
                      toast.error('Please re-enter your password to update settings');
                      setConfiguring(false);
                      return;
                    }
                    const res = await api.post(`/devices/${configTarget._id}/configure-etl`, body);
                    toast.success(res.data.message || 'Configuration saved! Backfill running in background.');
                    setConfigTarget(null);
                    fetchDevices();
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Configuration failed';
                    toast.error(msg);
                  } finally { setConfiguring(false); }
                }}
              >
                {configuring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                {configuring ? 'Saving…' : 'Save & Start Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Import Modal */}
      {importTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="card w-full max-w-lg p-6 animate-slide-in space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Manual Import</h2>
              <button onClick={() => setImportTarget(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Paste attendance log data exported from eTimeTrackLite or your device.
            </p>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Date (filter)</label>
              <input type="date" className="input" value={importFromDate}
                onChange={e => setImportFromDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attendance Data</label>
              <textarea
                className="input font-mono text-xs resize-none"
                rows={8}
                placeholder={'Paste tab-delimited lines here:\n1001\t2026-04-01 09:05:00\t1\t0\n1001\t2026-04-01 18:30:00\t1\t1\n1002\t2026-04-02 08:58:00\t1\t0'}
                value={importData}
                onChange={e => setImportData(e.target.value)}
              />
              <p className="text-xs text-gray-400">Format: <span className="font-mono">PIN {'\t'} Date Time {'\t'} VerifyType {'\t'} PunchType</span></p>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setImportTarget(null)} className="btn-secondary">Cancel</button>
              <button
                disabled={importing || !importData.trim()}
                className="btn-primary flex items-center gap-2"
                onClick={async () => {
                  setImporting(true);
                  try {
                    const res = await api.post(`/devices/${importTarget._id}/manual-import`, {
                      data: importData,
                      fromDate: importFromDate,
                    });
                    toast.success(res.data.message);
                    setImportTarget(null);
                    fetchDevices();
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Import failed';
                    toast.error(msg);
                  } finally { setImporting(false); }
                }}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import Records'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="card w-full max-w-sm p-6 animate-slide-in">
            <p className="text-gray-700 dark:text-gray-300 mb-5">Remove <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Monitor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={2} />
      <path d="M8 21h8M12 17v4" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
