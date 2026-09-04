'use client';
import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';
import StockAdjustmentForm from './StockAdjustmentForm';
import AddItemModal from './AddItemModal';
import ProductDetailModal from './ProductDetailModal';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import { useApp, InventoryItem } from '@/context/AppContext';
import { toast } from 'sonner';

type SortKey = keyof InventoryItem;

const ALL_COLUMNS = [
  { key: 'sku', label: 'SKU', visible: true },
  { key: 'name', label: 'Item Name', visible: true },
  { key: 'brand', label: 'Brand', visible: true },
  { key: 'category', label: 'Category', visible: true },
  { key: 'store', label: 'Store', visible: true },
  { key: 'qtyOnHand', label: 'Qty on Hand', visible: true },
  { key: 'reorderPt', label: 'Reorder Pt', visible: true },
  { key: 'costPrice', label: 'Cost Price', visible: true },
  { key: 'sellingPrice', label: 'Sell Price', visible: true },
  { key: 'mrp', label: 'MRP', visible: true },
  { key: 'hsn', label: 'HSN', visible: false },
  { key: 'taxRate', label: 'Tax %', visible: true },
  { key: 'fifoLots', label: 'FIFO Lots', visible: false },
  { key: 'status', label: 'Status', visible: true },
  { key: 'lastMovement', label: 'Last Movement', visible: false },
];

const STATUSES = ['All Status', 'Active', 'Inactive', 'Low Stock', 'Out of Stock'];

function getStockStatus(item: InventoryItem) {
  if (item.qtyOnHand === 0) return { variant: 'out-of-stock' as const, label: 'Out of Stock' };
  if (item.qtyOnHand <= item.reorderPt) return { variant: 'low-stock' as const, label: 'Low Stock' };
  if (item.status === 'inactive') return { variant: 'inactive' as const, label: 'Inactive' };
  return { variant: 'active' as const, label: 'Active' };
}

export default function InventoryTable() {
  const { inventory, deleteItem: removeInventoryItem, updateItem, selectedStore, categoriesList, storesList, currentUser, sales, inventoryLedger } = useApp();

  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState(selectedStore);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columnConfig, setColumnConfig] = useState(ALL_COLUMNS);
  const [colVisOpen, setColVisOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [deleteItemModal, setDeleteItemModal] = useState<InventoryItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  React.useEffect(() => {
    setStoreFilter(selectedStore);
  }, [selectedStore]);

  const visibleColumns = columnConfig.filter((c) => c.visible);

  const filtered = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch =
        search === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        (item.barcode && item.barcode.includes(search)) ||
        item.brand.toLowerCase().includes(search.toLowerCase());

      const matchStore = storeFilter === 'All Stores' || item.store === storeFilter;
      const matchCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;

      const stockSt = getStockStatus(item);
      const matchStatus =
        statusFilter === 'All Status' ||
        (statusFilter === 'Active' && stockSt.variant === 'active') ||
        (statusFilter === 'Inactive' && item.status === 'inactive') ||
        (statusFilter === 'Low Stock' && stockSt.variant === 'low-stock') ||
        (statusFilter === 'Out of Stock' && stockSt.variant === 'out-of-stock');

      return matchSearch && matchStore && matchCategory && matchStatus;
    });
  }, [inventory, search, storeFilter, categoryFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((i) => i.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => removeInventoryItem(id));
    setSelectedIds(new Set());
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItemModal) return;
    setDeleteLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    removeInventoryItem(deleteItemModal.id);
    setDeleteLoading(false);
    setDeleteItemModal(null);
  };

  const handleStatusChange = (itemId: string, newStatus: 'active' | 'inactive' | 'discontinued') => {
    setStatusDropdownId(null);
    updateItem(itemId, { status: newStatus });
  };

  const toggleColumn = (key: string) => {
    setColumnConfig((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <Icon name="ChevronUpDownIcon" size={12} className="text-muted-foreground opacity-50" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUpIcon" size={12} className="text-primary" />
      : <Icon name="ChevronDownIcon" size={12} className="text-primary" />;
  };

  return (
    <>
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 flex-wrap">
          {/* Search with Barcode Scanner button */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-md">
            <div className="relative flex-1">
              <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, SKU, barcode..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="btn-secondary py-2 px-3 text-xs gap-1.5 font-bold text-foreground"
              title="Scan Barcode with Camera or USB Scanner"
            >
              <Icon name="QrCodeIcon" size={16} />
              Scan
            </button>
          </div>

          {/* Location filter */}
          <select
            value={storeFilter}
            onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}
            disabled={currentUser.role !== 'Super Admin'}
            className="input-field py-2 text-sm w-auto min-w-[200px]"
          >
            {currentUser.role === 'Super Admin' && (
              <optgroup label="Reporting Scope">
                <option value="All Stores">All Locations (Consolidated View)</option>
              </optgroup>
            )}
            <optgroup label="Physical Warehouses & Stores">
              {[...storesList]
                .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                .map((s) => (
                  <option key={`store-opt-${s.code}`} value={s.code}>
                    {s.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${s.name} (${s.code})`}
                  </option>
                ))}
            </optgroup>
          </select>

          {/* Dynamic Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="input-field py-2 text-sm w-auto min-w-[160px]"
          >
            <option value="All Categories">All Categories</option>
            {categoriesList.filter((c) => c.status === 'Active').map((c) => (
              <option key={`cat-opt-${c.id}`} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field py-2 text-sm w-auto min-w-[140px]"
          >
            {STATUSES.map((s) => <option key={`status-opt-${s}`} value={s}>{s}</option>)}
          </select>

          <div className="flex-1" />

          {/* Column visibility */}
          <div className="relative">
            <button
              onClick={() => setColVisOpen((v) => !v)}
              className="btn-ghost text-sm gap-1.5"
            >
              <Icon name="ViewColumnsIcon" size={15} />
              Columns
            </button>
            {colVisOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-modal z-30 py-2 fade-in">
                <p className="px-4 py-1.5 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">Toggle Columns</p>
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={`col-toggle-${col.key}`}
                    className="flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-muted transition-colors duration-100"
                  >
                    <input
                      type="checkbox"
                      checked={columnConfig.find((c) => c.key === col.key)?.visible ?? false}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3.5 h-3.5 accent-primary rounded"
                    />
                    <span className="text-sm text-foreground">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/20 flex items-center gap-3 slide-up">
            <span className="text-sm font-semibold text-primary">
              {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex-1" />
            <button
              className="btn-ghost text-sm gap-1.5"
              onClick={() => setSelectedIds(new Set())}
            >
              <Icon name="XMarkIcon" size={14} />
              Deselect
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-danger hover:bg-danger/10 transition-all duration-150 active:scale-95"
              onClick={handleBulkDelete}
            >
              <Icon name="TrashIcon" size={14} />
              Delete Selected
            </button>
          </div>
        )}

        {/* Mobile Product Cards (<md) */}
        <div className="block md:hidden divide-y divide-border">
          {paginated.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Icon name="CubeIcon" size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No inventory items found</p>
            </div>
          ) : (
            paginated.map((item) => {
              const stockStatus = getStockStatus(item);
              const isSelected = selectedIds.has(item.id);

              return (
                <div key={`m-inv-${item.id}-${item.store}`} className={`p-4 space-y-3 bg-card hover:bg-muted/10 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden border border-border flex items-center justify-center flex-shrink-0">
                        {item.primaryImage || (item.images && item.images[0]) ? (
                          <img src={item.primaryImage || item.images![0]} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="CubeIcon" size={20} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-3xs text-muted-foreground">{item.sku}</span>
                          <span className="badge-info text-3xs font-mono">{item.store}</span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground truncate">{item.name}</h4>
                        <p className="text-2xs text-muted-foreground">{item.brand} · {item.category}</p>
                      </div>
                    </div>

                    <StatusBadge variant={stockStatus.variant} label={stockStatus.label} />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-2xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Stock: <strong className="text-foreground font-tabular">{item.qtyOnHand} units</strong></span>
                    <span className="font-extrabold font-tabular text-foreground">₹{item.sellingPrice.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button onClick={() => setViewItem(item)} className="btn-ghost text-3xs py-1 px-2 text-info">
                      <Icon name="EyeIcon" size={13} /> View
                    </button>
                    <button onClick={() => setAdjustItem(item)} className="btn-ghost text-3xs py-1 px-2 text-warning">
                      <Icon name="AdjustmentsHorizontalIcon" size={13} /> Adjust Stock
                    </button>
                    <button onClick={() => setEditItem(item)} className="btn-ghost text-3xs py-1 px-2 text-primary">
                      <Icon name="PencilSquareIcon" size={13} /> Edit
                    </button>
                    <button onClick={() => setDeleteItemModal(item)} className="btn-ghost text-3xs py-1 px-2 text-danger">
                      <Icon name="TrashIcon" size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Inventory Table (>=md) */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-muted">
                {/* Checkbox */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selectedIds.size === paginated.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 accent-primary rounded"
                    aria-label="Select all rows"
                  />
                </th>

                {visibleColumns.map((col) => (
                  <th
                    key={`th-${col.key}`}
                    className="table-header"
                    onClick={() => handleSort(col.key as SortKey)}
                  >
                    <span className="flex items-center gap-1.5 cursor-pointer select-none">
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </span>
                  </th>
                ))}

                {/* Actions col */}
                <th className="table-header w-28 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2}>
                    <EmptyState
                      icon="CubeIcon"
                      title="No inventory items found"
                      description="No items match your current filters. Try adjusting the search or filter criteria, or add a new item to get started."
                      actionLabel="Add Item"
                      onAction={() => setAddModalOpen(true)}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr
                      key={`row-${item.id}-${item.store}`}
                      className={`table-row group ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(item.id)}
                          className="w-4 h-4 accent-primary rounded"
                          aria-label={`Select ${item.name}`}
                        />
                      </td>

                      {/* Dynamic columns */}
                      {visibleColumns.map((col) => {
                        const val = item[col.key as keyof InventoryItem];

                        if (col.key === 'sku') return (
                          <td key={`cell-${item.id}-sku`} className="table-cell">
                            <div>
                              <span className="font-mono text-xs font-semibold text-foreground">{item.sku}</span>
                              <p className="text-2xs text-muted-foreground mt-0.5">{item.barcode}</p>
                            </div>
                          </td>
                        );

                        if (col.key === 'name') return (
                          <td key={`cell-${item.id}-name`} className="table-cell max-w-[240px]">
                            <div className="flex items-center gap-2.5">
                              {item.primaryImage || (item.images && item.images[0]) ? (
                                <img src={item.primaryImage || item.images![0]} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-border flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs flex-shrink-0">
                                  {item.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p
                                  onClick={() => setViewItem(item)}
                                  className="text-sm font-medium text-foreground hover:text-primary cursor-pointer truncate"
                                  title={item.name}
                                >
                                  {item.name}
                                </p>
                                <p className="text-2xs text-muted-foreground mt-0.5">{item.subcategory}</p>
                              </div>
                            </div>
                          </td>
                        );

                        if (col.key === 'qtyOnHand') return (
                          <td key={`cell-${item.id}-qty`} className="table-cell">
                            <div className="flex items-center gap-2">
                              <span className={`font-tabular font-semibold text-sm ${item.qtyOnHand === 0 ? 'text-danger' : item.qtyOnHand <= item.reorderPt ? 'text-warning' : 'text-foreground'}`}>
                                {item.qtyOnHand}
                              </span>
                              {item.qtyOnHand <= item.reorderPt && item.qtyOnHand > 0 && (
                                <Icon name="ExclamationTriangleIcon" size={12} className="text-warning" />
                              )}
                              {item.qtyOnHand === 0 && (
                                <Icon name="XCircleIcon" size={12} className="text-danger" />
                              )}
                            </div>
                          </td>
                        );

                        if (col.key === 'costPrice') return (
                          <td key={`cell-${item.id}-cost`} className="table-cell">
                            <span className="font-tabular text-sm">₹{item.costPrice.toLocaleString('en-IN')}</span>
                          </td>
                        );

                        if (col.key === 'sellingPrice') return (
                          <td key={`cell-${item.id}-sell`} className="table-cell">
                            <span className="font-tabular text-sm font-medium">₹{item.sellingPrice.toLocaleString('en-IN')}</span>
                          </td>
                        );

                        if (col.key === 'mrp') return (
                          <td key={`cell-${item.id}-mrp`} className="table-cell">
                            <span className="font-tabular text-sm text-muted-foreground">₹{item.mrp.toLocaleString('en-IN')}</span>
                          </td>
                        );

                        if (col.key === 'taxRate') return (
                          <td key={`cell-${item.id}-tax`} className="table-cell">
                            <span className="font-tabular text-sm">{item.taxRate}%</span>
                          </td>
                        );

                        if (col.key === 'fifoLots') return (
                          <td key={`cell-${item.id}-fifo`} className="table-cell">
                            <span className={`font-tabular text-sm ${item.fifoLots === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {item.fifoLots} lot{item.fifoLots !== 1 ? 's' : ''}
                            </span>
                          </td>
                        );

                        if (col.key === 'store') return (
                          <td key={`cell-${item.id}-store`} className="table-cell">
                            <span className="badge-info text-2xs">{item.store}</span>
                          </td>
                        );

                        if (col.key === 'status') return (
                          <td key={`cell-${item.id}-status`} className="table-cell relative">
                            <button
                              onClick={() => setStatusDropdownId(statusDropdownId === item.id ? null : item.id)}
                              className="flex items-center gap-1 group"
                              aria-label={`Change status for ${item.name}`}
                            >
                              <StatusBadge variant={stockStatus.variant} label={stockStatus.label} dot />
                              <Icon name="ChevronDownIcon" size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            {statusDropdownId === item.id && (
                              <div className="absolute left-0 top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-modal z-30 py-1 fade-in">
                                {(['active', 'inactive', 'discontinued'] as const).map((s) => (
                                  <button
                                    key={`status-change-${item.id}-${s}`}
                                    onClick={() => handleStatusChange(item.id, s)}
                                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted capitalize transition-colors duration-100"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        );

                        return (
                          <td key={`cell-${item.id}-${col.key}`} className="table-cell">
                            <span className="text-sm text-foreground">{String(val)}</span>
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="table-cell text-right pr-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => setAdjustItem(item)}
                            className="p-1.5 rounded-lg hover:bg-warning/10 text-muted-foreground hover:text-warning transition-all duration-150"
                            title={`Adjust stock for ${item.name}`}
                          >
                            <Icon name="AdjustmentsHorizontalIcon" size={15} />
                          </button>
                          <button
                            onClick={() => setEditItem(item)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-150"
                            title={`Edit ${item.name}`}
                          >
                            <Icon name="PencilSquareIcon" size={15} />
                          </button>
                          <button
                            onClick={() => setViewItem(item)}
                            className="p-1.5 rounded-lg hover:bg-info/10 text-muted-foreground hover:text-info transition-all duration-150"
                            title={`View details for ${item.name}`}
                          >
                            <Icon name="EyeIcon" size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteItemModal(item)}
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-all duration-150"
                            title={`Delete ${item.name}`}
                          >
                            <Icon name="TrashIcon" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sorted.length > 0 && (
          <div className="px-4 py-3.5 border-t border-border flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground font-tabular">{(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)}</span> of <span className="font-semibold text-foreground font-tabular">{sorted.length}</span> items
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page:</span>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="input-field py-1 text-sm w-16"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={`perpage-${n}`} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="btn-ghost p-2 disabled:opacity-40"
              >
                <Icon name="ChevronDoubleLeftIcon" size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost p-2 disabled:opacity-40"
              >
                <Icon name="ChevronLeftIcon" size={14} />
              </button>

              <span className="px-3 text-sm font-semibold text-foreground">Page {page} of {totalPages}</span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-2 disabled:opacity-40"
              >
                <Icon name="ChevronRightIcon" size={14} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="btn-ghost p-2 disabled:opacity-40"
              >
                <Icon name="ChevronDoubleRightIcon" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {adjustItem && (
        <Modal
          open={!!adjustItem}
          onClose={() => setAdjustItem(null)}
          title="Stock Adjustment"
          subtitle={`${adjustItem.sku} · ${adjustItem.name}`}
          size="md"
        >
          <StockAdjustmentForm
            item={adjustItem}
            onClose={() => setAdjustItem(null)}
          />
        </Modal>
      )}

      {/* Add / Edit Modal */}
      <AddItemModal
        open={addModalOpen || !!editItem}
        onClose={() => { setAddModalOpen(false); setEditItem(null); }}
        editItem={editItem}
      />

      {/* Product Detail Record Modal */}
      <ProductDetailModal
        item={viewItem}
        onClose={() => setViewItem(null)}
      />

      {/* Safe Delete / Archive Confirm Modal */}
      {deleteItemModal && (
        <Modal
          open={!!deleteItemModal}
          onClose={() => !deleteLoading && setDeleteItemModal(null)}
          title={`Archive / Delete Product "${deleteItemModal.name}"`}
          subtitle={`SKU: ${deleteItemModal.sku} · Store: ${deleteItemModal.store}`}
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            {(() => {
              const hasLedger = inventoryLedger ? inventoryLedger.some((l) => l.productId === deleteItemModal.id || l.sku === deleteItemModal.sku) : false;
              const hasSales = sales ? sales.some((s) => s.items.some((it) => it.itemId === deleteItemModal.id || it.name === deleteItemModal.name)) : false;
              const hasHistory = hasLedger || hasSales || deleteItemModal.qtyOnHand > 0;

              return (
                <>
                  <div className={`p-4 rounded-xl border ${hasHistory ? 'bg-warning/10 border-warning/30 text-foreground' : 'bg-muted/40 border-border text-foreground'}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon name={hasHistory ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'} size={18} className={hasHistory ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'} />
                      <div>
                        <p className="font-bold text-sm">
                          {hasHistory ? 'Product Has Stock / Sales History' : 'Unused Product Catalog Entry'}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {hasHistory
                            ? `This product has existing stock (${deleteItemModal.qtyOnHand} units) or historical sales/movement transactions. To maintain accounting integrity, it will be safely Archived (hidden from active catalog and POS checkout).`
                            : `This product has 0 inventory movements and 0 sales. You can archive it safely, or permanently delete it.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                    <button
                      type="button"
                      disabled={deleteLoading}
                      onClick={() => setDeleteItemModal(null)}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={deleteLoading}
                      onClick={async () => {
                        setDeleteLoading(true);
                        try {
                          await removeInventoryItem(deleteItemModal.id, false);
                          setDeleteItemModal(null);
                        } finally {
                          setDeleteLoading(false);
                        }
                      }}
                      className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4"
                    >
                      {deleteLoading ? 'Archiving...' : 'Safe Archive'}
                    </button>

                    {!hasHistory && currentUser.role === 'Super Admin' && (
                      <button
                        type="button"
                        disabled={deleteLoading}
                        onClick={async () => {
                          setDeleteLoading(true);
                          try {
                            await removeInventoryItem(deleteItemModal.id, true);
                            setDeleteItemModal(null);
                          } finally {
                            setDeleteLoading(false);
                          }
                        }}
                        className="btn-danger text-xs font-bold px-4"
                      >
                        {deleteLoading ? 'Deleting...' : 'Permanent Delete'}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(code) => {
            setSearch(code);
            setPage(1);
            const found = inventory.find((i) => (i.barcode && i.barcode === code) || i.sku === code);
            if (found) {
              toast.success(`Found matching product: "${found.name}" (${found.sku})`);
            } else {
              toast.info(`Scanned code: ${code}. No direct match found.`);
            }
          }}
          title="Scan Product Barcode"
          subtitle="Scan retail packaging barcode to instantly filter product inventory."
        />
      )}
    </>
  );
}