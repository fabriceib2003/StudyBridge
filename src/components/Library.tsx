import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  HelpCircle, 
  Layers, 
  Sparkles, 
  Trash2, 
  Filter, 
  Search, 
  Check, 
  Cloud 
} from 'lucide-react';
import { SavedResult, Subject } from '../types';
import { deleteResultFirestore } from '../services/firestoreService';
import { auth } from '../services/firebaseService';

interface LibraryProps {
  results: SavedResult[];
  subjects: Subject[];
}

export const Library: React.FC<LibraryProps> = ({ results, subjects }) => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'all' | 'summarize' | 'explain'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = results.filter(r => {
    const isSum = r.type === 'summarize' || r.type === 'summary';
    const isExp = r.type === 'explain' || r.type === 'explanation';
    const matchesType = filterType === 'all' 
      ? true 
      : filterType === 'summarize' 
      ? isSum 
      : isExp;
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });


  const handleDeleteSelected = async () => {
    if (!auth.currentUser || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected items?`)) return;
    
    for (const id of selectedIds) {
      await deleteResultFirestore(auth.currentUser.uid, id);
    }
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Library</h2>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--danger-solid)] text-[var(--primary-text)] text-xs font-medium shadow-sm hover:bg-[var(--danger-solid-hover)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 p-1 bg-[var(--surface-raised)] rounded-xl border border-[var(--border)] w-fit">
        {(['all', 'summarize', 'explain'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filterType === type ? 'bg-[var(--surface)] shadow text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            {type === 'all' ? 'All' : type === 'summarize' ? 'Summaries' : 'Explanations'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(res => {
          const sub = subjects.find(s => s.id === res.subjectId);
          return (
            <div key={res.id} className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex gap-3">
              <input 
                type="checkbox" 
                checked={selectedIds.has(res.id)}
                onChange={() => toggleSelect(res.id)}
                className="mt-1 rounded border-[var(--input-border)] accent-[var(--primary)]"
              />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--primary-accent)] bg-[var(--primary-soft-bg)] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {res.type === 'summarize' ? 'Summary' : res.type === 'explain' ? 'Explanation' : res.type}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">{new Date(res.timestamp).toLocaleDateString()}</span>
                </div>
                <h4 className="text-sm font-bold text-[var(--text)]">{res.title}</h4>
                <p className="text-xs text-[var(--muted)] line-clamp-2">{res.content.slice(0, 100)}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{sub?.name || 'General'}</span>
                  <button onClick={() => navigate(`/results/${res.id}`)} className="text-xs text-[var(--primary-accent)] font-semibold hover:underline">Open</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
