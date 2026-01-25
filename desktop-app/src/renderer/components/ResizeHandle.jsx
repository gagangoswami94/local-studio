import React, { useRef, useEffect } from 'react';

const ResizeHandle = ({ direction, onResize }) => {
  const isDragging = useRef(false);
  const startPos = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;

      const delta = direction === 'horizontal'
        ? e.clientX - startPos.current
        : e.clientY - startPos.current;

      onResize(delta);
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, onResize]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
};

export default ResizeHandle;
