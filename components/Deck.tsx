
import React, { useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, UnitType, CardCategory } from '../types';
import { CARD_CONFIG } from '../constants';
import { groupCards } from '../utils/cardUtils';

interface DeckProps {
  cards: Card[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  playerColor: string;
  isDevMode: boolean;
  highlight?: boolean;
}

const Deck: React.FC<DeckProps> = ({ cards, selectedId, onSelect, playerColor, isDevMode, highlight }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Tooltip State
  const [hoveredCard, setHoveredCard] = useState<{ id: string, rect: DOMRect, config: any, isAction: boolean } | null>(null);

  const groupedCards = useMemo(() => groupCards(cards), [cards]);

  const handleScrollBtn = (direction: 'left' | 'right') => {
    setHoveredCard(null); // Clear tooltip on scroll
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Stop the event from reaching the Canvas (OrbitControls)
    e.stopPropagation();
    setHoveredCard(null); // Clear tooltip on scroll
    
    if (scrollContainerRef.current) {
        // Translate vertical scroll to horizontal scroll
        scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

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
        case UnitType.SOLDIER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="6" r="4"/><path d="M6 22V14C6 11 12 11 12 11V22"/></svg>;
        case UnitType.HEAVY: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" /><rect x="8" y="8" width="8" height="8" fill="currentColor" fillOpacity="0.2"/></svg>;
        case UnitType.MEDIC: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2V22 M2 12H22" strokeWidth="4" /><rect x="6" y="6" width="12" height="12" stroke="none" fill="currentColor" fillOpacity="0.1" /></svg>;
        case UnitType.LIGHT_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M4 14H20M2 18H22M6 10H18L16 6H8L6 10Z"/><rect x="4" y="14" width="16" height="6" fill="currentColor" fillOpacity="0.2"/></svg>;
        case UnitType.HEAVY_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M2 16H22M4 12H20L18 4H6L4 12Z" /><rect x="2" y="16" width="20" height="6" fill="currentColor" fillOpacity="0.2"/><line x1="8" y1="12" x2="8" y2="4" strokeWidth="3"/><line x1="16" y1="12" x2="16" y2="4" strokeWidth="3"/></svg>;
        case UnitType.BOX: return <svg viewBox="0 0 24 24" {...p}><rect x="8" y="8" width="8" height="8"/><path d="M2 12H8 M16 22H22"/></svg>;
        case UnitType.SUICIDE_DRONE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="6"/><path d="M12 6V2 M12 22V18 M6 12H2 M22 12H18 M16 16L20 20 M4 4L8 8 M20 4L16 8 M8 16L4 20"/></svg>;
        case UnitType.TITAN: return <svg viewBox="0 0 24 24" {...p}><rect x="4" y="8" width="16" height="12"/><path d="M12 2V8"/></svg>;
        case UnitType.RESIDENTIAL: return <svg viewBox="0 0 24 24" {...p}><rect x="6" y="2" width="12" height="20"/><path d="M6 7H18 M6 12H18 M6 17H18"/></svg>;
        case UnitType.SPIKE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L15 22L12 18L9 22L12 2Z"/></svg>;
        case UnitType.SERVER: return <svg viewBox="0 0 24 24" {...p}><rect x="8" y="4" width="8" height="16"/><line x1="10" y1="8" x2="14" y2="8" /><line x1="10" y1="12" x2="14" y2="12" /></svg>;
        case UnitType.SYSTEM_FREEZE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="8" strokeDasharray="2 2"/><path d="M12 4V20 M4 12H20"/></svg>;
        case UnitType.CONE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L4 20H20L12 2Z"/></svg>;
        case UnitType.WALL: return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 6V18 M18 6V18 M2 12H22"/></svg>;
        case UnitType.TOWER: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L6 22H18L12 2Z" /><line x1="12" y1="2" x2="12" y2="22" /><circle cx="12" cy="8" r="2" /></svg>;
        case UnitType.CHARGING_STATION: return <svg viewBox="0 0 24 24" {...p}><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" /><rect x="4" y="20" width="16" height="2" fill="currentColor" /></svg>;
        case UnitType.ION_CANNON: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2V6 M12 18V22 M2 12H6 M18 12H22" /><path d="M19.07 4.93L16.24 7.76 M7.76 16.24L4.93 19.07" /><path d="M4.93 4.93L7.76 7.76 M16.24 16.24L19.07 19.07" /></svg>;
        default: return <div className="w-4 h-4 bg-current" />;
    }
  };

  return (
    <div className="relative w-full max-w-[700px] h-44 flex flex-col items-center pointer-events-auto transition-all duration-300">
      <div 
        className={`relative w-full h-full bg-transparent border overflow-hidden shadow-[0_0_30px_rgba(0,255,0,0.1)] rounded-xl transition-all duration-500
            ${highlight ? 'border-yellow-400 shadow-[0_0_50px_rgba(255,200,0,0.5)] animate-pulse' : 'border-green-500/60'}
        `}
      >
         {/* Custom Scroll Buttons */}
         <button onClick={() => handleScrollBtn('left')} className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 z-20 bg-gradient-to-r from-black/80 to-transparent text-green-500 hover:text-white text-3xl font-mono transition-colors flex items-center justify-center">&lt;</button>
         <button onClick={() => handleScrollBtn('right')} className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 z-20 bg-gradient-to-l from-black/80 to-transparent text-green-500 hover:text-white text-3xl font-mono transition-colors flex items-center justify-center">&gt;</button>
         
         <div 
            ref={scrollContainerRef} 
            onWheel={handleWheel}
            className="absolute inset-0 flex items-center gap-4 overflow-x-auto px-12 sm:px-16 no-scrollbar" 
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
         >
            {groupedCards.map((group, index) => {
                const card = group[0]; // Representative card
                const count = group.length;
                // Check if ANY card in this group is the selected one
                const isSelected = group.some(c => c.id === selectedId);
                const isAction = card.category === CardCategory.ACTION;
                const config = CARD_CONFIG[card.type];

                return (
                    <div key={card.id} 
                        onClick={() => onSelect(card.id)} 
                        onMouseEnter={(e) => handleMouseEnter(e, card, config, isAction)}
                        onMouseLeave={handleMouseLeave}
                        className={`relative flex-shrink-0 w-20 h-28 sm:w-24 sm:h-32 flex flex-col items-center justify-center border transition-all duration-300 rounded-lg group ${isSelected ? 'bg-slate-900/40 border-2 scale-105 z-10 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-transparent border-green-900/60 hover:border-green-400 hover:bg-green-900/20'}`}
                        style={{ borderColor: isSelected ? (isAction ? '#fff' : playerColor) : undefined }}>
                        
                        {/* Hotkey Index */}
                        <div className="absolute top-1 left-1.5 text-[9px] font-bold text-black bg-green-500 px-1.5 py-0 rounded-sm">
                            {index + 1}
                        </div>

                        {/* Quantity Badge */}
                        {(count > 1 || isDevMode) && (
                            <div className={`absolute top-1 right-1.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shadow-sm border ${isDevMode ? 'bg-purple-600 border-purple-400' : 'bg-red-600 border-red-400'}`}>
                                {isDevMode ? '∞' : `x${count}`}
                            </div>
                        )}
                        
                        <div className="w-10 h-10 sm:w-12 sm:h-12 mb-1 sm:mb-2 flex items-center justify-center drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]">
                            {renderIcon(card.type, isAction ? '#fff' : playerColor)}
                        </div>
                        
                        <div className="text-[9px] sm:text-[10px] uppercase font-black text-white text-center px-1 leading-tight tracking-tight drop-shadow-md truncate w-full">
                            {config?.name || "UNKNOWN"}
                        </div>
                        
                        <div className={`text-[8px] font-mono mt-1 uppercase tracking-[0.2em] font-bold drop-shadow-md ${isAction ? 'text-white' : 'text-green-400'}`}>
                            {card.category === CardCategory.ACTION ? 'ACT' : 'UNIT'}
                        </div>

                        {isSelected && (
                            <div className="absolute inset-0 border-2 border-green-400 opacity-20 pointer-events-none animate-pulse rounded-lg"></div>
                        )}
                    </div>
                )
            })}
         </div>
      </div>
      <div className="text-[10px] text-green-500/70 tracking-[0.8em] mt-2 uppercase font-bold drop-shadow-md hidden sm:block">
          {highlight ? <span className="text-yellow-400 animate-pulse font-black">LOGISTICS UPDATE RECEIVED</span> : <span>Tactical Deployment Matrix {isDevMode && <span className="text-purple-400 font-bold ml-2">[DEV MODE]</span>}</span>}
      </div>
      
      {/* Tooltip Portal */}
      {hoveredCard && createPortal(
          <div 
            className="fixed z-[9999] w-48 bg-black/95 border border-gray-600 rounded p-2 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md pointer-events-none transition-opacity duration-200"
            style={{
                left: hoveredCard.rect.left + hoveredCard.rect.width / 2,
                top: hoveredCard.rect.top - 12, // 12px margin above card
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
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
      `}</style>
    </div>
  );
};

export default Deck;
