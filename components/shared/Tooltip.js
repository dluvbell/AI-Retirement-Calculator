// --- components/shared/Tooltip.js ---

const Tooltip = ({ children, text }) => {
    // 툴팁의 표시 여부를 관리하는 State
    const [isVisible, setIsVisible] = React.useState(false);

    // --- 스타일 정의 ---
    const containerStyle = {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center'
    };

    const tooltipTextStyle = {
        position: 'absolute',
        bottom: '125%', // children 요소의 위쪽에 위치
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#111827', // 어두운 배경색
        color: '#d1d5db', // 밝은 글자색
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '500',
        width: '200px', // 툴팁의 너비
        zIndex: 10,
        border: '1px solid #374151',
        // isVisible 값에 따라 투명도와 표시 여부 변경
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out'
    };

    return (
        <div 
            style={containerStyle}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {/* 툴팁을 트리거할 요소 (예: '?' 아이콘) */}
            {children}

            {/* 실제 툴팁 말풍선 */}
            <div style={tooltipTextStyle}>
                {text}
            </div>
        </div>
    );
};