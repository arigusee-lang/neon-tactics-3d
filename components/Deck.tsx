import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, UnitType, CardCategory } from '../types';
import { CARD_CONFIG, MAX_INVENTORY_CAPACITY } from '../constants';
import { groupCards } from '../utils/cardUtils';

interface DeckProps {
    cards: Card[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    playerColor: string;
    deliveredCardIds?: string[];
}

const Deck: React.FC<DeckProps> = ({ cards, selectedId, onSelect, playerColor, deliveredCardIds = [] }) => {
    const [hoveredCard, setHoveredCard] = useState<{ id: string, rect: DOMRect, config: any, isAction: boolean } | null>(null);
    const groupedCards = useMemo(() => groupCards(cards), [cards]);
    const deliveredCardIdSet = useMemo(() => new Set(deliveredCardIds), [deliveredCardIds]);

    const visibleGroups = useMemo(() => {
        return groupedCards.slice(0, MAX_INVENTORY_CAPACITY);
    }, [groupedCards]);

    const groupedRows = useMemo(() => {
        const rows: Card[][][] = [];
        for (let i = 0; i < visibleGroups.length; i += 10) {
            rows.push(visibleGroups.slice(i, i + 10));
        }
        return rows;
    }, [visibleGroups]);

    const handleMouseEnter = (e: React.MouseEvent, card: Card, config: any, isAction: boolean) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredCard({ id: card.id, rect, config, isAction });
    };

    const handleMouseLeave = () => {
        setHoveredCard(null);
    };

    const renderIcon = (type: UnitType, color: string) => {
        const p = { width: "100%", height: "100%", fill: "none", stroke: color, strokeWidth: "2", vectorEffect: "non-scaling-stroke" as const };
        switch (type) {
            case UnitType.SOLDIER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="6" r="4" /><path d="M6 22V14C6 11 12 11 12 11V22" /></svg>;
            case UnitType.HEAVY: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" /><rect x="8" y="8" width="8" height="8" fill="currentColor" fillOpacity="0.2" /></svg>;
            case UnitType.MEDIC: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2V22 M2 12H22" strokeWidth="4" /><rect x="6" y="6" width="12" height="12" stroke="none" fill="currentColor" fillOpacity="0.1" /></svg>;
            case UnitType.LIGHT_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M4 14H20M2 18H22M6 10H18L16 6H8L6 10Z" /><rect x="4" y="14" width="16" height="6" fill="currentColor" fillOpacity="0.2" /></svg>;
            case UnitType.HEAVY_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M2 16H22M4 12H20L18 4H6L4 12Z" /><rect x="2" y="16" width="20" height="6" fill="currentColor" fillOpacity="0.2" /><line x1="8" y1="12" x2="8" y2="4" strokeWidth="3" /><line x1="16" y1="12" x2="16" y2="4" strokeWidth="3" /></svg>;
            case UnitType.HACKER: return <svg viewBox="0 0 24 24" {...p}><path d="M4 6h16v10H4z" /><path d="M2 18h20v2H2z" /><path d="M11 14h2" /></svg>;
            case UnitType.SUICIDE_DRONE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="6" /><path d="M12 6V2 M12 22V18 M6 12H2 M22 12H18 M16 16L20 20 M4 4L8 8 M20 4L16 8 M8 16L4 20" /></svg>;
            case UnitType.TITAN: return <svg viewBox="0 0 24 24" {...p}><rect x="4" y="8" width="16" height="12" /><path d="M12 2V8" /></svg>;
            case UnitType.SPIKE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L15 22L12 18L9 22L12 2Z" /></svg>;
            case UnitType.REPAIR_BOT: return <svg viewBox="0 0 24 24" {...p}><rect x="4" y="10" width="16" height="8" rx="2" /><circle cx="8" cy="18" r="3" /><circle cx="16" cy="18" r="3" /><path d="M12 10V6 M8 6h8" /></svg>;
            case UnitType.SYSTEM_FREEZE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="8" strokeDasharray="2 2" /><path d="M12 4V20 M4 12H20" /></svg>;
            case UnitType.FORWARD_BASE: return <svg viewBox="0 0 24 24" {...p}><rect x="5" y="5" width="14" height="14" rx="1" /><path d="M12 8V16 M8 12H16" /><path d="M5 2V5H2M22 5H19V2M5 22V19H2M22 19H19V22" /></svg>;
            case UnitType.TACTICAL_RETREAT: return <svg viewBox="0 0 24 24" {...p}><path d="M9 7L4 12L9 17" /><path d="M4 12H14a6 6 0 1 0 0 12" /></svg>;
            case UnitType.LANDING_SABOTAGE: return <svg viewBox="0 0 24 24" {...p}><path d="M4 4H20V20H4Z" /><path d="M4 12H20 M12 4V20" strokeDasharray="2 2" /><path d="M7 7L17 17 M17 7L7 17" /></svg>;
            case UnitType.CONE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L4 20H20L12 2Z" /></svg>;
            case UnitType.WALL: return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 6V18 M18 6V18 M2 12H22" /></svg>;
            case UnitType.TOWER: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L6 22H18L12 2Z" /><line x1="12" y1="2" x2="12" y2="22" /><circle cx="12" cy="8" r="2" /></svg>;
            case UnitType.CHARGING_STATION: return <svg viewBox="0 0 24 24" {...p}><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" /><rect x="4" y="20" width="16" height="2" fill="currentColor" /></svg>;
            case UnitType.ION_CANNON: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2V6 M12 18V22 M2 12H6 M18 12H22" /><path d="M19.07 4.93L16.24 7.76 M7.76 16.24L4.93 19.07" /><path d="M4.93 4.93L7.76 7.76 M16.24 16.24L19.07 19.07" /></svg>;
            case UnitType.SNIPER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10" strokeWidth="1" opacity="0.5" /><line x1="12" y1="2" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="2" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="22" y2="12" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
            case UnitType.BOX: return <svg viewBox="0 0 24 24" {...p}><path d="M4 4L20 20M20 4L4 20" /><circle cx="12" cy="12" r="3" /><circle cx="4" cy="4" r="2" /><circle cx="20" cy="4" r="2" /><circle cx="4" cy="20" r="2" /><circle cx="20" cy="20" r="2" /></svg>;
            case UnitType.PORTAL: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" strokeDasharray="2 2" /><circle cx="12" cy="12" r="2" fill={color} stroke="none" /></svg>;
            case UnitType.ARC_PORTAL: return <svg viewBox="0 0 24 24" {...p}><path d="M5 22V10C5 6.13 8.13 3 12 3C15.87 3 19 6.13 19 10V22" /><path d="M2 22H22" /><path d="M12 7V13" strokeDasharray="2 2" /></svg>;
            default: return <div className="w-4 h-4 bg-current" />;
        }
    };

    return (
        <div className="w-full max-w-[460px] pointer-events-auto">
            <div className="flex flex-col gap-1">
                {groupedRows.map((row, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="flex justify-center gap-1">
                        {row.map((cardGroup, cardIndex) => {
                            const representativeCard = cardGroup[0];
                            const count = cardGroup.length;
                            const isSelected = cardGroup.some(groupedCard => groupedCard.id === selectedId);
                            const isRecentlyDelivered = cardGroup.some(groupedCard => deliveredCardIdSet.has(groupedCard.id));
                            const isAction = representativeCard.category === CardCategory.ACTION;
                            const config = CARD_CONFIG[representativeCard.type];
                            const iconColor = isAction ? '#ffffff' : playerColor;

                            return (
                                <button
                                    key={`${representativeCard.id}-${rowIndex}-${cardIndex}`}
                                    onClick={() => onSelect(representativeCard.id)}
                                    onMouseEnter={(e) => handleMouseEnter(e, representativeCard, config, isAction)}
                                    onMouseLeave={handleMouseLeave}
                                    className="relative w-[42px] h-[42px] rounded-sm p-[3px] flex items-center justify-center transition-transform duration-150 hover:scale-[1.02]"
                                    style={{
                                        border: isSelected ? `1px solid ${isAction ? '#ffffff' : playerColor}` : '1px solid transparent',
                                        boxShadow: isSelected ? `0 0 10px ${isAction ? 'rgba(255,255,255,0.3)' : `${playerColor}55`}` : 'none'
                                    }}
                                >
                                    <div className="w-full h-full flex items-center justify-center scale-105">
                                        {renderIcon(representativeCard.type, iconColor)}
                                    </div>
                                    {isRecentlyDelivered && (
                                        <div className="pointer-events-none absolute inset-0 rounded-sm border border-yellow-400/90 shadow-[0_0_8px_rgba(250,204,21,0.65)] animate-pulse" />
                                    )}
                                    <div className="absolute top-0.5 right-0.5 min-w-[12px] h-3 px-1 rounded bg-black/70 border border-green-600/50 text-[8px] leading-[10px] font-bold text-green-300 flex items-center justify-center">
                                        {count}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {hoveredCard && createPortal(
                <div
                    className="fixed z-[9999] w-48 bg-black/95 border border-gray-600 rounded p-2 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md pointer-events-none transition-opacity duration-200"
                    style={{
                        left: hoveredCard.rect.left + hoveredCard.rect.width / 2,
                        top: hoveredCard.rect.top - 12,
                        transform: 'translate(-50%, -100%)',
                        borderColor: hoveredCard.isAction ? '#fff' : playerColor
                    }}
                >
                    <div className="text-[10px] font-bold text-white uppercase mb-1 text-center tracking-wider" style={{ color: hoveredCard.isAction ? '#fff' : playerColor }}>
                        {hoveredCard.config?.name || "UNKNOWN"}
                    </div>
                    <div className="text-[9px] text-gray-400 leading-tight mb-2 text-center border-b border-gray-800 pb-1">
                        {hoveredCard.config?.description}
                    </div>

                    {!hoveredCard.isAction && hoveredCard.config?.baseStats && (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-gray-300">
                            <div className="flex justify-between"><span>HP</span> <span className="text-white">{hoveredCard.config.baseStats.hp}</span></div>
                            <div className="flex justify-between"><span>ATK</span> <span className="text-white">{hoveredCard.config.baseStats.attack}</span></div>
                            <div className="flex justify-between"><span>RNG</span> <span className="text-white">{hoveredCard.config.baseStats.range}</span></div>
                            <div className="flex justify-between"><span>MOV</span> <span className="text-white">{hoveredCard.config.baseStats.movement}</span></div>
                            {hoveredCard.config.baseStats.maxEnergy > 0 && (
                                <div className="col-span-2 text-center mt-1 text-purple-400 border-t border-gray-800 pt-1">
                                    ENERGY: <span className="font-bold">{hoveredCard.config.baseStats.maxEnergy}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {hoveredCard.isAction && (
                        <div className="text-[8px] text-gray-500 text-center italic mt-1 uppercase tracking-widest">
                            Tactical Protocol
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Deck;

