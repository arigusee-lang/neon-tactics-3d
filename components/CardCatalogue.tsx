
import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { UnitType, CardCategory } from '../types';
import { CARD_CONFIG, COLORS } from '../constants';
import { TALENT_POOL } from '../services/gameService';
import UnitPreview from './UnitPreview';

interface CardCatalogueProps {
    onClose: () => void;
}

const UNIT_ABILITIES = [
    { id: 'ABIL_PHASE', name: 'Phase Shift', type: 'ACTIVE', cost: 25, description: 'Instantly teleport to any revealed coordinate on the map.', color: '#22d3ee', icon: 'T' },
    { id: 'ABIL_CRYO', name: 'Cryo Shot', type: 'ACTIVE', cost: 50, description: 'Freezes target unit for 2 turns, preventing movement and action.', color: '#67e8f9', icon: '❄️' },
    { id: 'ABIL_REPAIR', name: 'Nano-Repair', type: 'ACTIVE', cost: 25, description: 'Restores 50 HP to a friendly biological or mechanical unit.', color: '#10b981', icon: '+' },
    { id: 'ABIL_SUMMON', name: 'Swarm Link', type: 'ACTIVE', cost: 50, description: 'Deploys 2 temporary Scout Drones to adjacent tiles.', color: '#3b82f6', icon: 'S' },
    { id: 'ABIL_SUICIDE', name: 'Overload', type: 'ACTIVE', cost: 0, description: 'Overloads reactor core to deal massive area damage (50 DMG). Destroys unit.', color: '#ef4444', icon: '!' },
    { id: 'ABIL_DETONATE', name: 'Detonate', type: 'ACTIVE', cost: 0, description: 'Triggers explosive payload dealing 80 area damage. Consumes unit.', color: '#f97316', icon: 'X' },
    { id: 'ABIL_SPLASH', name: 'Splash Rounds', type: 'PASSIVE', cost: 0, description: 'Projectiles explode on impact, dealing 25 damage to adjacent tiles.', color: '#facc15', icon: '💥' },
    { id: 'ABIL_DOUBLE', name: 'Double Strike', type: 'PASSIVE', cost: 0, description: 'Neural overclock allows unit to perform two attack actions per turn.', color: '#f472b6', icon: '⚔️' },
    { id: 'ABIL_INDUCT', name: 'Inductive Field', type: 'PASSIVE', cost: 0, description: 'Wireless energy transfer restores 25 Energy to adjacent allies per turn.', color: '#22d3ee', icon: '⚡' }
];

const COLLECTIBLES = [
    { id: 'MONEY_PRIZE', name: 'Credit Cache', description: 'Grants $50 credits to the collecting player.', color: '#4ade80', icon: '$' },
    { id: 'HEALTH_PACK', name: 'Nanite Medkit', description: 'Restores 75 HP to the unit that picks it up.', color: '#ef4444', icon: '+' },
    { id: 'ENERGY_CELL', name: 'Plasma Cell', description: 'Restores 50 Energy to the unit that picks it up.', color: '#a855f7', icon: '⚡' }
];

const CardCatalogue: React.FC<CardCatalogueProps> = ({ onClose }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Get all available unit types from config
    const allTypes = useMemo(() => Object.keys(CARD_CONFIG) as UnitType[], []);

    const unitTypes = useMemo(() => allTypes.filter(t => CARD_CONFIG[t]?.category === CardCategory.UNIT), [allTypes]);
    const actionTypes = useMemo(() => allTypes.filter(t => CARD_CONFIG[t]?.category === CardCategory.ACTION), [allTypes]);

    // Select first type on mount
    useEffect(() => {
        if (!selectedId && unitTypes.length > 0) {
            setSelectedId(unitTypes[0]);
        }
    }, [unitTypes, selectedId]);

    // Icon generator
    const getIcon = (type: string, color: string) => {
        const p = { width: "100%", height: "100%", fill: "none", stroke: color, strokeWidth: "2", vectorEffect: "non-scaling-stroke" as const };

        // Ability check
        const ability = UNIT_ABILITIES.find(a => a.id === type);
        if (ability) {
            return <div className="text-xl font-bold flex items-center justify-center w-full h-full" style={{ color }}>{ability.icon}</div>;
        }

        // Talent check
        const talent = TALENT_POOL.find(t => t.id === type);
        if (talent) {
            return <div className="text-2xl font-bold flex items-center justify-center w-full h-full filter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{talent.icon}</div>;
        }

        // Collectible check
        const collectible = COLLECTIBLES.find(c => c.id === type);
        if (collectible) {
            return <div className="text-2xl font-bold flex items-center justify-center w-full h-full" style={{ color }}>{collectible.icon}</div>;
        }

        switch (type) {
            case UnitType.SOLDIER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="6" r="4" /><path d="M6 22V14C6 11 12 11 12 11V22" /></svg>;
            case UnitType.HEAVY: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" /><rect x="8" y="8" width="8" height="8" fill="currentColor" fillOpacity="0.2" /></svg>;
            case UnitType.MEDIC: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2V22 M2 12H22" strokeWidth="4" /><rect x="6" y="6" width="12" height="12" stroke="none" fill="currentColor" fillOpacity="0.1" /></svg>;
            case UnitType.LIGHT_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M4 14H20M2 18H22M6 10H18L16 6H8L6 10Z" /><rect x="4" y="14" width="16" height="6" fill="currentColor" fillOpacity="0.2" /></svg>;
            case UnitType.HEAVY_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M2 16H22M4 12H20L18 4H6L4 12Z" /><rect x="2" y="16" width="20" height="6" fill="currentColor" fillOpacity="0.2" /><line x1="8" y1="12" x2="8" y2="4" strokeWidth="3" /><line x1="16" y1="12" x2="16" y2="4" strokeWidth="3" /></svg>;
            case UnitType.BOX: return <svg viewBox="0 0 24 24" {...p}><rect x="8" y="8" width="8" height="8" /><path d="M2 12H8 M16 22H22" /></svg>;
            case UnitType.HACKER: return <svg viewBox="0 0 24 24" {...p}><path d="M4 6h16v10H4z" /><path d="M2 18h20v2H2z" /><path d="M11 14h2" /></svg>;
            case UnitType.SUICIDE_DRONE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="6" /><path d="M12 6V2 M12 22V18 M6 12H2 M22 12H18 M16 16L20 20 M4 4L8 8 M20 4L16 8 M8 16L4 20" /></svg>;
            case UnitType.TITAN: return <svg viewBox="0 0 24 24" {...p}><rect x="4" y="8" width="16" height="12" /><path d="M12 2V8" /></svg>;
            case UnitType.SPIKE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L15 22L12 18L9 22L12 2Z" /></svg>;

            case UnitType.SYSTEM_FREEZE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="8" strokeDasharray="2 2" /><path d="M12 4V20 M4 12H20" /></svg>;
            case UnitType.CONE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L4 20H20L12 2Z" /></svg>;
            case UnitType.WALL: return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 6V18 M18 6V18 M2 12H22" /></svg>;
            case UnitType.TOWER: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L6 22H18L12 2Z" /><line x1="12" y1="2" x2="12" y2="22" /><circle cx="12" cy="8" r="2" /></svg>;
            case UnitType.CHARGING_STATION: return <svg viewBox="0 0 24 24" {...p}><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" /><rect x="4" y="20" width="16" height="2" fill="currentColor" /></svg>;
            case UnitType.ION_CANNON: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2V6 M12 18V22 M2 12H6 M18 12H22" /><path d="M19.07 4.93L16.24 7.76 M7.76 16.24L4.93 19.07" /><path d="M4.93 4.93L7.76 7.76 M16.24 16.24L19.07 19.07" /></svg>;
            case UnitType.PORTAL: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="8" strokeWidth="3" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
            case UnitType.SNIPER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10" strokeWidth="1" opacity="0.5" /><line x1="12" y1="2" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="2" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="22" y2="12" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
            default: return <div className="w-4 h-4 bg-current" />;
        }
    };

    const renderGridItem = (type: string, isAbility: boolean = false, isTalent: boolean = false, isCollectible: boolean = false) => {
        let name = type;
        let cost: number | string = 0;
        let categoryStr = 'UNIT';
        let config: any = null;
        let ability: any = null;
        let talent: any = null;
        let collectible: any = null;

        if (isCollectible) {
            collectible = COLLECTIBLES.find(c => c.id === type);
            if (collectible) {
                name = collectible.name;
                cost = 'PICKUP';
                categoryStr = 'ITEM';
            }
        } else if (isTalent) {
            talent = TALENT_POOL.find(t => t.id === type);
            if (talent) {
                name = talent.name;
                cost = 'PERK';
                categoryStr = 'UPGRADE';
            }
        } else if (isAbility) {
            ability = UNIT_ABILITIES.find(a => a.id === type);
            if (ability) {
                name = ability.name;
                cost = ability.type === 'PASSIVE' ? 'PASSIVE' : ability.cost;
                categoryStr = 'MODULE';
            }
        } else {
            config = CARD_CONFIG[type as UnitType];
            if (config) {
                name = config.name;
                cost = config.cost;
                categoryStr = config.category === CardCategory.ACTION ? 'ACTION' : 'UNIT';
            }
        }

        const isSelected = selectedId === type;
        const isAction = categoryStr === 'ACTION';
        const isModule = categoryStr === 'MODULE';
        const isUpgrade = categoryStr === 'UPGRADE';
        const isItem = categoryStr === 'ITEM';

        let borderColor = 'border-gray-700';
        let bgColor = 'bg-black/60';
        let hoverClass = 'hover:border-gray-500 hover:bg-gray-800/60';

        if (isSelected) {
            if (isUpgrade) {
                borderColor = 'border-blue-400';
                bgColor = 'bg-blue-900/40';
            } else if (isModule) {
                borderColor = 'border-yellow-400';
                bgColor = 'bg-yellow-900/40';
            } else if (isAction) {
                borderColor = 'border-purple-400';
                bgColor = 'bg-purple-900/40';
            } else if (isItem) {
                borderColor = 'border-pink-400';
                bgColor = 'bg-pink-900/40';
            } else {
                borderColor = 'border-green-400';
                bgColor = 'bg-green-900/40';
            }
            hoverClass = '';
        } else {
            if (isUpgrade) hoverClass = 'hover:border-blue-500/50 hover:bg-blue-900/20';
            else if (isModule) hoverClass = 'hover:border-yellow-500/50 hover:bg-yellow-900/20';
            else if (isAction) hoverClass = 'hover:border-purple-500/50 hover:bg-purple-900/20';
            else if (isItem) hoverClass = 'hover:border-pink-500/50 hover:bg-pink-900/20';
            else hoverClass = 'hover:border-green-500/50 hover:bg-green-900/20';
        }

        const iconColor = isSelected ? '#fff' : (isUpgrade ? (talent?.color || '#60a5fa') : (isModule ? (ability?.color || '#fbbf24') : (isAction ? '#a855f7' : (isItem ? (collectible?.color || '#f472b6') : COLORS.P1))));

        return (
            <div
                key={type}
                onClick={() => setSelectedId(type)}
                className={`
                    relative flex flex-col items-center justify-between p-2 rounded-lg border cursor-pointer transition-all duration-200
                    h-24 w-full ${borderColor} ${bgColor} ${hoverClass}
                    ${isSelected ? 'shadow-[0_0_15px_rgba(0,0,0,0.5)]' : ''}
                `}
            >
                <div className="w-8 h-8 opacity-90 mt-1 flex items-center justify-center">
                    {getIcon(type, iconColor)}
                </div>

                <div className="text-center w-full">
                    <div className={`text-[8px] font-bold uppercase truncate ${isSelected ? 'text-white' : (isUpgrade ? 'text-blue-200' : (isModule ? 'text-yellow-200' : (isAction ? 'text-purple-300' : (isItem ? 'text-pink-300' : 'text-gray-400'))))}`}>
                        {name}
                    </div>
                    <div className={`text-[9px] font-mono font-bold ${typeof cost === 'string' ? 'text-[8px]' : ''} text-gray-500`}>
                        {typeof cost === 'number' ? `$${cost}` : cost}
                    </div>
                </div>
            </div>
        );
    };

    // Determine what is selected
    const selectedConfig = selectedId && (CARD_CONFIG[selectedId as UnitType] || null);
    const selectedAbility = selectedId && UNIT_ABILITIES.find(a => a.id === selectedId);
    const selectedTalent = selectedId && TALENT_POOL.find(t => t.id === selectedId);
    const selectedCollectible = selectedId && COLLECTIBLES.find(c => c.id === selectedId);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex w-[90vw] max-w-5xl h-[80vh] border border-cyan-500/30 bg-black/80 rounded-2xl shadow-[0_0_50px_rgba(0,255,255,0.1)] overflow-hidden backdrop-blur-xl">

                {/* LEFT PANEL: GRID */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800/50">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-cyan-900/10 to-transparent border-b border-cyan-500/20">
                        <div>
                            <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-300 uppercase tracking-widest">
                                Database
                            </h2>
                            <div className="text-[9px] font-mono text-cyan-400/60 mt-1">
                                FULL SYSTEM CATALOGUE
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                        {/* Units Section */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-cyan-900/30 pb-2">
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                                Combat Units
                            </h3>
                            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                {unitTypes.map(type => renderGridItem(type))}
                            </div>
                        </div>

                        {/* Actions Section */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-purple-900/30 pb-2">
                                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                                Tactical Abilities
                            </h3>
                            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                {actionTypes.map(type => renderGridItem(type))}
                            </div>
                        </div>

                        {/* Unit Abilities Section */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-yellow-900/30 pb-2">
                                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                                Unit Modules
                            </h3>
                            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                {UNIT_ABILITIES.map(abil => renderGridItem(abil.id, true, false))}
                            </div>
                        </div>

                        {/* System Upgrades Section */}
                        <div>
                            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-blue-900/30 pb-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                System Upgrades
                            </h3>
                            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                {TALENT_POOL.map(talent => renderGridItem(talent.id, false, true))}
                            </div>
                        </div>

                        {/* Collectibles Section */}
                        <div className="mt-8">
                            <h3 className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-pink-900/30 pb-2">
                                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
                                Field Items
                            </h3>
                            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                {COLLECTIBLES.map(col => renderGridItem(col.id, false, false, true))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT PANEL: DETAILS */}
                <div className="w-80 flex flex-col bg-black/40 backdrop-blur-md relative">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full border border-gray-700 bg-black/60 text-gray-400 hover:text-white hover:border-red-500 transition-colors"
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>

                    {/* --- DETAILS FOR UNITS / ACTIONS --- */}
                    {selectedConfig && (
                        <>
                            {/* 3D Preview Stage */}
                            <div className="h-56 relative bg-gradient-to-b from-gray-900 to-black border-b border-gray-800">
                                {selectedConfig.category === CardCategory.UNIT ? (
                                    <Canvas shadows dpr={[1, 2]} camera={{ position: [2, 2, 4], fov: 45 }}>
                                        <ambientLight intensity={0.5} />
                                        <spotLight position={[5, 5, 5]} intensity={2} castShadow />
                                        <pointLight position={[-5, 5, -5]} intensity={1} color={COLORS.P1} />

                                        <Stage intensity={0.5} environment="city" adjustCamera={false}>
                                            <UnitPreview type={selectedId as UnitType} color={COLORS.P1} />
                                        </Stage>

                                        <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} enablePan={false} minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
                                    </Canvas>
                                ) : (
                                    // Action Fallback View
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                        <div className="w-16 h-16 opacity-50 mb-2">
                                            {getIcon(selectedId as UnitType, "#fff")}
                                        </div>
                                        <div className="text-[10px] font-mono tracking-widest text-purple-400 animate-pulse">TACTICAL PROTOCOL</div>
                                    </div>
                                )}
                                {/* Type Label Overlay */}
                                <div className="absolute bottom-2 left-3 text-[10px] font-black text-white/50 uppercase tracking-widest pointer-events-none">
                                    {selectedId}
                                </div>
                            </div>

                            {/* Details Content */}
                            <div className="flex-1 p-5 flex flex-col overflow-y-auto">
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1 leading-none">{selectedConfig.name}</h2>
                                <div className={`text-[10px] font-mono mb-4 ${selectedConfig.category === CardCategory.ACTION ? 'text-purple-400' : 'text-cyan-400'}`}>
                                    {selectedConfig.category} CLASS
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed mb-6 border-l-2 border-gray-700 pl-3">
                                    {selectedConfig.description}
                                </p>

                                {/* Attributes Grid (Only for Units) */}
                                {selectedConfig.baseStats && (
                                    <div className="grid grid-cols-2 gap-2 mb-6">
                                        <div className="bg-white/5 p-2 rounded border border-white/10 flex flex-col items-center">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">Integrity</span>
                                            <span className="text-sm font-mono font-bold text-white">
                                                {selectedConfig.baseStats.hp >= 10000 ? 'INF' : selectedConfig.baseStats.hp}
                                            </span>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded border border-white/10 flex flex-col items-center">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">Attack</span>
                                            <span className="text-sm font-mono font-bold text-white">{selectedConfig.baseStats.attack}</span>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded border border-white/10 flex flex-col items-center">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">Range</span>
                                            <span className="text-sm font-mono font-bold text-white">{selectedConfig.baseStats.range}</span>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded border border-white/10 flex flex-col items-center">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">Mobility</span>
                                            <span className="text-sm font-mono font-bold text-white">{selectedConfig.baseStats.movement}</span>
                                        </div>
                                    </div>
                                )}

                                {selectedConfig.category === CardCategory.ACTION && (
                                    <div className="mb-6 p-3 border border-dashed border-purple-500/30 rounded bg-purple-900/10 text-center">
                                        <span className="text-[10px] text-purple-300 font-mono">
                                            ONE-TIME USE TACTICAL CARD
                                        </span>
                                    </div>
                                )}

                                <div className="mt-auto border-t border-gray-800 pt-3 text-center">
                                    <span className="text-[10px] text-gray-500 font-mono">BASE COST: <span className="text-white font-bold">${selectedConfig.cost}</span></span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- DETAILS FOR ABILITIES --- */}
                    {selectedAbility && (
                        <>
                            <div className="h-56 relative bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 flex items-center justify-center">
                                <div className="text-6xl filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                    {selectedAbility.icon}
                                </div>
                                <div className="absolute bottom-2 left-3 text-[10px] font-black text-white/50 uppercase tracking-widest pointer-events-none">
                                    {selectedAbility.type} MODULE
                                </div>
                            </div>

                            <div className="flex-1 p-5 flex flex-col overflow-y-auto">
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1 leading-none">{selectedAbility.name}</h2>
                                <div className="text-[10px] font-mono mb-4 text-yellow-400">
                                    SYSTEM MODULE
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed mb-6 border-l-2 border-yellow-700 pl-3">
                                    {selectedAbility.description}
                                </p>

                                <div className="bg-white/5 p-3 rounded border border-white/10 flex justify-between items-center mb-6">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Activation Cost</span>
                                    <span className={`text-sm font-mono font-bold ${selectedAbility.type === 'PASSIVE' ? 'text-yellow-400' : 'text-purple-400'}`}>
                                        {selectedAbility.type === 'PASSIVE' ? 'AUTO' : `${selectedAbility.cost} ENERGY`}
                                    </span>
                                </div>

                                {selectedAbility.type === 'ACTIVE' && (
                                    <div className="p-3 border border-dashed border-gray-700 rounded bg-gray-900/30 text-center">
                                        <span className="text-[9px] text-gray-500">
                                            Requires manual activation from unit panel.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* --- DETAILS FOR SYSTEM UPGRADES --- */}
                    {selectedTalent && (
                        <>
                            <div className="h-56 relative bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 opacity-20" style={{
                                    backgroundImage: `linear-gradient(${selectedTalent.color}33 1px, transparent 1px), linear-gradient(90deg, ${selectedTalent.color}33 1px, transparent 1px)`,
                                    backgroundSize: '20px 20px'
                                }} />
                                <div className="text-6xl filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10">
                                    {selectedTalent.icon}
                                </div>
                                <div className="absolute bottom-2 left-3 text-[10px] font-black text-white/50 uppercase tracking-widest pointer-events-none">
                                    GLOBAL UPGRADE
                                </div>
                            </div>

                            <div className="flex-1 p-5 flex flex-col overflow-y-auto">
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1 leading-none">{selectedTalent.name}</h2>
                                <div className="text-[10px] font-mono mb-4 text-blue-400">
                                    SYSTEM PERK
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed mb-6 border-l-2 border-blue-700 pl-3">
                                    {selectedTalent.description}
                                </p>

                                <div className="bg-blue-900/20 p-3 rounded border border-blue-500/30 text-center mb-6">
                                    <span className="text-[10px] text-blue-300 font-mono">
                                        Available via Level Up Milestones
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- DETAILS FOR COLLECTIBLES --- */}
                    {selectedCollectible && (
                        <>
                            <div className="h-56 relative bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 flex items-center justify-center overflow-hidden">
                                <div className="text-6xl filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10" style={{ color: selectedCollectible.color }}>
                                    {selectedCollectible.icon}
                                </div>
                                <div className="absolute bottom-2 left-3 text-[10px] font-black text-white/50 uppercase tracking-widest pointer-events-none">
                                    FIELD ITEM
                                </div>
                            </div>

                            <div className="flex-1 p-5 flex flex-col overflow-y-auto">
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1 leading-none">{selectedCollectible.name}</h2>
                                <div className="text-[10px] font-mono mb-4 text-pink-400">
                                    PICKUP
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed mb-6 border-l-2 border-pink-700 pl-3">
                                    {selectedCollectible.description}
                                </p>

                                <div className="bg-pink-900/20 p-3 rounded border border-pink-500/30 text-center mb-6">
                                    <span className="text-[10px] text-pink-300 font-mono">
                                        Collect by moving a unit onto the tile.
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {!selectedConfig && !selectedAbility && !selectedTalent && !selectedCollectible && (
                        <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-gray-600 p-8 text-center">
                            SELECT DATA ENTRY
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};

export default CardCatalogue;
