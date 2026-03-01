
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Unit, UnitType, PlayerId, Effect } from '../types';
import { CARD_CONFIG, COLORS } from '../constants';
import { gameService } from '../services/gameService';

interface UnitControlPanelProps {
    unit: Unit | null;
    isDevMode?: boolean;
    currentRound?: number;
    characterId?: string | null;
}

const EnergyIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
    </svg>
);

// Stat Square Component for compact grid
const StatSquare: React.FC<{ label: string; value: string | number; highlight?: boolean; color?: string }> = ({ label, value, highlight, color }) => (
    <div className={`flex flex-col items-center justify-center h-12 rounded-lg border transition-colors duration-200
        ${highlight
            ? 'border-yellow-500/40 bg-yellow-500/10'
            : 'border-green-800/40 bg-black/40 hover:bg-green-900/30'
        }
    `}>
        <div className="text-[8px] text-green-500/70 font-bold tracking-widest uppercase mb-0.5">{label}</div>
        <div className={`text-sm font-mono font-bold leading-none ${color ? '' : (highlight ? 'text-yellow-400' : 'text-gray-200')}`} style={{ color: color }}>
            {value}
        </div>
    </div>
);

interface AbilityButtonProps {
    label: string;
    icon: React.ReactNode;
    cost: number;
    description: string;
    onClick: () => void;
    disabled?: boolean;
    color: string;
    hotkey?: string;
    isPassive?: boolean;
    onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
    onLeave: () => void;
}

const AbilityButton: React.FC<AbilityButtonProps> = ({ label, icon, cost, description, onClick, disabled, color, hotkey, isPassive, onHover, onLeave }) => {

    const handleMouseEnter = (e: React.MouseEvent) => {
        const content = (
            <div className="w-52">
                <div className="flex justify-between items-start mb-1">
                    <div className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</div>
                    <div className={`text-[9px] font-mono px-1 rounded border ${isPassive ? 'text-yellow-400 border-yellow-900 bg-yellow-900/20' : 'text-green-400 border-green-900 bg-green-900/20'}`}>
                        {isPassive ? 'PASSIVE SYSTEM' : (hotkey ? `KEY: ${hotkey}` : 'ACTION')}
                    </div>
                </div>
                <div className="text-[10px] text-gray-400 leading-snug border-t border-gray-800 pt-2 mt-1">{description}</div>
                {!isPassive && cost > 0 && <div className="text-[9px] text-purple-400 mt-2 flex items-center gap-1 justify-end font-bold"><EnergyIcon /> REQUIRED: {cost}</div>}
            </div>
        );
        onHover(e, content);
    };

    return (
        <button
            onClick={isPassive ? undefined : onClick}
            disabled={disabled && !isPassive}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={onLeave}
            className={`group/btn relative flex items-center justify-between w-full px-3 py-2.5 border rounded-lg transition-all mb-2
                ${isPassive
                    ? 'bg-black/40 border-dashed hover:bg-gray-900/40 cursor-help'
                    : disabled
                        ? 'border-gray-800 bg-black/40 opacity-40 cursor-not-allowed'
                        : `bg-black/70 hover:bg-green-900/40 active:bg-green-900/60 active:scale-[0.98]`
                }
            `}
            style={{
                borderColor: (disabled && !isPassive) ? 'transparent' : `${color}60`,
                boxShadow: (disabled && !isPassive) ? 'none' : (isPassive ? 'none' : `0 0 10px -5px ${color}`)
            }}
        >
            {/* Left: Icon + Name */}
            <div className="flex items-center gap-3">
                <div className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded border bg-black/60 text-[11px] font-bold shadow-inner
                     ${(disabled && !isPassive) ? 'border-gray-800 text-gray-600' : ''}
                 `}
                    style={{
                        borderColor: (disabled && !isPassive) ? undefined : `${color}80`,
                        color: (disabled && !isPassive) ? undefined : color
                    }}
                >
                    {icon}
                </div>
                <div className="flex flex-col items-start text-left">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isPassive ? 'text-gray-400' : (disabled ? 'text-gray-600' : 'text-gray-200 group-hover/btn:text-white')}`}>
                        {label}
                    </div>
                    <div className={`text-[8px] font-mono leading-none mt-0.5 ${isPassive ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {isPassive ? '[ALWAYS ACTIVE]' : (hotkey ? `[${hotkey}]` : 'ABILITY')}
                    </div>
                </div>
            </div>

            {/* Right: Cost or Passive Badge */}
            {isPassive ? (
                <div className="text-[8px] font-mono text-gray-500 bg-gray-900/50 px-1 py-0.5 rounded border border-gray-800">
                    AUTO
                </div>
            ) : (
                cost > 0 && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${disabled ? 'bg-transparent' : 'bg-purple-900/20 border border-purple-500/30'}`}>
                        <div className={disabled ? "text-gray-700" : "text-purple-400"}><EnergyIcon /></div>
                        <span className={`text-[10px] font-mono font-bold ${disabled ? 'text-gray-700' : 'text-purple-300'}`}>{cost}</span>
                    </div>
                )
            )}
        </button>
    );
};

const UnitControlPanel: React.FC<UnitControlPanelProps> = ({ unit, isDevMode, currentRound, characterId }) => {
    // Draggable State
    const [pos, setPos] = useState(() => {
        const x = typeof window !== 'undefined' ? window.innerWidth - 320 : 0;
        const y = 80;
        return { x, y };
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    // Tooltip State
    const [tooltip, setTooltip] = useState<{ content: React.ReactNode, x: number, y: number, align: 'left' | 'top' } | null>(null);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: pos.x, y: pos.y };
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
        };
        const onUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isDragging]);

    // Tooltip Handlers
    const handleShowTooltip = (e: React.MouseEvent, content: React.ReactNode, align: 'left' | 'top' = 'left') => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            content,
            x: align === 'left' ? rect.left : rect.left + rect.width / 2,
            y: align === 'left' ? rect.top + rect.height / 2 : rect.top,
            align
        });
    };

    const handleHideTooltip = () => {
        setTooltip(null);
    };

    if (!unit) return null;

    const config = CARD_CONFIG[unit.type];
    const isP1 = unit.playerId === PlayerId.ONE;
    const isNeutral = unit.playerId === PlayerId.NEUTRAL;
    const mainColor = isP1 ? COLORS.P1 : isNeutral ? COLORS.NEUTRAL : COLORS.P2;

    // Calculate HP percentage
    const hpPercent = (unit.stats.hp / unit.stats.maxHp) * 100;
    const hasEnergy = unit.stats.maxEnergy > 0;
    const energyPercent = hasEnergy ? (unit.stats.energy / unit.stats.maxEnergy) * 100 : 0;

    return (
        <>
            <div
                className="absolute w-72 flex flex-col pointer-events-auto font-mono z-20 transition-opacity duration-200"
                style={{ left: pos.x, top: pos.y }}
            >
                {/* Container - Match other windows: Dark bg, thicker brighter border */}
                <div className="bg-black/80 backdrop-blur-md border-2 border-green-500/60 shadow-[0_0_30px_rgba(0,255,0,0.15)] rounded-xl flex flex-col overflow-hidden">

                    {/* Header */}
                    <div
                        onMouseDown={onMouseDown}
                        className="px-4 py-3 bg-green-900/30 border-b border-green-500/50 flex justify-between items-center cursor-move select-none group"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mainColor, boxShadow: `0 0 8px ${mainColor}` }} />
                            <h2 className="text-xs font-bold text-white uppercase tracking-[0.15em]">{config?.name || 'UNKNOWN UNIT'}</h2>
                        </div>
                        <div className="text-[9px] font-bold px-2 py-0.5 rounded bg-black/60 border border-green-900/50" style={{ color: mainColor }}>
                            {isP1 ? 'PLAYER 1' : isNeutral ? 'NEUTRAL' : 'PLAYER 2'}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex flex-col gap-5">

                        {/* Status Bars */}
                        <div className="space-y-2.5">
                            {/* HP */}
                            <div>
                                <div className="flex justify-between mb-1 text-[9px] font-bold text-gray-400 tracking-wider">
                                    <span>INTEGRITY</span>
                                    <span className="text-white font-mono">{unit.stats.hp} <span className="text-gray-600">/</span> {unit.stats.maxHp}</span>
                                </div>
                                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-gray-800">
                                    <div
                                        className="h-full transition-all duration-300 relative"
                                        style={{ width: `${hpPercent}%`, backgroundColor: mainColor }}
                                    >
                                        <div className="absolute inset-0 bg-white/20" />
                                    </div>
                                </div>
                            </div>

                            {/* Energy */}
                            {hasEnergy && (
                                <div>
                                    <div className="flex justify-between mb-1 text-[9px] font-bold text-purple-400/80 tracking-wider">
                                        <span>ENERGY</span>
                                        <span className="text-purple-200 font-mono">{unit.stats.energy} <span className="text-gray-600">/</span> {unit.stats.maxEnergy}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-gray-800">
                                        <div
                                            className="h-full transition-all duration-300 relative"
                                            style={{ width: `${energyPercent}%`, backgroundColor: '#a855f7' }}
                                        >
                                            <div className="absolute inset-0 bg-white/20" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats Grid (4 Columns) */}
                        <div className="grid grid-cols-4 gap-2">
                            <StatSquare label="ATTACK" value={unit.stats.attack} />
                            <StatSquare label="RANGE" value={unit.stats.range} />
                            <StatSquare
                                label="MOVES"
                                value={
                                    <span>
                                        <span className="text-white">{Math.max(0, unit.stats.movement - unit.status.stepsTaken)}</span>
                                        <span className="text-gray-600 text-[10px] align-top">/{unit.stats.movement}</span>
                                    </span> as any
                                }
                            />
                            <StatSquare label="LEVEL" value={unit.level} highlight />
                        </div>

                        {/* Active Effects */}
                        {unit.effects.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap pb-1">
                                {unit.effects.map(effect => (
                                    <div
                                        key={effect.id}
                                        className="group relative flex items-center justify-center w-7 h-7 rounded bg-black/60 border border-green-900/50 text-sm cursor-help hover:bg-green-900/20 hover:border-green-500/50 transition-colors"
                                        onMouseEnter={(e) => handleShowTooltip(e, (
                                            <div className="w-48">
                                                <div className="text-[10px] font-bold text-white uppercase mb-1">{effect.name}</div>
                                                <div className="text-[9px] text-gray-400 leading-tight mb-2 border-b border-gray-800 pb-2">{effect.description}</div>
                                                <div className="text-[9px] font-mono text-green-400 flex justify-between">
                                                    <span>DURATION</span>
                                                    <span className="text-white font-bold">{effect.duration}/{effect.maxDuration} RNDS</span>
                                                </div>
                                            </div>
                                        ), 'top')}
                                        onMouseLeave={handleHideTooltip}
                                    >
                                        <span className="select-none">{effect.icon}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Divider */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-green-900/50 to-transparent" />

                        {/* Info Section */}
                        <div>
                            <h3 className="text-[9px] text-green-500/80 font-bold uppercase mb-2 tracking-widest">Database Entry</h3>
                            <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                                {config?.description || "No tactical data available."}
                            </p>
                        </div>

                        {/* Abilities Section */}
                        <div>
                            <h3 className="text-[9px] text-green-500/80 font-bold uppercase mb-2 tracking-widest">Active Systems</h3>
                            <div className="flex flex-col">

                                {/* TITAN: SPLASH DAMAGE (Passive) */}
                                {unit.type === UnitType.TITAN && (
                                    <AbilityButton
                                        label="SPLASH ROUNDS"
                                        icon="💥"
                                        cost={0}
                                        description="High-Caliber shells deal 25 damage to units adjacent to the primary target."
                                        onClick={() => { }}
                                        isPassive
                                        color="#facc15" // yellow-400
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* APEX BLADE: DOUBLE STRIKE (Passive) */}
                                {unit.type === UnitType.CONE && (
                                    <AbilityButton
                                        label="DOUBLE STRIKE"
                                        icon="⚔️"
                                        cost={0}
                                        description="Neural reflexes allow this unit to attack twice per turn."
                                        onClick={() => { }}
                                        isPassive
                                        color="#f472b6" // pink-400
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* CHARGING STATION: INDUCTIVE FIELD (Passive) */}
                                {unit.type === UnitType.CHARGING_STATION && (
                                    <AbilityButton
                                        label="INDUCTIVE FIELD"
                                        icon="⚡"
                                        cost={0}
                                        description="Restores 25 Energy to adjacent friendly units at the end of each turn."
                                        onClick={() => { }}
                                        isPassive
                                        color="#22d3ee" // cyan-400
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* HEAVY: SUICIDE PROTOCOL */}
                                {unit.type === UnitType.HEAVY && (
                                    <AbilityButton
                                        label="SUICIDE PROTOCOL"
                                        icon="!"
                                        cost={0}
                                        description="Self-destruct; deals 50 DMG to adjacent units."
                                        onClick={() => gameService.triggerSuicide(unit.id)}
                                        color="#ef4444" // red-500
                                        hotkey="SHIFT+1"
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* SUICIDE DRONE: DETONATE */}
                                {unit.type === UnitType.SUICIDE_DRONE && (
                                    <AbilityButton
                                        label="DETONATE"
                                        icon="X"
                                        cost={0}
                                        description="Explosive payload; deals 80 DMG to area."
                                        onClick={() => gameService.triggerDroneExplosion(unit.id)}
                                        color="#f97316" // orange-500
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* MEDIC & REPAIR BOT: HEAL */}
                                {(unit.type === UnitType.MEDIC || unit.type === UnitType.REPAIR_BOT) && (
                                    <>
                                        <AbilityButton
                                            label={unit.type === UnitType.REPAIR_BOT ? "STRUCTURAL REPAIR" : "NANO-REPAIR"}
                                            icon="+"
                                            cost={25}
                                            description={unit.type === UnitType.REPAIR_BOT
                                                ? "Repair target unit or building for 50 HP."
                                                : `Heal friendly unit within 2 tiles for ${50 + (characterId === 'NYX' && (currentRound || 0) >= 10 ? unit.level : 0)} HP.${characterId === 'NYX' && (currentRound || 0) >= 10 ? ' Can repair buildings.' : ''}`}
                                            onClick={() => gameService.activateHealAbility(unit.id)}
                                            disabled={unit.stats.energy < 25}
                                            color="#10b981" // emerald-500
                                            onHover={handleShowTooltip}
                                            onLeave={handleHideTooltip}
                                        />

                                        {characterId === 'NYX' && (currentRound || 0) >= 25 && unit.type === UnitType.MEDIC && (
                                            <AbilityButton
                                                label="RESTORE ENERGY"
                                                icon="⚡"
                                                cost={25}
                                                description="Restore 50 Energy to a friendly unit within 2 tiles."
                                                onClick={() => gameService.activateRestoreEnergyAbility(unit.id)}
                                                disabled={unit.stats.energy < 25}
                                                color="#8b5cf6" // violet-500
                                                onHover={handleShowTooltip}
                                                onLeave={handleHideTooltip}
                                            />
                                        )}
                                    </>
                                )}

                                {/* SOLDIER: TELEPORT + FREEZE */}
                                {unit.type === UnitType.SOLDIER && (
                                    <>
                                        <AbilityButton
                                            label="PHASE SHIFT"
                                            icon="T"
                                            cost={25}
                                            description="Teleport to any revealed coordinate."
                                            onClick={() => gameService.activateTeleportAbility(unit.id)}
                                            disabled={unit.stats.energy < 25}
                                            color="#22d3ee" // Cyan-400 (Electric Blue/Cyan)
                                            hotkey="T"
                                            onHover={handleShowTooltip}
                                            onLeave={handleHideTooltip}
                                        />

                                        <AbilityButton
                                            label="CRYO SHOT"
                                            icon="❄️"
                                            cost={50}
                                            description="Freeze target unit for 2 turns."
                                            onClick={() => gameService.activateFreezeAbility(unit.id)}
                                            disabled={unit.stats.energy < 50}
                                            color="#67e8f9" // Cyan-300 (Ice Blue)
                                            hotkey="S"
                                            onHover={handleShowTooltip}
                                            onLeave={handleHideTooltip}
                                        />
                                    </>
                                )}

                                {unit.type === UnitType.CONE && (
                                    <AbilityButton
                                        label="SUMMON DRONES"
                                        icon="S"
                                        cost={50}
                                        description="Deploy 2 Scout Drones nearby."
                                        onClick={() => gameService.activateSummonAbility(unit.id)}
                                        disabled={unit.stats.energy < 50}
                                        color="#3b82f6" // blue-500
                                        hotkey="D"
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* HACKER: MIND CONTROL */}
                                {unit.type === UnitType.HACKER && (
                                    <AbilityButton
                                        label={unit.status.mindControlTargetId ? "BREAK LINK" : "MIND CONTROL"}
                                        icon="🧠"
                                        cost={unit.status.mindControlTargetId ? 0 : 50}
                                        description={unit.status.mindControlTargetId ? "Sever connection to controlled unit." : "Take control of an enemy unit. Effect ends on movement or damage."}
                                        onClick={() => gameService.activateMindControlAbility(unit.id)}
                                        disabled={!unit.status.mindControlTargetId && unit.stats.energy < 50}
                                        color="#22c55e" // green-500
                                        hotkey="M"
                                        onHover={handleShowTooltip}
                                        onLeave={handleHideTooltip}
                                    />
                                )}

                                {/* DEV MODE: DESTROY */}
                                {isDevMode && (
                                    <>
                                        <AbilityButton
                                            label="ROTATE 90°"
                                            icon="↻"
                                            cost={0}
                                            description="[DEV] Rotate unit 90 degrees."
                                            onClick={() => gameService.rotateUnit(unit.id)}
                                            color="#facc15" // yellow-400
                                            onHover={handleShowTooltip}
                                            onLeave={handleHideTooltip}
                                        />
                                        <AbilityButton
                                            label="DESTROY"
                                            icon="☠"
                                            cost={0}
                                            description="[DEV] Instantly remove unit from simulation."
                                            onClick={() => gameService.destroyUnit(unit.id)}
                                            color="#d946ef" // fuchsia-500
                                            onHover={handleShowTooltip}
                                            onLeave={handleHideTooltip}
                                        />
                                    </>
                                )}

                                {/* Generic Placeholder if no abilities */}
                                {unit.type !== UnitType.HEAVY && unit.type !== UnitType.CONE && unit.type !== UnitType.SOLDIER && unit.type !== UnitType.SUICIDE_DRONE && unit.type !== UnitType.MEDIC && unit.type !== UnitType.TITAN && unit.type !== UnitType.CHARGING_STATION && unit.type !== UnitType.HACKER && !isDevMode && (
                                    <div className="text-[10px] text-gray-500 text-center py-3 border border-dashed border-gray-800 rounded bg-black/40">
                                        NO ACTIVE MODULES DETECTED
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Portal Tooltip */}
            {tooltip && createPortal(
                <div
                    className="fixed z-[9999] bg-black/95 border border-green-900/80 rounded-lg p-3 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md pointer-events-none transition-opacity duration-200"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: tooltip.align === 'left' ? 'translate(-100%, -50%) translate(-12px, 0)' : 'translate(-50%, -100%) translate(0, -12px)',
                    }}
                >
                    {tooltip.content}
                </div>,
                document.body
            )}
        </>
    );
};

export default UnitControlPanel;
