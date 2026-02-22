import React from 'react';

interface CyberMarineIconProps {
    color: string;
    className?: string;
}

const CyberMarineIcon: React.FC<CyberMarineIconProps> = ({ color, className }) => {
    return (
        <img
            src="/space_marine_icon.png"
            alt="Cyber Marine"
            className={className}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
    );
};

export default CyberMarineIcon;
