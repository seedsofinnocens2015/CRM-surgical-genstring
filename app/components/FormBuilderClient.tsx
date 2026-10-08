"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/app/components/AdminSidebar";
import TeamLeaderSidebar from "@/app/components/TeamLeaderSidebar";
import Footer from "@/app/components/Footer";
import { IFormField } from "@/models/FormConfig";
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Save,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Sliders,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Layers,
  ArrowRight,
  ListPlus,
} from "lucide-react";
import {
  DISPOSITIONS,
  VALID_STATUS_LIST,
  SUB_DISPOSITIONS_MAP,
} from "@/lib/leadOptions";

interface FormBuilderClientProps {
  role: "admin" | "team_leader";
}

const SECTION_META = [
  { id: 1, title: "1. Lead Date, Contact & Caller", color: "border-blue-500 text-blue-600 bg-blue-50" },
  { id: 2, title: "2. Patient & Family Profile", color: "border-emerald-500 text-emerald-600 bg-emerald-50" },
  { id: 3, title: "3. Clinical & Surgical Information", color: "border-purple-500 text-purple-600 bg-purple-50" },
  { id: 4, title: "4. Disposition, Appointments & Follow-up", color: "border-[#cc2727] text-[#cc2727] bg-red-50" },
];

export default function FormBuilderClient({ role }: FormBuilderClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [error, setError] = useState("");

  const [fields, setFields] = useState<IFormField[]>([]);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);

  // Sub Disposition Mappings (Auto selection dictionary)
  const [subDispositionMappings, setSubDispositionMappings] = useState<
    Record<string, { disposition: string; validStatus: string }>
  >({ ...SUB_DISPOSITIONS_MAP });

  // Edit / Add Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Partial<IFormField> | null>(null);
  const [newOptionInput, setNewOptionInput] = useState("");

  // 3-field dropdown option inputs for Sub Dispositions
  const [newSubOption, setNewSubOption] = useState("");
  const [newDisposition, setNewDisposition] = useState("Converted");
  const [newValidStatus, setNewValidStatus] = useState("Valid");

  // Delete Confirmation Modal state
  const [fieldToDelete, setFieldToDelete] = useState<IFormField | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push(role === "admin" ? "/admin/login" : "/team-leader/login");
          return;
        }
        const meData = await meRes.json();
        if (
          !meData.user ||
          (role === "admin" && meData.user.role !== "admin") ||
          (role === "team_leader" && meData.user.role !== "team_leader")
        ) {
          router.push(role === "admin" ? "/admin/login" : "/team-leader/login");
          return;
        }
        setUser(meData.user);

        // Fetch form configuration
        const configRes = await fetch("/api/admin/form-config");
        if (configRes.ok) {
          const cData = await configRes.json();
          if (cData.config?.fields) {
            // Filter out standalone dispositions and validStatus from form builder as they auto-derive from Sub Dispositions
            const filteredFields = cData.config.fields.filter(
              (f: IFormField) => f.id !== "dispositions" && f.id !== "validStatus"
            );
            setFields(filteredFields);
          }
          if (cData.config?.subDispositionMappings && Object.keys(cData.config.subDispositionMappings).length > 0) {
            setSubDispositionMappings(cData.config.subDispositionMappings);
          } else {
            const subDispField = (cData.config?.fields || []).find((f: any) => f.id === "subDispositions");
            if (subDispField?.subDispositionMappings && Object.keys(subDispField.subDispositionMappings).length > 0) {
              setSubDispositionMappings(subDispField.subDispositionMappings);
            }
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load form config");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [role, router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(role === "admin" ? "/admin/login" : "/team-leader/login");
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedFieldId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnSection = (e: React.DragEvent, targetSection: 1 | 2 | 3 | 4) => {
    e.preventDefault();
    const fieldId = e.dataTransfer.getData("text/plain") || draggedFieldId;
    if (!fieldId) return;

    setFields((prev) => {
      const fieldIndex = prev.findIndex((f) => f.id === fieldId);
      if (fieldIndex === -1) return prev;

      const updated = [...prev];
      const moved = { ...updated[fieldIndex], section: targetSection };

      // Remove from current position and append to target section
      updated.splice(fieldIndex, 1);
      const targetIndices = updated
        .map((f, i) => (f.section === targetSection ? i : -1))
        .filter((i) => i !== -1);

      if (targetIndices.length > 0) {
        const lastIdx = targetIndices[targetIndices.length - 1];
        updated.splice(lastIdx + 1, 0, moved);
      } else {
        updated.push(moved);
      }

      // Re-index orders within section
      return reorderSectionList(updated);
    });
    setDraggedFieldId(null);
  };

  const handleDropOnField = (
    e: React.DragEvent,
    targetFieldId: string,
    targetSection: 1 | 2 | 3 | 4
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedFieldId;
    if (!sourceId || sourceId === targetFieldId) {
      setDraggedFieldId(null);
      return;
    }

    setFields((prev) => {
      const sourceIndex = prev.findIndex((f) => f.id === sourceId);
      const targetIndex = prev.findIndex((f) => f.id === targetFieldId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(sourceIndex, 1);
      moved.section = targetSection;

      // Insert at target index
      const newTargetIndex = updated.findIndex((f) => f.id === targetFieldId);
      updated.splice(newTargetIndex, 0, moved);

      return reorderSectionList(updated);
    });
    setDraggedFieldId(null);
  };

  const reorderSectionList = (list: IFormField[]): IFormField[] => {
    const sections: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
    const result: IFormField[] = [];

    sections.forEach((sec) => {
      const secFields = list.filter((f) => f.section === sec);
      secFields.forEach((f, idx) => {
        result.push({ ...f, section: sec, order: idx + 1 });
      });
    });

    return result;
  };

  // Move up/down buttons as accessible alternative to drag & drop
  const handleMove = (fieldId: string, direction: "up" | "down") => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === fieldId);
      if (idx === -1) return prev;
      const current = prev[idx];
      const sameSectionFields = prev.filter((f) => f.section === current.section);
      const inSecIdx = sameSectionFields.findIndex((f) => f.id === fieldId);

      if (direction === "up" && inSecIdx > 0) {
        const targetField = sameSectionFields[inSecIdx - 1];
        const targetGlobalIdx = prev.findIndex((f) => f.id === targetField.id);
        const updated = [...prev];
        updated[idx] = targetField;
        updated[targetGlobalIdx] = current;
        return reorderSectionList(updated);
      } else if (direction === "down" && inSecIdx < sameSectionFields.length - 1) {
        const targetField = sameSectionFields[inSecIdx + 1];
        const targetGlobalIdx = prev.findIndex((f) => f.id === targetField.id);
        const updated = [...prev];
        updated[idx] = targetField;
        updated[targetGlobalIdx] = current;
        return reorderSectionList(updated);
      }
      return prev;
    });
  };

  // Move to a different section (1, 2, 3, 4)
  const handleChangeSection = (fieldId: string, newSection: 1 | 2 | 3 | 4) => {
    setFields((prev) => {
      const updated = prev.map((f) => (f.id === fieldId ? { ...f, section: newSection } : f));
      return reorderSectionList(updated);
    });
  };

  // Toggle field visibility enabled/disabled
  const handleToggleEnable = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, enabled: !f.enabled } : f))
    );
  };

  // Request delete (opens confirmation dialog)
  const handleRequestDelete = (field: IFormField) => {
    setFieldToDelete(field);
  };

  // Perform delete after confirmation
  const handleConfirmDelete = () => {
    if (!fieldToDelete) return;
    const targetId = fieldToDelete.id;
    setFields((prev) => reorderSectionList(prev.filter((item) => item.id !== targetId)));
    setToastMessage(`Field "${fieldToDelete.label}" deleted. Remember to click "Save Form Layout".`);
    setTimeout(() => setToastMessage(""), 4000);
    setFieldToDelete(null);
  };

  // Save changes to backend
  const handleSaveConfig = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/form-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields,
          subDispositionMappings,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save form configuration");
      }
      setToastMessage("Form configuration saved successfully! All panels updated.");
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all form fields to standard default configuration? Any custom fields added will be reset.")) {
      return;
    }
    setResetting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/form-config/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset");
      if (data.config?.fields) {
        const filteredFields = data.config.fields.filter(
          (f: IFormField) => f.id !== "dispositions" && f.id !== "validStatus"
        );
        setFields(filteredFields);
      }
      if (data.config?.subDispositionMappings) {
        setSubDispositionMappings(data.config.subDispositionMappings);
      }
      setToastMessage("Form configuration restored to default successfully!");
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to reset");
    } finally {
      setResetting(false);
    }
  };

  // Open modal to add new field
  const handleOpenAddField = (sectionId: 1 | 2 | 3 | 4) => {
    setEditingField({
      id: `custom_${Date.now()}`,
      label: "",
      type: "text",
      section: sectionId,
      order: fields.filter((f) => f.section === sectionId).length + 1,
      required: false,
      options: [],
      placeholder: "",
      enabled: true,
      isSystem: false,
    });
    setNewOptionInput("");
    setModalOpen(true);
  };

  // Open modal to edit existing field
  const handleOpenEditField = (field: IFormField) => {
    setEditingField({ ...field, options: field.options ? [...field.options] : [] });
    setNewOptionInput("");
    setModalOpen(true);
  };

  // Save field from modal
  const handleSaveFieldModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField || !editingField.label?.trim()) {
      alert("Field label is required");
      return;
    }

    const nextMappings = editingField.id === "subDispositions"
      ? { ...subDispositionMappings }
      : subDispositionMappings;

    const fieldToSave = {
      ...editingField,
      label: editingField.label.trim(),
      id: editingField.id || `custom_${Date.now()}`,
      section: editingField.section || 1,
      type: editingField.type || "text",
      enabled: editingField.enabled ?? true,
      options: editingField.type === "select" ? (editingField.options || []) : [],
      ...(editingField.id === "subDispositions" ? { subDispositionMappings: nextMappings } : {}),
    } as IFormField;

    const nextFields = (() => {
      const existsIndex = fields.findIndex((f) => f.id === fieldToSave.id);
      let updated = [...fields];
      if (existsIndex !== -1) {
        updated[existsIndex] = fieldToSave;
      } else {
        updated.push(fieldToSave);
      }
      return reorderSectionList(updated);
    })();

    setFields(nextFields);
    setModalOpen(false);
    setEditingField(null);

    // Auto-save immediately to DB so user does not lose updates on refresh
    (async () => {
      try {
        setSaving(true);
        const res = await fetch("/api/admin/form-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: nextFields,
            subDispositionMappings: nextMappings,
          }),
        });
        if (res.ok) {
          setToastMessage(`"${fieldToSave.label}" saved and updated successfully!`);
          setTimeout(() => setToastMessage(""), 4000);
        }
      } catch (err: any) {
        console.error("Auto save failed:", err);
      } finally {
        setSaving(false);
      }
    })();
  };

  // Add dropdown option in modal (general)
  const handleAddOption = () => {
    if (!newOptionInput.trim() || !editingField) return;
    const trimmed = newOptionInput.trim();
    const currentOptions = editingField.options || [];
    if (currentOptions.includes(trimmed)) {
      alert("Option already exists!");
      return;
    }
    setEditingField({
      ...editingField,
      options: [...currentOptions, trimmed],
    });
    setNewOptionInput("");
  };

  // Add 3-field option for Sub Dispositions: [Sub Disposition, Disposition, Valid Status]
  const handleAddSubDispositionOption = () => {
    if (!newSubOption.trim() || !editingField) return;
    const subName = newSubOption.trim();
    const currentOptions = editingField.options || [];
    if (currentOptions.includes(subName)) {
      alert(`Sub Disposition "${subName}" already exists!`);
      return;
    }

    // 1. Add to field options
    setEditingField({
      ...editingField,
      options: [...currentOptions, subName],
    });

    // 2. Add to mapping dictionary
    setSubDispositionMappings((prev) => ({
      ...prev,
      [subName]: {
        disposition: newDisposition,
        validStatus: newValidStatus,
      },
    }));

    // Reset input
    setNewSubOption("");
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (!editingField || !editingField.options) return;
    const optToRemove = editingField.options[indexToRemove];
    setEditingField({
      ...editingField,
      options: editingField.options.filter((_, idx) => idx !== indexToRemove),
    });

    if (editingField.id === "subDispositions" && optToRemove) {
      setSubDispositionMappings((prev) => {
        const next = { ...prev };
        delete next[optToRemove];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#cc2727]/30 border-t-[#cc2727] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-black flex">
      {/* Sidebar */}
      {role === "admin" ? (
        <AdminSidebar user={user} onLogout={handleLogout} />
      ) : (
        <TeamLeaderSidebar user={user} onLogout={handleLogout} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-200 bg-white/80 sticky top-0 z-20 backdrop-blur-md">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
                  <span>Lead Form Builder</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-semibold border border-[#cc2727]/20">
                    Live Dynamic Form
                  </span>
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  Drag & drop fields, edit dropdown options, change sections (1, 2, 3, 4), and add custom fields.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="py-2 px-3 bg-white hover:bg-slate-100 text-gray-700 text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Reset to default fields"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button> */}
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="py-2 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-[#cc2727]/20 transition-all cursor-pointer"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Form Layout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* Notifications */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-semibold">{toastMessage}</span>
            </div>
          )}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
          )}

          {/* Quick Guide Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-black">Form Customizer Instructions</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  • <strong>Drag & Drop:</strong> Grab the handle icon <GripVertical className="w-3 h-3 inline text-gray-400" /> to move fields within or across sections 1, 2, 3, or 4.<br/>
                  • <strong>Edit Dropdown Options:</strong> Click Edit <Edit2 className="w-3 h-3 inline text-blue-600" /> to add, remove, or modify options for any select field.<br/>
                  • <strong>Add Fields:</strong> Click "+ Add Field" in any section to create new custom inputs.<br/>
                  • Once finished, click <strong>"Save Form Layout"</strong> above to apply to Add Lead and Edit Lead across Admin, Team Leader, and Agent panels.
                </p>
              </div>
            </div>
          </div>

          {/* 4 Sections Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {SECTION_META.map((sec) => {
              const secFields = fields
                .filter((f) => f.section === sec.id)
                .sort((a, b) => a.order - b.order);

              return (
                <div
                  key={sec.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnSection(e, sec.id as 1 | 2 | 3 | 4)}
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col"
                >
                  {/* Section Header */}
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {/* <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border ${sec.color}`}>
                        {sec.id}
                      </span> */}
                      <div>
                        <h2 className="text-sm font-bold text-black">{sec.title}</h2>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {secFields.length} field{secFields.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddField(sec.id as 1 | 2 | 3 | 4)}
                      className="py-1.5 px-3 bg-white hover:bg-slate-100 text-[#cc2727] text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Field</span>
                    </button>
                  </div>

                  {/* Fields List (Droppable area) */}
                  <div className="p-4 space-y-2.5 flex-1 min-h-[140px] bg-slate-50/40">
                    {secFields.length === 0 ? (
                      <div className="h-full min-h-[120px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-gray-400">
                        Drag fields here or click &quot;Add Field&quot;
                      </div>
                    ) : (
                      secFields.map((field, idx) => (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, field.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropOnField(e, field.id, sec.id as 1 | 2 | 3 | 4)}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            draggedFieldId === field.id
                              ? "opacity-40 border-[#cc2727] bg-[#cc2727]/5"
                              : field.enabled
                              ? "bg-white border-slate-200 shadow-xs hover:border-slate-300"
                              : "bg-slate-100 border-slate-200 opacity-60"
                          }`}
                        >
                          {/* Drag Handle + Field Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-black p-1 shrink-0"
                              title="Drag to reorder or move across sections"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-black truncate">
                                  {field.label}
                                </span>
                                {field.required && (
                                  <span className="text-[10px] text-rose-600 font-bold">*</span>
                                )}
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-gray-600 font-mono font-medium border border-slate-200 uppercase">
                                  {field.type}
                                </span>
                                {field.isSystem && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-200">
                                    System
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-gray-500 truncate mt-0.5 flex items-center gap-2">
                                <span className="font-mono text-gray-400">id: {field.id}</span>
                                {field.type === "select" && field.options && (
                                  <span className="text-blue-600 font-medium">
                                    ({field.options.length} options)
                                  </span>
                                )}
                                {!field.enabled && (
                                  <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 rounded">
                                    Hidden / Disabled
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Move Up/Down */}
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => handleMove(field.id, "up")}
                                disabled={idx === 0}
                                className="p-1 text-gray-400 hover:text-black disabled:opacity-20 cursor-pointer"
                                title="Move Up"
                              >
                                <MoveUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(field.id, "down")}
                                disabled={idx === secFields.length - 1}
                                className="p-1 text-gray-400 hover:text-black disabled:opacity-20 cursor-pointer"
                                title="Move Down"
                              >
                                <MoveDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Section Switcher dropdown */}
                            <select
                              value={field.section}
                              onChange={(e) =>
                                handleChangeSection(
                                  field.id,
                                  parseInt(e.target.value, 10) as 1 | 2 | 3 | 4
                                )
                              }
                              className="text-[11px] font-bold px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-black focus:outline-none focus:ring-1 focus:ring-[#cc2727] cursor-pointer"
                              title="Move directly to section 1, 2, 3, or 4"
                            >
                              <option value="1">Sec 1</option>
                              <option value="2">Sec 2</option>
                              <option value="3">Sec 3</option>
                              <option value="4">Sec 4</option>
                            </select>

                            {/* Toggle Enable/Disable */}
                            <button
                              type="button"
                              onClick={() => handleToggleEnable(field.id)}
                              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                field.enabled
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-gray-500 border-slate-200 hover:bg-slate-200"
                              }`}
                              title={field.enabled ? "Enabled (click to hide)" : "Disabled (click to show)"}
                            >
                              {field.enabled ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Edit Field */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditField(field)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors"
                              title="Edit field settings & dropdown options"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Field: Clickable for all fields with confirmation modal */}
                            <button
                              type="button"
                              onClick={() => handleRequestDelete(field)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer transition-colors"
                              title={field.isSystem ? "Delete standard field (Requires confirmation)" : "Delete field"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Save Reminder */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Changes apply instantly across all <strong>Add Lead</strong> and <strong>Edit Lead</strong> forms upon clicking Save.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="py-2.5 px-6 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/25 transition-all cursor-pointer shrink-0"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save &amp; Apply Changes</span>
            </button>
          </div>
        </main>
        <Footer />
      </div>

      {/* Edit / Add Field Modal */}
      {modalOpen && editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto text-black">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-black transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-slate-200 pb-3">
              <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727]">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black">
                  {editingField.isSystem ? "Edit System Field" : "Edit / Add Field"}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Field ID: {editingField.id}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveFieldModal} className="space-y-4">
              {/* Field Label */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Field Label *
                </label>
                <input
                  type="text"
                  required
                  value={editingField.label || ""}
                  onChange={(e) =>
                    setEditingField({ ...editingField, label: e.target.value })
                  }
                  placeholder="e.g. Blood Group, Referral Code"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                />
              </div>

              {/* Section Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Assign To Section
                  </label>
                  <select
                    value={editingField.section || 1}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        section: parseInt(e.target.value, 10) as 1 | 2 | 3 | 4,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="1">1. Lead Date & Caller</option>
                    <option value="2">2. Patient & Family</option>
                    <option value="3">3. Clinical & Surgery</option>
                    <option value="4">4. Dispositions & Appointments</option>
                  </select>
                </div>

                {/* Input Type */}
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Input Type
                  </label>
                  <select
                    disabled={editingField.isSystem}
                    value={editingField.type || "text"}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#cc2727] disabled:bg-slate-100 disabled:text-gray-500"
                  >
                    <option value="text">Text (Single Line)</option>
                    <option value="number">Number</option>
                    <option value="tel">Phone / Tel</option>
                    <option value="date">Date (DD-MM-YYYY)</option>
                    <option value="month">Month (YYYY-MM)</option>
                    <option value="time">Time (HH:MM)</option>
                    <option value="datetime-local">Date & Time</option>
                    <option value="email">Email Address</option>
                    <option value="url">URL / Website Link</option>
                    <option value="select">Dropdown (Select Menu)</option>
                    <option value="textarea">Textarea (Multi-line)</option>
                    <option value="checkbox">Checkbox (Yes / No)</option>
                  </select>
                </div>
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Placeholder Hint
                </label>
                <input
                  type="text"
                  value={editingField.placeholder || ""}
                  onChange={(e) =>
                    setEditingField({
                      ...editingField,
                      placeholder: e.target.value,
                    })
                  }
                  placeholder="e.g. Enter details..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                />
              </div>

              {/* Required & Enabled Checkboxes */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-black">
                  <input
                    type="checkbox"
                    checked={editingField.required || false}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        required: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-[#cc2727] focus:ring-[#cc2727]"
                  />
                  <span>Mandatory / Required Field</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-black">
                  <input
                    type="checkbox"
                    checked={editingField.enabled ?? true}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        enabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-[#cc2727] focus:ring-[#cc2727]"
                  />
                  <span>Active &amp; Visible</span>
                </label>
              </div>

              {/* Dropdown Options Manager (if type === "select") */}
              {editingField.type === "select" && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-black flex items-center gap-1.5">
                      <ListPlus className="w-3.5 h-3.5 text-[#cc2727]" />
                      <span>Dropdown Menu Options ({(editingField.options || []).length})</span>
                    </label>
                    <span className="text-[11px] text-gray-500">
                      {editingField.id === "subDispositions"
                        ? "Configure Sub Disposition with Auto Disposition & Valid Status"
                        : "Add or remove items below"}
                    </span>
                  </div>

                  {/* If Sub Dispositions: Show 3 fields (Sub Dispositions, Dispositions, Valid Status) */}
                  {editingField.id === "subDispositions" ? (
                    <div className="p-3 bg-red-50/50 border border-red-200 rounded-xl space-y-2.5">
                      <span className="text-[11px] font-bold text-[#cc2727] block">
                        Add New Sub Disposition with Auto-Selection:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        {/* 1. Sub Disposition input */}
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">
                            Sub Disposition Name
                          </label>
                          <input
                            type="text"
                            value={newSubOption}
                            onChange={(e) => setNewSubOption(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSubDispositionOption();
                              }
                            }}
                            placeholder="e.g. Appointment Rescheduled..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                          />
                        </div>

                        {/* 2. Disposition dropdown */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">
                            Auto Disposition
                          </label>
                          <select
                            value={newDisposition}
                            onChange={(e) => setNewDisposition(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                          >
                            {DISPOSITIONS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Valid Status dropdown */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">
                            Valid Status
                          </label>
                          <select
                            value={newValidStatus}
                            onChange={(e) => setNewValidStatus(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                          >
                            {VALID_STATUS_LIST.map((vs) => (
                              <option key={vs} value={vs}>
                                {vs}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Add Button */}
                        <div className="sm:col-span-2 flex items-end">
                          <button
                            type="button"
                            onClick={handleAddSubDispositionOption}
                            className="w-full py-1.5 px-3 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Standard single-text option bar for other dropdowns */
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOptionInput}
                        onChange={(e) => setNewOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddOption();
                          }
                        }}
                        placeholder="Add new option and press Enter / Add..."
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="px-3.5 py-2 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}

                  {/* Options List */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                    {(!editingField.options || editingField.options.length === 0) ? (
                      <p className="text-xs text-gray-400 text-center py-3">
                        No options added yet. Type an option above and click Add.
                      </p>
                    ) : (
                      editingField.options.map((opt, idx) => {
                        const mapping =
                          editingField.id === "subDispositions"
                            ? subDispositionMappings[opt] || SUB_DISPOSITIONS_MAP[opt]
                            : null;

                        return (
                          <div
                            key={idx}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs text-black gap-2"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold truncate">{opt}</span>
                              {mapping && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    Disp: {mapping.disposition}
                                  </span>
                                  <span
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                      mapping.validStatus === "Valid"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : mapping.validStatus === "Invalid"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    Status: {mapping.validStatus}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              className="text-gray-400 hover:text-rose-600 p-0.5 cursor-pointer shrink-0"
                              title="Remove option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-[#cc2727]/20 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Field</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fieldToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black">Confirm Field Deletion</h3>
                <p className="text-xs text-gray-500">This action will remove the field from the lead form.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Field Name:</span>
                <span className="font-bold text-black">{fieldToDelete.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Section:</span>
                <span className="font-semibold text-[#cc2727]">Section {fieldToDelete.section}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Field Type:</span>
                <span className="font-mono text-gray-700 uppercase text-[11px]">{fieldToDelete.type}</span>
              </div>
              {fieldToDelete.isSystem && (
                <div className="pt-2 border-t border-slate-200 text-amber-700 text-[11px] flex items-start gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Note: This is a standard CRM field. If you delete it, you can restore it anytime using "Reset Defaults".</span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-700 font-medium">
              Kya aap sach me <span className="font-bold text-rose-600">"{fieldToDelete.label}"</span> field ko form se delete karna chahte hain?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFieldToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Cancel (Keep Field)
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Field</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
