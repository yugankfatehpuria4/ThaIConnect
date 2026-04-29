'use client';
import { useState, useEffect } from 'react';
import { Users, Search, Filter, Trash2, Edit3, ChevronDown, Shield, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type User = {
  _id: string;
  name: string;
  email?: string;
  role: 'patient' | 'donor' | 'admin';
  bloodGroup?: string;
  avail?: string;
  donationsCount?: number;
  score?: number;
  createdAt?: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    const token = localStorage.getItem('token') || '';
    if (!token) {
      setAccessError('Please login as admin to view users.');
      setLoading(false);
      router.replace('/login');
      return;
    }

    fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          setAccessError('Session expired. Please login again.');
          localStorage.removeItem('token');
          router.replace('/login');
          return [];
        }
        if (res.status === 403) {
          setAccessError('Admin access required for this page.');
          return [];
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Delete failed');
      }
      setUsers(prev => prev.filter(u => u._id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u._id === id ? { ...u, ...updated } : u));
      }
    } catch (e) {
      console.error('Update failed', e);
    }
    setEditingUser(null);
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    patients: users.filter(u => u.role === 'patient').length,
    donors: users.filter(u => u.role === 'donor').length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  const roleChipClass = (role: string) => {
    if (role === 'patient') return 'chip-amber';
    if (role === 'donor') return 'chip-blue';
    if (role === 'admin') return 'chip-green';
    return 'chip-red';
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">View, edit, and manage all platform users</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-xs text-gray-400 font-medium">Total Users</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <div className="text-2xl font-bold text-amber">{stats.patients}</div>
          <div className="text-xs text-gray-400 font-medium">Patients</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <div className="text-2xl font-bold text-blue">{stats.donors}</div>
          <div className="text-xs text-gray-400 font-medium">Donors</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <div className="text-2xl font-bold text-green">{stats.admins}</div>
          <div className="text-xs text-gray-400 font-medium">Administrators</div>
        </div>
      </div>

      {/* Filters */}
      {accessError && (
        <div className="chip chip-red w-fit">{accessError}</div>
      )}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search users by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-red transition-colors"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red transition-colors bg-white"
          >
            <option value="all">All Roles</option>
            <option value="patient">Patients</option>
            <option value="donor">Donors</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-red-glow border-t-red rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-gray-500">Loading users...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No users found.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-[11px] text-gray-400 uppercase border-b border-gray-100">
              <tr>
                <th className="pb-3 font-semibold">User</th>
                <th className="pb-3 font-semibold">Email</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Blood Group</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {filteredUsers.map(user => (
                <tr key={user._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-red-glow text-red font-bold text-xs flex items-center justify-center shrink-0">
                        {user.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-[10px] text-gray-400">ID: #{String(user._id).slice(-6)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-500">{user.email || '—'}</td>
                  <td className="py-3">
                    <span className={`chip ${roleChipClass(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-red">{user.bloodGroup || '—'}</td>
                  <td className="py-3">
                    <span className={`chip ${user.avail === 'Available' ? 'chip-green' : user.avail === 'Maybe' ? 'chip-amber' : 'chip-red'}`}>
                      <span className="chip-dot"></span>{user.avail || 'Active'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="bg-blue-bg text-blue px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-blue/20 transition-colors"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user._id)}
                        className="bg-red-glow text-red px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-red/20 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-xs text-gray-400 text-right">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-600">{editingUser.name}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-600">{editingUser.email || '—'}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Role</label>
                <select
                  defaultValue={editingUser.role}
                  id="edit-role-select"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red bg-white"
                >
                  <option value="patient">Patient</option>
                  <option value="donor">Donor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
              <button
                onClick={() => {
                  const select = document.getElementById('edit-role-select') as HTMLSelectElement;
                  handleUpdateRole(editingUser._id, select.value);
                }}
                className="flex-1 py-2.5 bg-red text-white rounded-xl text-sm font-semibold hover:bg-red-dark transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-glow rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone. The user and all their data will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-red text-white rounded-xl text-sm font-semibold hover:bg-red-dark transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
