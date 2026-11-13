import React, { useState } from 'react';
import { 
  FolderPlus, 
  Trash2, 
  Lock, 
  Edit2, 
  Check, 
  AlertTriangle,
  Palette,
  X
} from 'lucide-react';
import { Subject, Material } from '../types';
import { Modal } from './Modal';

interface ManageSubjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  materials: Material[];
  onAddSubject: (subject: Omit<Subject, 'id'>) => Promise<any>;
  onUpdateSubject: (id: string, updates: Partial<Subject>) => Promise<any>;
  onDeleteSubjectWithOptions: (id: string, action: 'delete-materials' | 'move', targetSubjectId?: string) => Promise<any>;
  isDeviceAiAvailable?: boolean;
}

const COLOR_PRESETS = [
  { name: 'Blue', value: 'from-blue-600 to-indigo-600', dot: 'bg-blue-600' },
  { name: 'Emerald', value: 'from-emerald-600 to-teal-600', dot: 'bg-emerald-600' },
  { name: 'Purple', value: 'from-purple-600 to-pink-600', dot: 'bg-purple-600' },
  { name: 'Amber', value: 'from-amber-600 to-orange-600', dot: 'bg-amber-600' },
  { name: 'Rose', value: 'from-rose-600 to-red-600', dot: 'bg-rose-600' },
  { name: 'Slate', value: 'from-slate-600 to-zinc-700', dot: 'bg-slate-600' }
];

export const ManageSubjectsModal: React.FC<ManageSubjectsModalProps> = ({
  isOpen,
  onClose,
  subjects,
  materials,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubjectWithOptions,
  isDeviceAiAvailable = false
}) => {
  // New Subject State
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0].value);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  // Delete State
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [deleteAction, setDeleteAction] = useState<'delete-materials' | 'move'>('delete-materials');
  const [targetSubjectId, setTargetSubjectId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddSubject({
        name: newName.trim(),
        color: newColor,
        icon: 'BookOpen',
        isPrivate: newIsPrivate
      });
      setNewName('');
      setNewIsPrivate(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (sub: Subject) => {
    setEditingId(sub.id);
    setEditName(sub.name);
    setEditColor(sub.color || COLOR_PRESETS[0].value);
    setEditIsPrivate(!!sub.isPrivate);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await onUpdateSubject(id, {
        name: editName.trim(),
        color: editColor,
        isPrivate: editIsPrivate
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteSubjectWithOptions(
        subjectToDelete.id, 
        deleteAction, 
        deleteAction === 'move' ? targetSubjectId : undefined
      );
      setSubjectToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const otherSubjects = subjects.filter(s => s.id !== subjectToDelete?.id);
  const materialsInSubject = subjectToDelete 
    ? materials.filter(m => m.subjectId === subjectToDelete.id).length 
    : 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Subjects"
        subtitle="Organize your subjects, privacy settings, and study materials"
        icon={
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
        }
        maxWidth="form"
        bodyClassName="space-y-6"
      >
        {/* Create New Subject Card */}
        <form onSubmit={handleCreate} className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
            Create New Subject
          </span>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Cognitive Psychology, Organic Chemistry"
              className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 min-h-[44px]"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newName.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium shadow shrink-0 flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add Subject</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Color Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Palette className="w-4 h-4 text-slate-400 mr-0.5 shrink-0" />
              <span className="text-xs text-slate-500 mr-1 shrink-0">Color:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setNewColor(preset.value)}
                    className={`w-7 h-7 rounded-full ${preset.dot} transition-transform min-h-[28px] min-w-[28px] ${
                      newColor === preset.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={preset.name}
                    aria-label={`Select ${preset.name} color`}
                  />
                ))}
              </div>
            </div>

            {/* Private Toggle */}
            <label 
              className={`flex items-center gap-2 text-xs select-none min-h-[44px] ${!isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title={!isDeviceAiAvailable ? "Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer." : "Keep this subject private (runs only on-device)"}
            >
              <input
                type="checkbox"
                disabled={!isDeviceAiAvailable}
                checked={newIsPrivate}
                onChange={(e) => setNewIsPrivate(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed"
              />
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium text-xs">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                Private (On-Device Only) {!isDeviceAiAvailable && '(Unavailable)'}
              </span>
            </label>
          </div>
        </form>

        {/* Existing Subjects List */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
            Existing Subjects ({subjects.length})
          </span>

          {subjects.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No subjects yet. Create one above to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              {subjects.map((sub) => {
                const matCount = materials.filter(m => m.subjectId === sub.id).length;
                const isEditing = editingId === sub.id;

                if (isEditing) {
                  return (
                    <div key={sub.id} className="p-4 bg-blue-50/50 dark:bg-blue-950/20 space-y-3.5">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 min-h-[44px]"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(sub.id)}
                            className="flex-1 sm:flex-none p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                            title="Save changes"
                            aria-label="Save changes"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="flex-1 sm:flex-none p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                            title="Cancel"
                            aria-label="Cancel editing"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
                        {/* Color picker */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setEditColor(preset.value)}
                              className={`w-6 h-6 rounded-full ${preset.dot} min-h-[24px] min-w-[24px] ${
                                editColor === preset.value ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70'
                              }`}
                              aria-label={`Select ${preset.name} color`}
                            />
                          ))}
                        </div>

                        {/* Private toggle */}
                        <label 
                          className={`flex items-center gap-2 text-xs select-none min-h-[44px] ${!isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={!isDeviceAiAvailable ? "Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer." : "Keep this subject private"}
                        >
                          <input
                            type="checkbox"
                            disabled={!isDeviceAiAvailable}
                            checked={editIsPrivate}
                            onChange={(e) => setEditIsPrivate(e.target.checked)}
                            className="rounded text-blue-600 w-4 h-4 disabled:cursor-not-allowed"
                          />
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            Private {!isDeviceAiAvailable && '(Unavailable)'}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={sub.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${sub.color || 'from-blue-600 to-indigo-600'} shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {sub.name}
                          </span>
                          {sub.isPrivate && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                          {matCount} material{matCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sub)}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                        title="Rename / Edit"
                        aria-label={`Edit ${sub.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectToDelete(sub);
                          setDeleteAction('delete-materials');
                          const nextOther = subjects.find(s => s.id !== sub.id);
                          setTargetSubjectId(nextOther ? nextOther.id : '');
                        }}
                        className="p-2 text-rose-500 hover:text-rose-700 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                        title="Delete subject"
                        aria-label={`Delete ${sub.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Nested Delete Subject Confirmation Modal */}
      {subjectToDelete && (
        <Modal
          isOpen={Boolean(subjectToDelete)}
          onClose={() => !isDeleting && setSubjectToDelete(null)}
          title={`Delete Subject: "${subjectToDelete.name}"?`}
          subtitle={`This subject contains ${materialsInSubject} study material${materialsInSubject === 1 ? '' : 's'}. Choose what should happen to them:`}
          icon={
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          }
          maxWidth="confirmation"
          isConfirmation={true}
          isDestructiveActionRunning={isDeleting}
          closeOnOverlayClick={!isDeleting}
          closeOnEsc={!isDeleting}
          showCloseButton={!isDeleting}
          footer={
            <>
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                disabled={isDeleting}
                className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || (deleteAction === 'move' && !targetSubjectId)}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold shadow transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </>
          }
        >
          <div className="space-y-3 pt-1 text-xs sm:text-sm">
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
              deleteAction === 'delete-materials'
                ? 'border-rose-500 bg-rose-500/5 text-rose-900 dark:text-rose-200'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              <input
                type="radio"
                name="deleteChoice"
                checked={deleteAction === 'delete-materials'}
                onChange={() => setDeleteAction('delete-materials')}
                className="mt-1 text-rose-600 w-4 h-4"
              />
              <div>
                <span className="font-semibold block text-sm">Delete its materials</span>
                <span className="text-xs opacity-80">Permanently remove all {materialsInSubject} materials in this subject</span>
              </div>
            </label>

            {otherSubjects.length > 0 && (
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                deleteAction === 'move'
                  ? 'border-blue-500 bg-blue-500/5 text-blue-900 dark:text-blue-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                <input
                  type="radio"
                  name="deleteChoice"
                  checked={deleteAction === 'move'}
                  onChange={() => setDeleteAction('move')}
                  className="mt-1 text-blue-600 w-4 h-4"
                />
                <div className="w-full min-w-0">
                  <span className="font-semibold block text-sm">Move them to another subject</span>
                  <span className="text-xs opacity-80 block mb-2.5">Reassign materials before deleting this subject</span>
                  
                  {deleteAction === 'move' && (
                    <select
                      value={targetSubjectId}
                      onChange={(e) => setTargetSubjectId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-base sm:text-sm text-slate-900 dark:text-white font-medium min-h-[44px]"
                    >
                      {otherSubjects.map(os => (
                        <option key={os.id} value={os.id}>
                          Move to: {os.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
