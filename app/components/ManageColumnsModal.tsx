"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  GripVertical,
  Check,
} from "lucide-react";

export interface ColumnItem {
  id: string;
  label: string;
}

interface ManageColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allColumns: ColumnItem[];
  visibleColumns: Record<string, boolean>;
  columnOrder: string[];
  pinnedColumns?: string[];
  onApply: (
    newVisible: Record<string, boolean>,
    newOrder: string[],
    newPinned?: string[]
  ) => void;
  onRestoreDefault: () => void;
}

export default function ManageColumnsModal({
  isOpen,
  onClose,
  allColumns,
  visibleColumns,
  columnOrder,
  pinnedColumns = [],
  onApply,
  onRestoreDefault,
}: ManageColumnsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tempVisible, setTempVisible] = useState<Record<string, boolean>>({});
  const [tempOrder, setTempOrder] = useState<string[]>([]);

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTempVisible({ ...visibleColumns });

      // Build initial order: preserve existing columnOrder, add any missing columns at the end
      const currentOrder = [...columnOrder];
      allColumns.forEach((c) => {
        if (!currentOrder.includes(c.id)) {
          currentOrder.push(c.id);
        }
      });
      setTempOrder(currentOrder);
      setSearchQuery("");
      setDraggedId(null);
      setDragOverId(null);
    }
  }, [isOpen, visibleColumns, columnOrder, allColumns]);

  const selectedCount = useMemo(() => {
    return Object.values(tempVisible).filter(Boolean).length;
  }, [tempVisible]);

  const filteredAvailableColumns = useMemo(() => {
    if (!searchQuery.trim()) return allColumns;
    const q = searchQuery.toLowerCase();
    return allColumns.filter((c) => c.label.toLowerCase().includes(q));
  }, [allColumns, searchQuery]);

  // Selected columns in single ordered list
  const selectedOrderedColumns = useMemo(() => {
    const list: ColumnItem[] = [];
    tempOrder.forEach((id) => {
      if (tempVisible[id]) {
        const item = allColumns.find((c) => c.id === id);
        if (item) list.push(item);
      }
    });
    return list;
  }, [tempOrder, tempVisible, allColumns]);

  const handleToggleColumn = (id: string) => {
    setTempVisible((prev) => {
      const nextVal = !prev[id];
      return { ...prev, [id]: nextVal };
    });
  };

  const handleRemoveFromSelected = (id: string) => {
    setTempVisible((prev) => ({ ...prev, [id]: false }));
  };

  // Drag and Drop reordering handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    setTempOrder((prev) => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggedId);
      const toIdx = newOrder.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggedId);
      }
      return newOrder;
    });

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleSave = () => {
    onApply(tempVisible, tempOrder, []);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Manage Columns
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select columns and drag to reorder which appears first
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Two columns layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-hidden min-h-0">
          {/* Left Column: Select Lead Columns */}
          <div className="p-6 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span>Select Columns</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {selectedCount}/{allColumns.length}
                </span>
              </h3>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-transparent transition-all"
              />
            </div>

            {/* Columns List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1.5 min-h-[300px]">
              {filteredAvailableColumns.map((col) => {
                const isChecked = !!tempVisible[col.id];
                return (
                  <label
                    key={col.id}
                    onClick={() => handleToggleColumn(col.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none transition-colors group"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                        isChecked
                          ? "bg-[#cc2727] border-[#cc2727] text-white"
                          : "border-slate-300 bg-white group-hover:border-slate-400"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                      {col.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Right Column: Reorder Columns (Single Unified Drag & Drop List) */}
          <div className="p-6 flex flex-col min-h-0 overflow-hidden bg-slate-50/50">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span>Selected Columns Order</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#cc2727]/10 text-[#cc2727]">
                  {selectedOrderedColumns.length} Selected
                </span>
              </h3>
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              Drag items up or down to arrange column order in the table:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 min-h-[300px]">
              {selectedOrderedColumns.length === 0 ? (
                <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-white">
                  No columns selected. Check columns on the left to show them.
                </div>
              ) : (
                selectedOrderedColumns.map((col, index) => (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl shadow-xs transition-all cursor-move select-none ${
                      draggedId === col.id
                        ? "opacity-40 border-dashed border-[#cc2727]"
                        : dragOverId === col.id
                        ? "border-[#cc2727] ring-1 ring-[#cc2727]"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0 cursor-grab active:cursor-grabbing" />
                      <span className="w-5 text-[11px] font-bold text-slate-400 font-mono shrink-0">
                        {index + 1}.
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {col.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveFromSelected(col.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove column"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onRestoreDefault}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Restore Default
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold shadow-md shadow-[#cc2727]/20 transition-all cursor-pointer active:scale-95"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
