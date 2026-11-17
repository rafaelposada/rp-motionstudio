// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSceneStore, type ActiveEffect } from '@/store/useSceneStore';
import { effectList, getEffect, effectDefaults } from '@/effects';
import { ControlRow, controlVisible } from './Controls';
import { useMobileInteractions } from './MobileInteractions';
import { useI18n } from '@/lib/useI18n';
import InfoHint from './InfoHint';
import { uiHelp } from '@/lib/controlHelp';
import { effectHelp } from '@/lib/effectHelp';
import { tx, txf } from '@/lib/tx';
import { useUIStore } from '@/store/useUIStore';
import { activeEffectTargets, editSelectedEffects, selectedEffectLayers } from '@/lib/compositionEditing';

function MobileEffectCard({
  effect,
  onToggle,
  onRemove,
  onValue,
}: {
  effect: ActiveEffect;
  onToggle: () => void;
  onRemove: () => void;
  onValue: (key: string, value: unknown) => void;
}) {
  const def = getEffect(effect.effectId);
  const { locale } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: effect.instanceId });
  if (!def) return null;
  return (
    <div ref={setNodeRef} className={`effect-card mobile-effect-card ${effect.enabled ? '' : 'disabled'} ${isDragging ? 'is-dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="effect-card-head">
        <button className="mobile-effect-grip" aria-label={`Reorder ${def.meta.name}`} {...attributes} {...listeners}>⠿</button>
        <span className="effect-title">{def.meta.name}</span>
        <button className="icon-btn" aria-label={effect.enabled ? `Disable ${def.meta.name}` : `Enable ${def.meta.name}`} onClick={onToggle}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
        </button>
        <button className={`icon-btn ${confirming ? 'danger' : ''}`} aria-label={confirming ? `Confirm remove ${def.meta.name}` : `Remove ${def.meta.name}`} onClick={() => confirming ? onRemove() : setConfirming(true)} onBlur={() => setConfirming(false)}>
          {confirming ? <span className="mobile-remove-confirm">Remove?</span> : <span aria-hidden="true">×</span>}
        </button>
      </div>
      <div className="effect-card-body">
        <p className="ctl-hint">{effectHelp(effect.effectId, locale)}</p>
        {def.controls.filter(control => controlVisible(control, effect.values)).map((control) => <ControlRow key={control.key} def={control} value={effect.values[control.key]} onChange={(value) => onValue(control.key, value)} />)}
      </div>
    </div>
  );
}

export default function EffectsPanel() {
  const { locale, t, label } = useI18n();
  const mobile = useMobileInteractions();
  const globalEffects = useSceneStore(s => s.effects);
  const tracks = useSceneStore(s => s.tracks), textLayers = useSceneStore(s => s.textLayers);
  const ids = useUIStore(s => s.selectedLayerIds);
  const primaryId = useUIStore(s => s.selectedMotionId ?? s.selectedTextId);
  const [globalScope, setGlobalScope] = useState(false);
  const targets = selectedEffectLayers({ tracks, textLayers }, ids, primaryId);
  const scoped = ids.length > 0 && !globalScope;
  const effects = scoped ? targets[0]?.effects ?? [] : globalEffects;
  const editEffects = (update: (effects: ActiveEffect[]) => ActiveEffect[]) => editSelectedEffects(activeEffectTargets().map(layer => layer.id), update);
  const addEffect = (effectId: string, values: Record<string, unknown>) => {
    if (!scoped) { useSceneStore.getState().addEffect(effectId, values); return; }
    const effect = { instanceId: crypto.randomUUID(), effectId, enabled: true, values };
    editEffects(list => list.length < 8 ? [...list, effect] : list);
  };
  const matchEffect = (list: ActiveEffect[], id: string) => {
    const direct = list.findIndex(effect => effect.instanceId === id);
    if (direct >= 0) return direct;
    const reference = effects.find(effect => effect.instanceId === id);
    if (!reference) return -1;
    const siblings = effects.filter(effect => effect.effectId === reference.effectId);
    const equivalent = list.filter(effect => effect.effectId === reference.effectId)[siblings.indexOf(reference)];
    return equivalent ? list.indexOf(equivalent) : -1;
  };
  const updateEffect = (id: string, update: (effect: ActiveEffect) => ActiveEffect) => {
    editEffects(list => {
      const index = matchEffect(list, id);
      return index < 0 ? list : list.map((effect, i) => i === index ? update(effect) : effect);
    });
  };
  const removeEffect = (id: string) => {
    if (!scoped) { useSceneStore.getState().removeEffect(id); return; }
    editEffects(list => {
      const index = matchEffect(list, id);
      return index < 0 ? list : list.filter((_, i) => i !== index);
    });
  };
  const toggleEffect = (id: string) => {
    if (!scoped) { useSceneStore.getState().toggleEffect(id); return; }
    const enabled = !effects.find(effect => effect.instanceId === id)?.enabled;
    updateEffect(id, effect => ({ ...effect, enabled }));
  };
  const setEffectValue = (id: string, key: string, value: unknown) => {
    if (!scoped) { useSceneStore.getState().setEffectValue(id, key, value); return; }
    updateEffect(id, effect => ({ ...effect, values: { ...effect.values, [key]: value } }));
  };
  const reorderEffects = (from: number, to: number) => {
    if (!scoped) { useSceneStore.getState().reorderEffects(from, to); return; }
    const moving = effects[from]?.instanceId, target = effects[to]?.instanceId;
    if (!moving || !target || moving === target) return;
    editEffects(list => {
      const a = matchEffect(list, moving), b = matchEffect(list, target);
      if (a < 0 || b < 0 || a === b) return list;
      const next = [...list], [effect] = next.splice(a, 1);
      next.splice(b, 0, effect);
      return next;
    });
  };
  const [pick, setPick] = useState(effectList[0]?.meta.id ?? '');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const finishMobileDrag = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = effects.findIndex((effect) => effect.instanceId === active.id);
    const to = effects.findIndex((effect) => effect.instanceId === over.id);
    if (from >= 0 && to >= 0) reorderEffects(from, to);
  };

  return (
    <section className="composition-effects">
      <div className="section-head">
        <span className="section-head-title">
          <span className="eyebrow">{t('effects')}</span>
          <InfoHint text={uiHelp('effects', locale)} name={t('effects')} />
        </span>
      </div>
      <div className="section-body">
        {ids.length > 0 && <div className="media-fit-pills" role="group" aria-label={tx(locale === 'pt', 'Aplicar efeitos em', 'Apply effects to')}>
          <button type="button" className={scoped ? 'active' : ''} aria-pressed={scoped} onClick={() => setGlobalScope(false)}>{tx(locale === 'pt', 'Seleção', 'Selection')}</button>
          <button type="button" className={scoped ? '' : 'active'} aria-pressed={!scoped} onClick={() => setGlobalScope(true)}>{tx(locale === 'pt', 'Composição', 'Composition')}</button>
        </div>}
        <div className="effect-add">
          <div className="field-with-hint">
            <select className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
              {effectList.map((e) => <option key={e.meta.id} value={e.meta.id}>{label(e.meta.name)}</option>)}
            </select>
            <InfoHint text={effectHelp(pick, locale)} name={label(getEffect(pick)?.meta.name ?? '')} />
          </div>
          <button className="btn" disabled={scoped ? !targets.length || targets.some(layer => (layer.effects?.length ?? 0) >= 8) : effects.length >= 8} onClick={() => pick && addEffect(pick, effectDefaults(pick))}>{t('add')}</button>
        </div>
        <p className="ctl-hint">{scoped ? txf(locale === 'pt', 'Aplicados a {n} da seleção, do mesmo tipo da camada ativa.', 'Applied to {n} selected layers of the active layer type.', { n: targets.length }) : tx(locale === 'pt', 'Aplicados ao quadro composto, de cima para baixo. Desative o olho para comparar. Até 8 efeitos por composição.', 'Applied to the composed frame, top to bottom. Toggle the eye to compare. Up to 8 effects per composition.')}</p>

        {mobile ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={finishMobileDrag}>
            <SortableContext items={effects.map((effect) => effect.instanceId)} strategy={verticalListSortingStrategy}>
              <div className="mobile-effects-list">
                {effects.map((effect) => (
                  <MobileEffectCard
                    key={effect.instanceId}
                    effect={effect}
                    onToggle={() => toggleEffect(effect.instanceId)}
                    onRemove={() => removeEffect(effect.instanceId)}
                    onValue={(key, value) => setEffectValue(effect.instanceId, key, value)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : effects.map((e, i) => {
          const def = getEffect(e.effectId);
          if (!def) return null;
          return (
            <div
              key={e.instanceId}
              className={`effect-card ${e.enabled ? '' : 'disabled'}`}
              onDragOver={(ev) => { if (ev.dataTransfer.types.includes('application/x-rp-effect')) ev.preventDefault(); }}
              onDrop={(ev) => { if (!ev.dataTransfer.types.includes('application/x-rp-effect')) return; ev.preventDefault(); if (dragIdx !== null && dragIdx !== i) reorderEffects(dragIdx, i); setDragIdx(null); }}
            >
              <div className="effect-card-head">
                <button type="button" className="drag-grip icon-btn" draggable aria-label={tx(locale === 'pt', 'Arrastar para ordenar efeito', 'Drag to reorder effect')}
                  onDragStart={ev => { ev.dataTransfer.setData('application/x-rp-effect', e.instanceId); ev.dataTransfer.effectAllowed = 'move'; setDragIdx(i); }} onDragEnd={() => setDragIdx(null)}>⣿</button>
                <span className="effect-title">{label(def.meta.name)}</span>
                <button className="icon-btn" aria-label={`${e.enabled ? (tx(locale === 'pt', 'Desativar', 'Disable')) : (tx(locale === 'pt', 'Ativar', 'Enable'))} ${label(def.meta.name)}`} onClick={() => toggleEffect(e.instanceId)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    {!e.enabled && <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>}
                  </svg>
                </button>
                <button className="icon-btn" aria-label={`${tx(locale === 'pt', 'Remover', 'Remove')} ${label(def.meta.name)}`} onClick={() => removeEffect(e.instanceId)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="effect-card-body">
                <p className="ctl-hint">{effectHelp(e.effectId, locale)}</p>
                {def.controls.filter(c => controlVisible(c, e.values)).map((c) => (
                  <ControlRow key={c.key} def={c} value={e.values[c.key]} onChange={(val) => setEffectValue(e.instanceId, c.key, val)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
