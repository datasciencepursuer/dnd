import { useState } from "react";
import type { WallSegment, AreaShape, WallType, TerrainType, DamageType } from "../../types";
import { DAMAGE_TYPES } from "../../types";

const WALL_TYPE_OPTIONS: { value: WallType; label: string }[] = [
  { value: "wall", label: "Wall" },
  { value: "half-wall", label: "Half Wall" },
  { value: "window", label: "Window" },
  { value: "arrow-slit", label: "Arrow Slit" },
  { value: "door-closed", label: "Door (Closed)" },
  { value: "door-open", label: "Door (Open)" },
  { value: "door-locked", label: "Door (Locked)" },
  { value: "pillar", label: "Pillar" },
  { value: "fence", label: "Fence" },
];

const TERRAIN_TYPE_OPTIONS: { value: TerrainType; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "difficult", label: "Difficult" },
  { value: "water-shallow", label: "Shallow Water" },
  { value: "water-deep", label: "Deep Water" },
  { value: "ice", label: "Ice" },
  { value: "lava", label: "Lava" },
  { value: "pit", label: "Pit" },
  { value: "chasm", label: "Chasm" },
  { value: "elevated", label: "Elevated" },
  { value: "vegetation", label: "Vegetation" },
  { value: "darkness", label: "Darkness" },
  { value: "trap", label: "Trap" },
];

interface WallAreaPanelProps {
  selectedWall: WallSegment | null;
  selectedArea: AreaShape | null;
  onUpdateWall?: (id: string, updates: Partial<WallSegment>) => void;
  onDeleteWall?: (id: string) => void;
  onUpdateArea?: (id: string, updates: Partial<AreaShape>) => void;
  onDeleteArea?: (id: string) => void;
}

export function WallAreaPanel({
  selectedWall,
  selectedArea,
  onUpdateWall,
  onDeleteWall,
  onUpdateArea,
  onDeleteArea,
}: WallAreaPanelProps) {
  if (selectedWall) {
    return (
      <div className="p-3 space-y-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Wall Properties</h3>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Wall Type</label>
          <select
            value={selectedWall.wallType}
            onChange={(e) => onUpdateWall?.(selectedWall.id, { wallType: e.target.value as WallType })}
            className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {WALL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => onDeleteWall?.(selectedWall.id)}
          className="w-full px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer"
        >
          Delete Wall
        </button>
      </div>
    );
  }

  if (selectedArea) {
    return (
      <div className="p-3 space-y-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Area Properties</h3>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Terrain Type</label>
          <select
            value={selectedArea.terrainType}
            onChange={(e) => onUpdateArea?.(selectedArea.id, { terrainType: e.target.value as TerrainType })}
            className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {TERRAIN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Label</label>
          <input
            type="text"
            value={selectedArea.label ?? ""}
            onChange={(e) => onUpdateArea?.(selectedArea.id, { label: e.target.value || undefined })}
            placeholder="Optional label"
            className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Elevation (ft)</label>
          <input
            type="number"
            value={selectedArea.elevation}
            onChange={(e) => onUpdateArea?.(selectedArea.id, { elevation: Math.max(0, parseInt(e.target.value) || 0) })}
            min={0}
            step={5}
            className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* Hazard config */}
        <HazardConfig
          area={selectedArea}
          onUpdate={(updates) => onUpdateArea?.(selectedArea.id, updates)}
        />

        {/* Trap config */}
        {selectedArea.terrainType === "trap" && (
          <TrapConfig
            area={selectedArea}
            onUpdate={(updates) => onUpdateArea?.(selectedArea.id, updates)}
          />
        )}

        <button
          onClick={() => onDeleteArea?.(selectedArea.id)}
          className="w-full px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer"
        >
          Delete Area
        </button>
      </div>
    );
  }

  return null;
}

function HazardConfig({ area, onUpdate }: { area: AreaShape; onUpdate: (updates: Partial<AreaShape>) => void }) {
  const hasHazard = !!area.hazard;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={hasHazard}
          onChange={(e) => {
            if (e.target.checked) {
              onUpdate({
                hazard: {
                  damage: "1d6",
                  damageType: "Fire",
                  trigger: "on-enter",
                },
              });
            } else {
              onUpdate({ hazard: undefined });
            }
          }}
          className="rounded"
        />
        Hazard
      </label>
      {hasHazard && area.hazard && (
        <div className="pl-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={area.hazard.damage}
              onChange={(e) => onUpdate({ hazard: { ...area.hazard!, damage: e.target.value } })}
              placeholder="1d6"
              className="w-16 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <select
              value={area.hazard.damageType}
              onChange={(e) => onUpdate({ hazard: { ...area.hazard!, damageType: e.target.value as DamageType } })}
              className="flex-1 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {DAMAGE_TYPES.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>
          <select
            value={area.hazard.trigger}
            onChange={(e) => onUpdate({ hazard: { ...area.hazard!, trigger: e.target.value as "on-enter" | "start-of-turn" | "both" } })}
            className="w-full text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <option value="on-enter">On Enter</option>
            <option value="start-of-turn">Start of Turn</option>
            <option value="both">Both</option>
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              value={area.hazard.saveDC ?? ""}
              onChange={(e) => onUpdate({ hazard: { ...area.hazard!, saveDC: e.target.value ? parseInt(e.target.value) : undefined } })}
              placeholder="DC"
              className="w-14 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <select
              value={area.hazard.saveAbility ?? "dexterity"}
              onChange={(e) => onUpdate({ hazard: { ...area.hazard!, saveAbility: e.target.value as any } })}
              className="flex-1 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="strength">STR</option>
              <option value="dexterity">DEX</option>
              <option value="constitution">CON</option>
              <option value="intelligence">INT</option>
              <option value="wisdom">WIS</option>
              <option value="charisma">CHA</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function TrapConfig({ area, onUpdate }: { area: AreaShape; onUpdate: (updates: Partial<AreaShape>) => void }) {
  const hasTrap = !!area.trap;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={hasTrap}
          onChange={(e) => {
            if (e.target.checked) {
              onUpdate({
                trap: {
                  damage: "2d6",
                  damageType: "Piercing",
                  saveDC: 13,
                  saveAbility: "dexterity",
                  armed: true,
                  hidden: true,
                },
              });
            } else {
              onUpdate({ trap: undefined });
            }
          }}
          className="rounded"
        />
        Trap
      </label>
      {hasTrap && area.trap && (
        <div className="pl-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={area.trap.damage}
              onChange={(e) => onUpdate({ trap: { ...area.trap!, damage: e.target.value } })}
              placeholder="2d6"
              className="w-16 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <select
              value={area.trap.damageType}
              onChange={(e) => onUpdate({ trap: { ...area.trap!, damageType: e.target.value as DamageType } })}
              className="flex-1 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {DAMAGE_TYPES.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={area.trap.saveDC}
              onChange={(e) => onUpdate({ trap: { ...area.trap!, saveDC: parseInt(e.target.value) || 10 } })}
              className="w-14 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <select
              value={area.trap.saveAbility}
              onChange={(e) => onUpdate({ trap: { ...area.trap!, saveAbility: e.target.value as any } })}
              className="flex-1 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="strength">STR</option>
              <option value="dexterity">DEX</option>
              <option value="constitution">CON</option>
              <option value="intelligence">INT</option>
              <option value="wisdom">WIS</option>
              <option value="charisma">CHA</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={area.trap.armed}
              onChange={(e) => onUpdate({ trap: { ...area.trap!, armed: e.target.checked } })}
              className="rounded"
            />
            Armed
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={area.trap.hidden}
              onChange={(e) => onUpdate({ trap: { ...area.trap!, hidden: e.target.checked } })}
              className="rounded"
            />
            Hidden
          </label>
          <input
            type="text"
            value={area.trap.description ?? ""}
            onChange={(e) => onUpdate({ trap: { ...area.trap!, description: e.target.value || undefined } })}
            placeholder="DM notes..."
            className="w-full text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          />
        </div>
      )}
    </div>
  );
}
