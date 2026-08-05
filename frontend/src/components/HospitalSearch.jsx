import { useEffect, useRef, useState } from 'react';
import { Hospital } from 'lucide-react';
import { api } from '../lib/api.js';

// Hospital autocomplete. Suggestions come from our own API (GET /geo/hospitals),
// which proxies a free OpenStreetMap geocoder server-side — so the browser
// never depends on third-party reachability (ad-blockers, DNS, CORS).

export default function HospitalSearch({ value, onChange, onSelect, bias }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef(null);
  // Picking a suggestion updates `value`, which would immediately re-trigger
  // the search and reopen the dropdown — suppress that one cycle.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setError('');
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = { q };
        if (bias?.lat && bias?.lng) {
          params.lat = bias.lat;
          params.lng = bias.lng;
        }
        const r = await api.get('/geo/hospitals', { params });
        const items = r.data?.data?.hospitals || [];
        setSuggestions(items);
        setOpen(true);
        setActive(-1);
      } catch (err) {
        setSuggestions([]);
        setOpen(true);
        setError(err.response?.data?.message || 'Search unavailable — enter details manually');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, bias?.lat, bias?.lng]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (s) => {
    skipNextSearch.current = true;
    onSelect(s);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        className="input"
        required
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Start typing a hospital name…"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse text-xs text-white/40">
          searching…
        </span>
      )}
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#2a0407] shadow-xl shadow-black/50"
        >
          {error && <li className="px-3.5 py-2.5 text-sm text-brand-300">{error}</li>}
          {!error && suggestions.length === 0 && !loading && (
            <li className="px-3.5 py-2.5 text-sm text-white/40">
              No hospitals found — keep typing or enter details manually.
            </li>
          )}
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`block w-full px-3.5 py-2.5 text-left text-sm transition ${
                  i === active ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
              >
                <span className="flex items-center gap-1.5 font-medium text-white"><Hospital className="h-4 w-4 shrink-0 text-white/40" aria-hidden /> {s.name}</span>
                {s.address && (
                  <span className="block truncate text-xs text-white/50">{s.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
