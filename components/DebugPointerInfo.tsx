import React, { useMemo, useState } from 'react';
import { GameState } from '../types';

interface DebugPointerInfoProps {
    gameState: GameState;
}

const formatElement = (element: Element | null): string => {
    if (!element || !(element instanceof HTMLElement)) return 'none';
    let label = element.tagName.toLowerCase();
    if (element.id) label += `#${element.id}`;
    if (element.classList.length > 0) {
        const cls = Array.from(element.classList).slice(0, 2).join('.');
        label += `.${cls}`;
    }
    return label;
};

const DebugPointerInfo: React.FC<DebugPointerInfoProps> = ({ gameState }) => {
    const [domTarget, setDomTarget] = useState<string>('none');
    const [activeElement, setActiveElement] = useState<string>('body');
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [domEvents, setDomEvents] = useState<string[]>([]);
    const [perfInfo, setPerfInfo] = useState<{
        fps: number;
        avgMs: number;
        p95Ms: number;
        longFrames: number;
        longTasks: number;
        heapUsedMb: number | null;
        heapLimitMb: number | null;
    }>({
        fps: 0,
        avgMs: 0,
        p95Ms: 0,
        longFrames: 0,
        longTasks: 0,
        heapUsedMb: null,
        heapLimitMb: null
    });

    const previewEnd = gameState.previewPath.length > 0
        ? gameState.previewPath[gameState.previewPath.length - 1]
        : null;

    const recentTraces = useMemo(
        () => [...gameState.debugClickTrace].slice(-10).reverse(),
        [gameState.debugClickTrace]
    );

    React.useEffect(() => {
        const onMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
            setDomTarget(formatElement(e.target as Element | null));
            setActiveElement(formatElement(document.activeElement));
        };

        const pushDomEvent = (kind: string, e: MouseEvent) => {
            const row = `${kind} b${e.button} @${e.clientX},${e.clientY} -> ${formatElement(e.target as Element | null)}`;
            setDomEvents(prev => [row, ...prev].slice(0, 8));
        };

        const onPointerDown = (e: PointerEvent) => pushDomEvent('pointerdown', e);
        const onPointerUp = (e: PointerEvent) => pushDomEvent('pointerup', e);
        const onClick = (e: MouseEvent) => pushDomEvent('click', e);

        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('click', onClick, true);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('click', onClick, true);
        };
    }, []);

    React.useEffect(() => {
        let rafId = 0;
        let last = performance.now();
        let nextSnapshotAt = last + 500;
        const frameTimes: number[] = [];
        let longFrameCount = 0;
        let longTaskCount = 0;

        const maybeMemory = (performance as any).memory;

        let longTaskObserver: PerformanceObserver | null = null;
        if ('PerformanceObserver' in window) {
            try {
                longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration >= 50) {
                            longTaskCount += 1;
                        }
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] as PerformanceEntryType[] });
            } catch {
                longTaskObserver = null;
            }
        }

        const tick = (now: number) => {
            const dt = now - last;
            last = now;

            if (dt > 0 && dt < 250) {
                frameTimes.push(dt);
                if (frameTimes.length > 180) frameTimes.shift();
                if (dt > 34) longFrameCount += 1;
            }

            if (now >= nextSnapshotAt) {
                const count = frameTimes.length;
                const avgMs = count > 0 ? frameTimes.reduce((sum, ms) => sum + ms, 0) / count : 0;
                const sorted = [...frameTimes].sort((a, b) => a - b);
                const p95Index = Math.max(0, Math.floor(sorted.length * 0.95) - 1);
                const p95Ms = sorted.length > 0 ? sorted[p95Index] : 0;
                const fps = avgMs > 0 ? 1000 / avgMs : 0;

                const heapUsedMb = maybeMemory ? (maybeMemory.usedJSHeapSize / (1024 * 1024)) : null;
                const heapLimitMb = maybeMemory ? (maybeMemory.jsHeapSizeLimit / (1024 * 1024)) : null;

                setPerfInfo({
                    fps,
                    avgMs,
                    p95Ms,
                    longFrames: longFrameCount,
                    longTasks: longTaskCount,
                    heapUsedMb,
                    heapLimitMb
                });

                longFrameCount = 0;
                longTaskCount = 0;
                nextSnapshotAt = now + 500;
            }

            rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
        return () => {
            window.cancelAnimationFrame(rafId);
            if (longTaskObserver) longTaskObserver.disconnect();
        };
    }, []);

    return (
        <div
            style={{
                position: 'fixed',
                right: 10,
                top: 10,
                width: 420,
                maxHeight: 'calc(100vh - 20px)',
                background: 'rgba(0, 0, 0, 0.85)',
                color: '#9fffa8',
                border: '1px solid #2f7a42',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 11,
                fontFamily: 'monospace',
                pointerEvents: 'none',
                zIndex: 99999,
                lineHeight: 1.35
            }}
        >
            <div style={{ color: '#d9ffd9', fontWeight: 700, marginBottom: 6 }}>INPUT DEBUG</div>
            <div>mouse: {mousePos.x}, {mousePos.y}</div>
            <div>dom target: {domTarget}</div>
            <div>active element: {activeElement}</div>
            <div>mode: {gameState.interactionState.mode}</div>
            <div>selected unit: {gameState.selectedUnitId || 'none'}</div>
            <div>selected card: {gameState.selectedCardId || 'none'}</div>
            <div>hover tile: {gameState.debugLastHoverTile ? `${gameState.debugLastHoverTile.x},${gameState.debugLastHoverTile.z}` : 'none'}</div>
            <div>preview path: {gameState.previewPath.length} {previewEnd ? `-> ${previewEnd.x},${previewEnd.z}` : ''}</div>
            <div style={{ color: '#ffd580', marginTop: 6 }}>last decision: {gameState.debugLastDecision || 'none'}</div>

            <div style={{ marginTop: 8, color: '#ffdf9a', fontWeight: 700 }}>performance</div>
            <div>fps: {perfInfo.fps.toFixed(1)}</div>
            <div>frame ms avg/p95: {perfInfo.avgMs.toFixed(2)} / {perfInfo.p95Ms.toFixed(2)}</div>
            <div>long frames (&gt;34ms): {perfInfo.longFrames} / 0.5s</div>
            <div>long tasks (&gt;50ms): {perfInfo.longTasks} / 0.5s</div>
            <div>
                heap: {perfInfo.heapUsedMb !== null ? `${perfInfo.heapUsedMb.toFixed(1)} MB` : 'n/a'}
                {perfInfo.heapLimitMb !== null ? ` / ${perfInfo.heapLimitMb.toFixed(0)} MB` : ''}
            </div>

            <div style={{ marginTop: 8, color: '#9ad9ff', fontWeight: 700 }}>dom click chain</div>
            {domEvents.length === 0 && <div style={{ color: '#777' }}>no events yet</div>}
            {domEvents.map((row, idx) => (
                <div key={`dom-${idx}`} style={{ color: '#8ec7ff' }}>{row}</div>
            ))}

            <div style={{ marginTop: 8, color: '#ffb7b7', fontWeight: 700 }}>game click trace</div>
            {recentTraces.length === 0 && <div style={{ color: '#777' }}>no traces yet</div>}
            {recentTraces.map((trace) => (
                <div key={trace.id} style={{ borderTop: '1px solid rgba(80,80,80,0.5)', paddingTop: 4, marginTop: 4 }}>
                    <div style={{ color: trace.result === 'REJECT' ? '#ff7a7a' : trace.result === 'ACTION' ? '#b2ff7a' : '#d0d0d0' }}>
                        {trace.timestamp} {trace.result} {trace.stage}
                    </div>
                    <div>{trace.reason}</div>
                    <div style={{ color: '#aaa' }}>
                        mode={trace.mode} tile={trace.tile ? `${trace.tile.x},${trace.tile.z}` : '-'} unit={trace.unitId || '-'} preview={trace.previewPathLength}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DebugPointerInfo;
