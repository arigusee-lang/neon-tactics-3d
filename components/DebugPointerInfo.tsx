import React, { useEffect, useState } from 'react';

const DebugPointerInfo: React.FC = () => {
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const requestRef = React.useRef<number | undefined>(undefined);
    const mousePos = React.useRef<{ x: number, y: number, target: HTMLElement | null }>({ x: 0, y: 0, target: null });

    React.useEffect(() => {
        const update = () => {
            if (tooltipRef.current && mousePos.current.target) {
                const { x, y, target } = mousePos.current;

                let text = target.tagName ? target.tagName.toLowerCase() : 'unknown';
                if (target.id) text += `#${target.id}`;
                if (target.classList && target.classList.length > 0) {
                    // Get first 2 classes
                    const classes = Array.from(target.classList).slice(0, 2).join('.');
                    text += `.${classes}${target.classList.length > 2 ? '...' : ''}`;
                }

                // Add Active Element info
                if (document.activeElement && document.activeElement !== document.body) {
                    let activeText = document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : 'unknown';
                    if (document.activeElement.id) activeText += `#${document.activeElement.id}`;
                    text += ` | Active: ${activeText}`;
                }

                tooltipRef.current.style.transform = `translate(${x + 15}px, ${y + 15}px)`;
                tooltipRef.current.textContent = text;
                tooltipRef.current.style.opacity = '1';

                // Color coding: Green if it's the canvas (Game Scene), Red/Orange if it's blocking UI
                if (text.startsWith('canvas')) {
                    tooltipRef.current.style.borderColor = '#00ff00';
                    tooltipRef.current.style.color = '#00ff00';
                    tooltipRef.current.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; // More transparent
                } else {
                    tooltipRef.current.style.borderColor = '#ff3300';
                    tooltipRef.current.style.color = '#ff3300';
                    tooltipRef.current.style.backgroundColor = 'rgba(20, 0, 0, 0.8)';
                }
            }
            requestRef.current = requestAnimationFrame(update);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = {
                x: e.clientX,
                y: e.clientY,
                target: e.target as HTMLElement
            };
        };

        window.addEventListener('mousemove', handleMouseMove);
        requestRef.current = requestAnimationFrame(update);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div
            ref={tooltipRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                opacity: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: '#00ff00',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 99999,
                whiteSpace: 'nowrap',
                border: '1px solid #00ff00',
                borderRadius: '4px',
                willChange: 'transform',
                boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
            }}
        />
    );
};

export default DebugPointerInfo;
