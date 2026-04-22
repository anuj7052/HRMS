import { useState, useEffect, useCallback } from 'react';
import { Mail, Building2, Phone, Calendar, Shield, Key, Loader2, CheckCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import type { Employee, LeaveBalance } from '../types';

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoadingEmp(true);
    try {
      const res = await api.get<Employee>('/employees/profile');
      setEmployee(res.data);
      try {
        const balRes = await api.get<LeaveBalance[]>(`/leaves/balance/${res.data._id}`);
        setBalances(balRes.data);
      } catch {
        // Employee may not have leave data set up yet
      }
    } catch {
      // Admin/HR may not have an employee profile
    } finally {
      setLoadingEmp(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!passwordForm.currentPassword) errors.currentPassword = 'Required';
    if (passwordForm.newPassword.length < 8) errors.newPassword = 'Min 8 characters';
    if (
      !/[A-Z]/.test(passwordForm.newPassword) ||
      !/\d/.test(passwordForm.newPassword)
    ) {
      errors.newPassword = 'Must include an uppercase letter and number';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update password'
      );
    } finally {
      setChangingPassword(false);
    }
  }

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  return (
    <div className="space-y-6 pb-20 lg:pb-0 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>

      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-xl shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</h2>
            {loadingEmp ? (
              <div className="skeleton h-4 w-32 rounded mt-1" />
            ) : (
              employee && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  {employee.designation}
                </p>
              )
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                {user?.role}
              </span>
              {employee && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {employee.employeeId}
                </span>
              )}
              {employee && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    employee.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {employee.isActive ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={Mail} label="Email" value={user?.email || '—'} />
          {employee?.phone && <InfoRow icon={Phone} label="Phone" value={employee.phone} />}
          {(employee?.department || user?.department) && (
            <InfoRow
              icon={Building2}
              label="Department"
              value={employee?.department || user?.department || '—'}
            />
          )}
          {employee?.joinDate && (
            <InfoRow
              icon={Calendar}
              label="Joined"
              value={new Date(employee.joinDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          )}
          {employee?.shift && <InfoRow icon={Shield} label="Shift" value={employee.shift} />}
        </div>
      </div>

      {/* Leave balances */}
      {balances.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Leave Balance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {balances.map((b) => (
              <div key={b._id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {b.leaveTypeId.name}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{b.remaining}</p>
                <p className="text-xs text-gray-400">of {b.allocated} days</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change password */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Key className="w-4 h-4 text-primary-600" />
          Change Password
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Must be at least 8 characters with an uppercase letter and number.
        </p>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              className={`input ${passwordErrors.currentPassword ? 'border-red-500' : ''}`}
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
              }
            />
            {passwordErrors.currentPassword && (
              <p className="text-red-500 text-xs mt-1">{passwordErrors.currentPassword}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              className={`input ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
            {passwordErrors.newPassword && (
              <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              className={`input ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
            />
            {passwordErrors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="btn-primary flex items-center gap-2"
          >
            {changingPassword ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
