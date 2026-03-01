
import React, { useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, PerspectiveCamera, Environment, Float, Edges } from '@react-three/drei';
import { ShopItem, UnitType, CardCategory } from '../types';
import { CARD_CONFIG, COLORS } from '../constants';
import * as THREE from 'three';
import UnitPreview from './UnitPreview';

interface ShopModalProps {
    availableStock: ShopItem[];
    boughtItems: ShopItem[];
    credits: number;
    nextDeliveryRound: number;
    currentRound: number;
    onBuy: (item: ShopItem) => void;
    onRefund: (item: ShopItem) => void;
    onReroll: () => void;
    onClose: () => void;
}

const ShopModal: React.FC<ShopModalProps> = ({
    availableStock,
    boughtItems,
    credits,
    nextDeliveryRound,
    currentRound,
    onBuy,
    onRefund,
    onReroll,
    onClose
}) => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    // Helper to generate unique keys for grouping
    const getGroupKey = (item: ShopItem) => `${item.type}__${item.deliveryTurns}`;

    // Group items logic
    const stockGroups = useMemo(() => {
        const groups: Record<string, ShopItem[]> = {};
        availableStock.forEach(item => {
            const key = getGroupKey(item);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [availableStock]);

    const boughtGroups = useMemo(() => {
        const groups: Record<string, ShopItem[]> = {};
        boughtItems.forEach(item => {
            const key = getGroupKey(item);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [boughtItems]);

    // Select first available item on load if nothing selected
    React.useEffect(() => {
        if (!selectedKey) {
            const firstStock = Object.keys(stockGroups)[0];
            if (firstStock) setSelectedKey(firstStock);
            else {
                const firstBought = Object.keys(boughtGroups)[0];
                if (firstBought) setSelectedKey(firstBought);
            }
        }
    }, [stockGroups, boughtGroups, selectedKey]);

    // Actual Detailed Icons for Grid
    const getIcon = (type: UnitType, color: string) => {
        const p = { width: "100%", height: "100%", fill: "none", stroke: color, strokeWidth: "2", vectorEffect: "non-scaling-stroke" as const };
        switch (type) {
            case UnitType.SOLDIER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="6" r="4" /><path d="M6 22V14C6 11 12 11 12 11V22" /></svg>;
            case UnitType.HEAVY: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" /><rect x="8" y="8" width="8" height="8" fill="currentColor" fillOpacity="0.2" /></svg>;
            case UnitType.MEDIC: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2V22 M2 12H22" strokeWidth="4" /><rect x="6" y="6" width="12" height="12" stroke="none" fill="currentColor" fillOpacity="0.1" /></svg>;
            case UnitType.LIGHT_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M4 14H20M2 18H22M6 10H18L16 6H8L6 10Z" /><rect x="4" y="14" width="16" height="6" fill="currentColor" fillOpacity="0.2" /></svg>;
            case UnitType.HEAVY_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M2 16H22M4 12H20L18 4H6L4 12Z" /><rect x="2" y="16" width="20" height="6" fill="currentColor" fillOpacity="0.2" /><line x1="8" y1="12" x2="8" y2="4" strokeWidth="3" /><line x1="16" y1="12" x2="16" y2="4" strokeWidth="3" /></svg>;
            case UnitType.HEAVY_TANK: return <svg viewBox="0 0 24 24" {...p}><path d="M2 16H22M4 12H20L18 4H6L4 12Z" /><rect x="2" y="16" width="20" height="6" fill="currentColor" fillOpacity="0.2" /><line x1="8" y1="12" x2="8" y2="4" strokeWidth="3" /><line x1="16" y1="12" x2="16" y2="4" strokeWidth="3" /></svg>;
            case UnitType.BOX: return <svg viewBox="0 0 24 24" {...p}><path d="M4 4L20 20M20 4L4 20" /><circle cx="12" cy="12" r="3" /><circle cx="4" cy="4" r="2" /><circle cx="20" cy="4" r="2" /><circle cx="4" cy="20" r="2" /><circle cx="20" cy="20" r="2" /></svg>;
            case UnitType.HACKER: return <svg viewBox="0 0 24 24" {...p}><path d="M4 6h16v10H4z" /><path d="M2 18h20v2H2z" /><path d="M11 14h2" /></svg>;
            case UnitType.SUICIDE_DRONE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="6" /><path d="M12 6V2 M12 22V18 M6 12H2 M22 12H18 M16 16L20 20 M4 4L8 8 M20 4L16 8 M8 16L4 20" /></svg>;
            case UnitType.TITAN: return <svg viewBox="0 0 24 24" {...p}><rect x="4" y="8" width="16" height="12" /><path d="M12 2V8" /></svg>;
            case UnitType.SPIKE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L15 22L12 18L9 22L12 2Z" /></svg>;
            case UnitType.REPAIR_BOT: return <svg viewBox="0 0 24 24" {...p}><rect x="4" y="10" width="16" height="8" rx="2" /><circle cx="8" cy="18" r="3" /><circle cx="16" cy="18" r="3" /><path d="M12 10V6 M8 6h8" /></svg>;
            case UnitType.SYSTEM_FREEZE: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="8" strokeDasharray="2 2" /><path d="M12 4V20 M4 12H20" /></svg>;
            case UnitType.FORWARD_BASE: return <svg viewBox="0 0 24 24" {...p}><rect x="5" y="5" width="14" height="14" rx="1" /><path d="M12 8V16 M8 12H16" /><path d="M5 2V5H2M22 5H19V2M5 22V19H2M22 19H19V22" /></svg>;
            case UnitType.TACTICAL_RETREAT: return <svg viewBox="0 0 24 24" {...p}><path d="M9 7L4 12L9 17" /><path d="M4 12H14a6 6 0 1 0 0 12" /></svg>;
            case UnitType.MASS_RETREAT: return <svg viewBox="0 0 24 24" {...p}><path d="M10 6L5 12L10 18" /><path d="M16 6L11 12L16 18" /><path d="M5 12H20" /></svg>;
            case UnitType.LANDING_SABOTAGE: return <svg viewBox="0 0 24 24" {...p}><path d="M4 4H20V20H4Z" /><path d="M4 12H20 M12 4V20" strokeDasharray="2 2" /><path d="M7 7L17 17 M17 7L7 17" /></svg>;
            case UnitType.CONE: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L4 20H20L12 2Z" /></svg>;
            case UnitType.WALL: return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 6V18 M18 6V18 M2 12H22" /></svg>;
            case UnitType.TOWER: return <svg viewBox="0 0 24 24" {...p}><path d="M12 2L6 22H18L12 2Z" /><line x1="12" y1="2" x2="12" y2="22" /><circle cx="12" cy="8" r="2" /></svg>;
            case UnitType.CHARGING_STATION: return <svg viewBox="0 0 24 24" {...p}><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" /><rect x="4" y="20" width="16" height="2" fill="currentColor" /></svg>;
            case UnitType.ION_CANNON: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2V6 M12 18V22 M2 12H6 M18 12H22" /><path d="M19.07 4.93L16.24 7.76 M7.76 16.24L4.93 19.07" /><path d="M4.93 4.93L7.76 7.76 M16.24 16.24L19.07 19.07" /></svg>;
            case UnitType.PORTAL: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" strokeDasharray="2 2" /><circle cx="12" cy="12" r="2" fill={color} stroke="none" /></svg>;
            case UnitType.ARC_PORTAL: return <svg viewBox="0 0 24 24" {...p}><path d="M5 22V10C5 6.13 8.13 3 12 3C15.87 3 19 6.13 19 10V22" /><path d="M2 22H22" /><path d="M12 7V13" strokeDasharray="2 2" /></svg>;
            case UnitType.SNIPER: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10" strokeWidth="1" opacity="0.5" /><line x1="12" y1="2" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="2" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="22" y2="12" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
            default: return <div className="w-4 h-4 bg-current" />;
        }
    };

    const renderGridItem = (groupKey: string, items: ShopItem[], isStock: boolean) => {
        const item = items[0];
        const config = CARD_CONFIG[item.type as UnitType];
        if (!config) return null;

        const count = items.length;
        const isSelected = selectedKey === groupKey;
        const canAfford = credits >= item.cost;
        const isInstant = item.deliveryTurns === 0;

        // 3) Visual Highlight for Card Types
        const isAction = config.category === CardCategory.ACTION;

        // Base styling
        let borderColor = 'border-gray-700';
        let bgColor = 'bg-black/60';
        let hoverClass = 'hover:border-gray-500 hover:bg-gray-800/60';

        if (isSelected) {
            borderColor = isAction ? 'border-purple-400' : (isStock ? 'border-green-400' : 'border-blue-400');
            bgColor = isAction ? 'bg-purple-900/40' : (isStock ? 'bg-green-900/40' : 'bg-blue-900/40');
            hoverClass = ''; // No hover change when selected
        } else {
            // Unselected hover states
            if (isAction) hoverClass = 'hover:border-purple-500/50 hover:bg-purple-900/20';
            else if (isStock) hoverClass = 'hover:border-green-500/50 hover:bg-green-900/20';
            else hoverClass = 'hover:border-blue-500/50 hover:bg-blue-900/20';
        }

        // Instant Delivery Highlight
        if (isStock && isInstant) {
            borderColor = 'border-yellow-400';
            bgColor = 'bg-yellow-900/20';
            if (isSelected) {
                borderColor = 'border-yellow-300';
                bgColor = 'bg-yellow-800/60';
            }
        }

        const iconColor = isSelected ? '#fff' : (isAction ? '#a855f7' : (isStock ? (canAfford ? COLORS.P1 : '#555') : COLORS.P2));

        return (
            <div
                key={groupKey}
                onClick={() => setSelectedKey(groupKey)}
                className={`
                    relative flex flex-col items-center justify-between p-2 rounded-lg border cursor-pointer transition-all duration-200
                    h-24 w-full ${borderColor} ${bgColor} ${hoverClass}
                    ${isSelected ? 'shadow-[0_0_15px_rgba(0,0,0,0.5)]' : ''}
                    ${isStock && isInstant ? 'shadow-[0_0_10px_rgba(255,200,0,0.3)] animate-pulse' : ''}
                `}
            >
                {/* Instant Delivery Badge */}
                {isStock && isInstant && (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg z-10 animate-bounce">
                        INSTANT!
                    </div>
                )}

                {/* Pending Delivery Timer */}
                {!isStock && (
                    <div className="absolute top-1 right-1 bg-blue-900/80 border border-blue-500 text-blue-200 text-[8px] font-mono px-1 rounded">
                        T-{item.deliveryTurns}
                    </div>
                )}

                {/* Stock Delivery Timer (Preview) */}
                {isStock && !isInstant && isSelected && (
                    <div className="absolute top-1 right-1 bg-gray-900/80 border border-gray-600 text-gray-400 text-[8px] font-mono px-1 rounded">
                        {item.deliveryTurns}t
                    </div>
                )}

                <div className="w-8 h-8 opacity-90 mt-1">
                    {getIcon(item.type as UnitType, iconColor)}
                </div>

                <div className="text-center w-full">
                    <div className={`text-[8px] font-bold uppercase truncate ${isSelected ? 'text-white' : (isAction ? 'text-purple-300' : 'text-gray-400')}`}>
                        {config.name}
                    </div>
                    <div className={`text-[9px] font-mono font-bold ${canAfford || !isStock ? 'text-white' : 'text-red-400'}`}>
                        ${item.cost}
                    </div>
                </div>

                {/* 2) Count Badge - Only if > 1 */}
                {count > 1 && (
                    <div className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isStock ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                        x{count}
                    </div>
                )}
            </div>
        );
    };

    const selectedStock = selectedKey ? (stockGroups[selectedKey] || []) : [];
    const selectedBought = selectedKey ? (boughtGroups[selectedKey] || []) : [];
    const selectedItem = selectedStock[0] || selectedBought[0];
    const selectedType = selectedItem?.type || null;
    const selectedConfig = selectedType ? CARD_CONFIG[selectedType] : null;

    // 1) Sell Logic
    // Find items of this group that were bought THIS round
    const refundableItems = selectedBought.filter(item => item.purchaseRound === currentRound);
    const canRefund = refundableItems.length > 0;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex w-[90vw] max-w-5xl h-[80vh] border border-green-500/30 bg-black/80 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl">

                {/* LEFT PANEL: GRID */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800/50">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-green-900/10 to-transparent border-b border-green-500/20">
                        <div>
                            <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 uppercase tracking-widest">
                                Logistics
                            </h2>
                            <div className="flex items-center gap-3 text-[9px] font-mono text-green-400/60 mt-1">
                                <span>CYCLE: {currentRound}</span>
                                <span>::</span>
                                <span>NEXT RESTOCK: {nextDeliveryRound}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] text-green-500/70 font-bold uppercase tracking-wider">Credits</div>
                            <div className="text-xl font-mono text-white font-bold tracking-tight text-shadow-sm">
                                ${credits}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                        {/* SECTION: AVAILABLE */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    Available Requisitions
                                </h3>
                                <button
                                    onClick={onReroll}
                                    disabled={credits < 50 || availableStock.length === 0}
                                    className={`
                                        flex items-center gap-2 px-3 py-1 rounded border text-[9px] font-bold transition-all
                                        ${credits >= 50 && availableStock.length > 0
                                            ? 'bg-yellow-900/20 border-yellow-600/50 text-yellow-500 hover:bg-yellow-900/40 hover:text-yellow-200'
                                            : 'bg-transparent border-gray-800 text-gray-700 cursor-not-allowed'}
                                    `}
                                    title="Refresh available stock (Costs $50)"
                                >
                                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current stroke-2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    <span>REROLL STOCK ($50)</span>
                                </button>
                            </div>

                            {Object.keys(stockGroups).length === 0 ? (
                                <div className="text-[10px] text-gray-600 font-mono italic border border-dashed border-gray-800 p-4 rounded text-center">
                                    NO STOCK AVAILABLE
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                    {Object.entries(stockGroups).map(([key, items]) => renderGridItem(key, items as ShopItem[], true))}
                                </div>
                            )}
                        </div>

                        {/* SECTION: MANIFEST */}
                        <div>
                            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                Pending Delivery
                            </h3>
                            {Object.keys(boughtGroups).length === 0 ? (
                                <div className="text-[10px] text-gray-600 font-mono italic border border-dashed border-gray-800 p-4 rounded text-center">
                                    MANIFEST EMPTY
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                                    {Object.entries(boughtGroups).map(([key, items]) => renderGridItem(key, items as ShopItem[], false))}
                                </div>
                            )}
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

                    {selectedType && selectedConfig ? (
                        <>
                            {/* 3D Preview Stage */}
                            <div className="h-56 relative bg-gradient-to-b from-gray-900 to-black border-b border-gray-800">
                                {selectedConfig.category === CardCategory.UNIT ? (
                                    <Canvas shadows dpr={[1, 2]} camera={{ position: [2, 2, 4], fov: 45 }}>
                                        <ambientLight intensity={0.5} />
                                        <spotLight position={[5, 5, 5]} intensity={2} castShadow />
                                        <pointLight position={[-5, 5, -5]} intensity={1} color={COLORS.P1} />

                                        <Stage intensity={0.5} environment="city" adjustCamera={false}>
                                            <UnitPreview type={selectedType} color={COLORS.P1} />
                                        </Stage>

                                        <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} enablePan={false} minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
                                    </Canvas>
                                ) : (
                                    // Action Fallback View
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                        <div className="w-16 h-16 opacity-50 mb-2">
                                            {getIcon(selectedType, "#fff")}
                                        </div>
                                        <div className="text-[10px] font-mono tracking-widest">TACTICAL ACTION</div>
                                    </div>
                                )}
                                {/* Type Label Overlay */}
                                <div className="absolute bottom-2 left-3 text-[10px] font-black text-white/50 uppercase tracking-widest pointer-events-none">
                                    {selectedType}
                                </div>
                            </div>

                            {/* Details Content */}
                            <div className="flex-1 p-5 flex flex-col overflow-y-auto">
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1 leading-none">{selectedConfig.name}</h2>
                                <div className={`text-[10px] font-mono mb-4 ${selectedConfig.category === CardCategory.ACTION ? 'text-purple-400' : 'text-green-400'}`}>
                                    {selectedConfig.category} CLASS
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed mb-6 border-l-2 border-gray-700 pl-3">
                                    {selectedConfig.description}
                                </p>

                                {/* Attributes Grid */}
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

                                <div className="mt-auto">
                                    {/* Inventory Status */}
                                    <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 mb-2 border-t border-gray-800 pt-3">
                                        <span>IN STOCK: <span className="text-white">{selectedStock.length}</span></span>
                                        <span>OWNED: <span className="text-blue-400">{selectedBought.length}</span></span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => selectedStock.length > 0 && onBuy(selectedStock[0])}
                                            disabled={selectedStock.length === 0 || credits < selectedConfig.cost}
                                            className={`
                                                flex flex-col items-center justify-center py-2 rounded border transition-all
                                                ${selectedStock.length > 0 && credits >= selectedConfig.cost
                                                    ? 'bg-green-900/60 hover:bg-green-800/80 border-green-600 text-green-100 shadow-lg shadow-green-900/20'
                                                    : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-50'}
                                            `}
                                        >
                                            <span className="text-[10px] font-bold uppercase">Purchase</span>
                                            <span className="text-xs font-mono">${selectedConfig.cost}</span>
                                        </button>

                                        {selectedType && selectedBought.length > 0 && (
                                            <button
                                                onClick={() => canRefund && onRefund(refundableItems[0])}
                                                disabled={!canRefund}
                                                className={`
                                                    flex flex-col items-center justify-center py-2 rounded border transition-all
                                                    ${canRefund
                                                        ? 'bg-red-900/30 hover:bg-red-800/50 border-red-800 text-red-300 hover:text-white'
                                                        : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'}
                                                `}
                                            >
                                                <span className="text-[10px] font-bold uppercase">{canRefund ? 'Sell Back' : 'Transit'}</span>
                                                <span className="text-xs font-mono">{canRefund ? `+${selectedConfig.cost}` : 'Locked'}</span>
                                            </button>
                                        )}
                                        {/* Placeholder if no bought items */}
                                        {selectedType && selectedBought.length === 0 && (
                                            <div className="flex items-center justify-center border border-dashed border-gray-800 rounded text-[9px] text-gray-600">
                                                NO INVENTORY
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-gray-600 p-8 text-center">
                            SELECT AN ITEM FROM THE LOGISTICS GRID TO VIEW DETAILS
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

export default ShopModal;
