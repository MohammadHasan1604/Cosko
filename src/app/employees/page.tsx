'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  role: string;
  store: string;
  email: string;
  phone: string;
  status: 'On Shift' | 'Off Shift' | 'On Leave';
  shiftTime: string;
}

const initialEmployees: Employee[] = [
  { id: 'emp-1', name: 'Arjun Mehta', role: 'Super Admin', store: 'BLR', email: 'cosko@gmail.com', phone: '+91 98765 00000', status: 'On Shift', shiftTime: '09:00 AM - 06:00 PM' },
  { id: 'emp-2', name: 'Sneha Patel', role: 'Store Manager', store: 'BLR', email: 'sneha@cosko.com', phone: '+91 80 2555 1234', status: 'On Shift', shiftTime: '09:00 AM - 06:00 PM' },
  { id: 'emp-3', name: 'Karan Verma', role: 'POS Cashier', store: 'HYD', email: 'karan@cosko.com', phone: '+91 40 6677 8899', status: 'On Shift', shiftTime: '10:00 AM - 07:00 PM' },
  { id: 'emp-4', name: 'Rohan Sharma', role: 'Inventory Auditor', store: 'DEL', email: 'rohan@cosko.com', phone: '+91 11 4100 9988', status: 'On Leave', shiftTime: 'Off Duty' },
];

export default function EmployeesPage() {
  const { currentUser, selectedStore, addUserAccount, storesList } = useApp();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<Employee | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Store Manager' | 'POS Cashier' | 'Inventory Auditor' | 'Sales Executive'>('Store Manager');
  const [store, setStore] = useState('BLR');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shiftTime, setShiftTime] = useState('09:00 AM - 06:00 PM');

  const filteredEmployees = employees.filter((e) => {
    // Hide Super Admin employee records from lower-level roles
    if (e.role === 'Super Admin' && currentUser.role !== 'Super Admin') return false;
    // Filter by store location for Store Managers & staff
    if (currentUser.role !== 'Super Admin') {
      return e.store === currentUser.store;
    }
    return selectedStore === 'All Stores' ? true : e.store === selectedStore;
  });

  const toggleShiftStatus = (id: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === id) {
          const nextStatus = emp.status === 'On Shift' ? 'On Leave' : 'On Shift';
          toast.success(`${emp.name} marked as ${nextStatus}`);
          return { ...emp, status: nextStatus, shiftTime: nextStatus === 'On Shift' ? '09:00 AM - 06:00 PM' : 'Off Duty' };
        }
        return emp;
      })
    );
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Full Name, Email, and Account Password are required');
      return;
    }

    if ((role as string) === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Only Super Admins can register Level 100 Super Admin accounts.');
      return;
    }

    const employeeEmail = email.trim().toLowerCase();

    // 1. Create Employee HR Roster Record
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name,
      role,
      store,
      email: employeeEmail,
      phone: phone || '+91 99000 12345',
      status: 'On Shift',
      shiftTime,
    };
    setEmployees((prev) => [newEmp, ...prev]);

    // 2. Create User Account Credentials in AppContext
    addUserAccount({
      name,
      email: employeeEmail,
      password,
      phone: phone || '+91 99000 12345',
      role: role as any,
      store,
      allowedStores: [store],
      status: 'Active',
      shiftStatus: 'On Shift',
    });

    setAddModal(false);
    resetForm();
    toast.success(`Registered employee & login user account for ${name}`);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === editModal.id ? { ...emp, name, role, store, email, phone, shiftTime } : emp))
    );
    setEditModal(null);
    resetForm();
    toast.success('Employee details updated');
  };

  const deleteEmp = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    toast.success('Employee removed from roster');
  };

  const openEdit = (emp: Employee) => {
    setEditModal(emp);
    setName(emp.name);
    setRole(emp.role as any);
    setStore(emp.store);
    setEmail(emp.email);
    setPhone(emp.phone);
    setShiftTime(emp.shiftTime);
  };

  const resetForm = () => {
    setName('');
    setRole('Store Manager');
    setStore('BLR');
    setEmail('');
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setShiftTime('09:00 AM - 06:00 PM');
  };

  return (
    <AppLayout activeRoute="/employees">
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employee Roster & Attendance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Staff management, shift schedules, active location assignments, and login credential provisioning.
            </p>
          </div>

          <button onClick={() => { resetForm(); setAddModal(true); }} className="btn-primary gap-2">
            <Icon name="UserPlusIcon" size={18} />
            Register Team Member
          </button>
        </div>

        {/* Employee Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div key={`emp-card-${emp.id}`} className="card p-4 space-y-3 relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm">{emp.name}</h3>
                  <span className="badge-warning text-3xs font-semibold mt-1 inline-block">{emp.role}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(emp)} className="p-1 text-muted-foreground hover:text-primary" title="Edit employee">
                    <Icon name="PencilSquareIcon" size={15} />
                  </button>
                  <button onClick={() => deleteEmp(emp.id)} className="p-1 text-muted-foreground hover:text-danger" title="Remove employee">
                    <Icon name="TrashIcon" size={15} />
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-muted-foreground border-y border-border py-3">
                <p><strong className="text-foreground">Store Location:</strong> <span className="badge-info text-3xs font-mono font-bold">{emp.store}</span></p>
                <p><strong className="text-foreground">Email:</strong> {emp.email}</p>
                <p><strong className="text-foreground">Phone:</strong> {emp.phone}</p>
                <p><strong className="text-foreground">Shift Schedule:</strong> {emp.shiftTime}</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-2xs text-muted-foreground font-semibold">Current Shift Status:</span>
                <button
                  onClick={() => toggleShiftStatus(emp.id)}
                  className={`btn-ghost text-xs px-2.5 py-1 ${
                    emp.status === 'On Shift' ? 'text-success font-bold' : 'text-warning font-bold'
                  }`}
                >
                  ● {emp.status} (Click to toggle)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Register Employee & Account Credentials Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Register New Team Member" subtitle="Create employee record and login credentials" size="md">
        <form onSubmit={handleAddSubmit} className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Full Name *</label>
              <input type="text" required placeholder="Pooja Deshmukh" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Role Title *</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field text-xs font-medium">
                <option value="Store Manager">Store Manager (Level 80)</option>
                <option value="Inventory Auditor">Inventory Auditor (Level 60)</option>
                <option value="POS Cashier">POS Cashier (Level 20)</option>
                <option value="Sales Executive">Sales Executive (Level 20)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Store Outlet *</label>
              <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                {storesList.map((s) => (
                  <option key={`st-opt-${s.code}`} value={s.code}>{s.code} — {s.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
              <input type="text" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          {/* Email Address & Password Credentials Section */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email Address (Login ID) *</label>
              <input type="email" required placeholder="pooja@cosko.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Account Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Set account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={14} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Shift Schedule</label>
            <input type="text" placeholder="09:00 AM - 06:00 PM" value={shiftTime} onChange={(e) => setShiftTime(e.target.value)} className="input-field text-xs" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Register Employee & Create Account</button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      {editModal && (
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Employee Details" size="md">
          <form onSubmit={handleEditSubmit} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Role Title</label>
                <input type="text" value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
