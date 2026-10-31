import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, MapPin, Plus, RefreshCw, X } from 'lucide-react';
import { loadPlaces } from '../utils/dataLoader';
import { normalizeText } from '../utils/geoUtils';
import { CAIRO_LANDMARKS } from './MapSearchBar';
import { filterMultiStopPlan, journeyOptionKey } from '../utils/multiStopPlanner';
import JourneySteps from './JourneySteps';

const VEHICLES = ['ALL', 'Metro', 'BRT', 'Minibus', 'Bus', 'Microbus'];
const empty = () => {};

export function MultiStopPlanner({
  points = [], legs = [], pickingId = null, vehicleFilter = 'ALL', selection = null, stops = [],
  onChangePoint = empty, onAddPoint = empty, onRemovePoint = empty, onMovePoint = empty,
  onPickPoint = empty, onFilterChange = empty, onSelectJourney = empty, onShowMap = empty, onRetry = empty,
  lang = 'ar', t = {}
}) {
  const [drafts, setDrafts] = useState({});
  const [placeIndex, setPlaceIndex] = useState([]);
  const [loadDone, setLoadDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPlaces().then(data => {
      if (cancelled) return;
      setPlaceIndex((data?.places || []).map(([ar, en, cat, lat, lng]) => ({
        name_ar: ar, name_en: en, category: cat, coord: [Number(lat), Number(lng)]
      })));
      setLoadDone(true);
    }).catch(() => { if (!cancelled) setLoadDone(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const assignedIds = points.filter(point => point.coord).map(point => point.id);
    if (assignedIds.length) setDrafts(current => {
      let changed = false;
      const next = { ...current };
      assignedIds.forEach(id => { if (Object.prototype.hasOwnProperty.call(next, id)) { delete next[id]; changed = true; } });
      return changed ? next : current;
    });
  }, [points]);

  const candidates = useMemo(() => {
    const localStops = stops.map(stop => ({
      name_ar: stop.name_ar, name_en: stop.name_en, aliases: stop.aliases || [], category: 'station', coord: [Number(stop.lat), Number(stop.lng)]
    }));
    const all = [...CAIRO_LANDMARKS, ...localStops, ...placeIndex].filter(item =>
      Array.isArray(item.coord) && item.coord.every(Number.isFinite)
    );
    const seen = new Set();
    return all.filter(item => {
      const key = `${normalizeText(item.name_ar)}|${normalizeText(item.name_en)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [stops, placeIndex]);

  const getSuggestions = query => {
    const norm = normalizeText(query || '');
    if (norm.length < 2) return [];
    return candidates.map(item => {
      const names = [item.name_ar, item.name_en, ...(item.aliases || [])].filter(Boolean).map(normalizeText);
      const score = names.some(name => name.startsWith(norm)) ? 0 : names.some(name => name.includes(norm)) ? 1 : -1;
      return { item, score };
    }).filter(row => row.score >= 0).sort((a, b) => a.score - b.score)
      .slice(0, 8).map(row => row.item);
  };
  const text = key => t[key] || key;
  const vehicleName = value => value === 'ALL' ? text('multiAll') : value === 'Metro' ? text('metro') : value === 'BRT' ? text('brt') : value === 'Minibus' ? text('minibus') : value === 'Bus' ? text('bus') : text('microbus');
  const endpoints = (leg, index) => `${index + 1}. ${leg.from.label || text('multiPoint')} → ${index + 2}. ${leg.to.label || text('multiPoint')}`;
  const renderJourney = (journey, leg, kind) => {
    const key = journeyOptionKey(journey);
    const selected = selection?.legKey === leg.key && selection?.optionKey === key;
    return <button key={key} type="button" data-journey-id={key} className={`multi-stop-option ${selected ? 'selected' : ''}`}
      aria-pressed={selected} onClick={() => { onSelectJourney(leg.key, key); onShowMap(); }}>
      <span className="multi-stop-option-top"><strong>{kind === 'direct' ? text('directBadge') : text('transferBadge')}</strong></span>
      <JourneySteps journey={journey} lang={lang} t={t} />
    </button>;
  };

  return <section className="multi-stop-tab-container" aria-label={text('tabMultiStop')}>
    <header className="multi-stop-banner"><h2>{text('tabMultiStop')}</h2><p>{text('multiIntro')}</p></header>
    <div className="multi-stop-points">
      {points.map((point, index) => {
        const query = drafts[point.id] ?? point.label ?? '';
        const suggestions = getSuggestions(query);
        const editing = Object.prototype.hasOwnProperty.call(drafts, point.id);
        return <article className={`multi-stop-point ${pickingId === point.id ? 'picking' : ''}`} key={point.id}>
          <div className="multi-stop-point-heading"><strong>{text('multiPoint')} {index + 1}</strong>
            <div className="multi-stop-icon-actions">
              <button type="button" aria-label={`${text('multiMoveUp')} ${index + 1}`} disabled={index === 0} onClick={() => onMovePoint(point.id, -1)}><ArrowUp size={16}/></button>
              <button type="button" aria-label={`${text('multiMoveDown')} ${index + 1}`} disabled={index === points.length - 1} onClick={() => onMovePoint(point.id, 1)}><ArrowDown size={16}/></button>
              <button type="button" aria-label={`${text('multiPickMap')} ${index + 1}`} aria-pressed={pickingId === point.id} onClick={() => onPickPoint(point.id)}><MapPin size={16}/></button>
              <button type="button" aria-label={`${text('multiRemove')} ${index + 1}`} disabled={points.length <= 2} onClick={() => onRemovePoint(point.id)}><X size={16}/></button>
            </div>
          </div>
          <input type="search" value={query} placeholder={text('multiSearchPlaceholder')} aria-label={`${text('multiPoint')} ${index + 1}`}
            onChange={event => {
              const value = event.target.value;
              setDrafts(current => ({ ...current, [point.id]: value }));
              onChangePoint(point.id, { coord: null, label: '' });
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && suggestions[0]) {
                event.preventDefault();
                const item = suggestions[0];
                const label = (lang === 'ar' ? item.name_ar : item.name_en) || item.name_en || item.name_ar || `${item.coord[0].toFixed(5)}, ${item.coord[1].toFixed(5)}`;
                onChangePoint(point.id, { coord: item.coord, label });
                setDrafts(current => { const next = { ...current }; delete next[point.id]; return next; });
              }
              if (event.key === 'Escape') setDrafts(current => { const next = { ...current }; delete next[point.id]; return next; });
            }}/>
          {editing && suggestions.length > 0 && <div className="multi-stop-suggestions" role="listbox">
            {suggestions.map((item, optionIndex) => <button key={`${item.name_en}-${optionIndex}`} type="button" role="option"
              onClick={() => {
                const label = (lang === 'ar' ? item.name_ar : item.name_en) || item.name_en || item.name_ar || `${item.coord[0].toFixed(5)}, ${item.coord[1].toFixed(5)}`;
                onChangePoint(point.id, { coord: item.coord, label });
                setDrafts(current => { const next = { ...current }; delete next[point.id]; return next; });
              }}>
              <span>{(lang === 'ar' ? item.name_ar : item.name_en) || item.name_en || item.name_ar || text('multiPoint')}</span><small>{lang === 'ar' ? item.name_en : item.name_ar}</small>
            </button>)}
          </div>}
          {pickingId === point.id && <small className="multi-stop-hint">{text('multiPickHint')}</small>}
        </article>;
      })}
      <button type="button" className="multi-stop-add" disabled={points.length >= 6} onClick={onAddPoint}><Plus size={17}/>{text('multiAddPoint')}</button>
    </div>
    <div className="multi-stop-filter" role="group" aria-label={text('multiVehicleFilter')}>
      {VEHICLES.map(vehicle => <button type="button" key={vehicle} className={vehicleFilter === vehicle ? 'active' : ''} aria-pressed={vehicleFilter === vehicle} onClick={() => onFilterChange(vehicle)}>{vehicleName(vehicle)}</button>)}
    </div>
    <div className="multi-stop-legs" aria-live="polite" role="status">
      {legs.map((leg, index) => {
        const filtered = leg.plan ? filterMultiStopPlan(leg.plan, vehicleFilter) : null;
        const groups = [
          { key: 'direct', kind: 'direct', journeys: filtered?.directRoutes || [], title: t.directFoundTitle },
          { key: 'transfers', kind: 'transfer', journeys: filtered?.transferRoutes || [], title: t.transfersFoundTitle }
        ].filter(group => group.journeys.length > 0);
        const optionCount = groups.reduce((sum, group) => sum + group.journeys.length, 0);
        return <section className={`multi-stop-leg ${selection?.legKey === leg.key ? 'active' : ''}`} key={leg.key}>
          <h3>{endpoints(leg, index)}</h3>
          {leg.status === 'incomplete' && <p>{text('multiIncomplete')}</p>}
          {leg.status === 'same-point' && <p>{text('multiSamePoint')}</p>}
          {leg.status === 'loading' && <p>{text('loading')}</p>}
          {leg.status === 'error' && <div><p>{text('multiError')}</p><button type="button" onClick={onRetry}><RefreshCw size={14}/>{text('multiRetry')}</button></div>}
          {leg.status === 'ready' && optionCount === 0 && <p>{leg.plan?.directRoutes?.length || leg.plan?.transferRoutes?.length ? text('multiFilteredEmpty') : text('noTripsFound')}</p>}
          {groups.map(group => {
            const visible = group.journeys.slice(0, 3);
            const remaining = group.journeys.slice(3);
            return <section className={`multi-stop-option-group multi-stop-option-group-${group.key}`} key={`${leg.key}-${group.key}`}>
              <h4>{group.title(group.journeys.length)}</h4>
              {visible.map(journey => renderJourney(journey, leg, group.kind))}
              {remaining.length > 0 && <details className="journey-more-options"><summary>{text('showMoreOptions')(remaining.length)}</summary>
                {remaining.map(journey => renderJourney(journey, leg, group.kind))}
              </details>}
            </section>;
          })}
          {leg.status === 'ready' && optionCount > 0 && <p className="journey-panel-notices">{text('journeyWalkNotice')} {text('journeyServiceNotice')}</p>}
        </section>;
      })}
    </div>
    {!loadDone && <span className="sr-only">{text('loading')}</span>}
  </section>;
}

export default MultiStopPlanner;

