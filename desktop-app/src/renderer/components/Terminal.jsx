import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import useSettingsStore from '../store/settingsStore';

const Terminal = ({ workspacePath, isVisible = true }) => {
  const { settings } = useSettingsStore();
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const terminalIdRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const isFitReadyRef = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const container = terminalRef.current;
    let mounted = true;
    let resizeTimeout;

    // Calculate dimensions from container
    const calculateDimensions = () => {
      const { clientWidth, clientHeight } = container;
      const cols = Math.max(Math.floor(clientWidth / 9), 10); // ~9px per char
      const rows = Math.max(Math.floor(clientHeight / 17), 10); // ~17px per row
      return { cols, rows };
    };

    // Wait for container to have dimensions
    const initWhenReady = () => {
      const { clientWidth, clientHeight } = container;

      if (clientWidth === 0 || clientHeight === 0) {
        // Container not ready, try again
        setTimeout(initWhenReady, 50);
        return;
      }

      // Container ready, initialize
      // Create xterm with safe default dimensions to avoid viewport issues
      const xterm = new XTerm({
        cols: 80,
        rows: 24,
        cursorBlink: true,
        fontSize: settings['terminal.fontSize'] || 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#ffffff',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5'
        },
        allowProposedApi: true,
        convertEol: true
      });

      xtermRef.current = xterm;

      // Handle terminal data from backend
      const handleData = (id, data) => {
        if (mounted && id === terminalIdRef.current && xtermRef.current) {
          try {
            xtermRef.current.write(data);
          } catch (err) {
            console.warn('Failed to write data:', err);
          }
        }
      };

      const handleExit = (id, exitCode) => {
        if (mounted && id === terminalIdRef.current && xtermRef.current) {
          try {
            xtermRef.current.writeln(`\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m`);
          } catch (err) {
            console.warn('Failed to write exit message:', err);
          }
        }
      };

      window.electronAPI.terminal.onData(handleData);
      window.electronAPI.terminal.onExit(handleExit);

      // Handle user input
      xterm.onData((data) => {
        if (mounted && terminalIdRef.current) {
          window.electronAPI.terminal.write(terminalIdRef.current, data);
        }
      });

      // Ensure container has explicit dimensions before opening
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (containerWidth === 0 || containerHeight === 0) {
        console.error('Container has no dimensions, cannot initialize terminal');
        return;
      }

      // Temporarily give container explicit size to prevent layout shifts during open
      const originalWidth = container.style.width;
      const originalHeight = container.style.height;
      container.style.width = `${containerWidth}px`;
      container.style.height = `${containerHeight}px`;

      // Open terminal with stable container
      xterm.open(container);

      // Restore flex sizing after open completes
      setTimeout(() => {
        if (!mounted) return;
        container.style.width = originalWidth;
        container.style.height = originalHeight;
      }, 50);

      // Wait longer for xterm to fully initialize render service
      setTimeout(() => {
        if (!mounted) return;

        try {
          const fitAddon = new FitAddon();
          xterm.loadAddon(fitAddon);
          fitAddonRef.current = fitAddon;

          // Fit to container after load
          setTimeout(() => {
            if (!mounted || !fitAddonRef.current) return;

            try {
              fitAddonRef.current.fit();

              // Mark FitAddon as ready
              isFitReadyRef.current = true;

              // Setup resize handler with debounce and strong validation
              const handleResize = () => {
                // Check mounted first - if unmounted, don't even set timeout
                if (!mounted) return;

                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                  // Double-check mounted after timeout
                  if (!mounted) return;

                  if (!isFitReadyRef.current) {
                    console.log('Resize skipped: FitAddon not ready');
                    return;
                  }

                  if (!fitAddonRef.current || !xtermRef.current) {
                    console.log('Resize skipped: refs not ready');
                    return;
                  }

                  // Check if xterm has been disposed
                  try {
                    const cols = xtermRef.current.cols;
                    if (typeof cols !== 'number') {
                      console.log('Resize skipped: xterm appears disposed');
                      return;
                    }
                  } catch (e) {
                    console.log('Resize skipped: xterm access error', e);
                    return;
                  }

                  // Now safe to fit
                  try {
                    fitAddonRef.current.fit();
                    if (terminalIdRef.current) {
                      window.electronAPI.terminal.resize(
                        terminalIdRef.current,
                        xtermRef.current.cols,
                        xtermRef.current.rows
                      );
                    }
                  } catch (err) {
                    console.warn('Failed to resize terminal:', err);
                    isFitReadyRef.current = false;
                  }
                }, 100);
              };

              // Setup ResizeObserver
              const resizeObserver = new ResizeObserver(handleResize);
              resizeObserverRef.current = resizeObserver;
              resizeObserver.observe(container);

            } catch (err) {
              console.warn('Failed to fit terminal:', err);
            }
          }, 100);

        } catch (err) {
          console.warn('Failed to setup FitAddon:', err);
        }
      }, 300);

      // Create backend terminal
      const createBackendTerminal = async () => {
        try {
          const result = await window.electronAPI.terminal.create({
            cols: xterm.cols,
            rows: xterm.rows,
            cwd: workspacePath || undefined
          });

          if (!mounted) return;

          if (result.success) {
            terminalIdRef.current = result.data.id;
            console.log('Terminal created:', result.data.id);
          } else {
            setError(result.error);
            xterm.writeln(`\r\n\x1b[31mFailed to create terminal: ${result.error}\x1b[0m`);
          }
        } catch (err) {
          if (mounted) {
            setError(err.message);
            xterm.writeln(`\r\n\x1b[31mError: ${err.message}\x1b[0m`);
          }
        }
      };

      createBackendTerminal();
    };

    // Start initialization
    initWhenReady();

    // Cleanup
    return () => {
      console.log('Terminal cleanup starting');
      mounted = false;
      isFitReadyRef.current = false;
      clearTimeout(resizeTimeout);

      // Disconnect ResizeObserver immediately
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
          console.log('ResizeObserver disconnected');
        } catch (err) {
          console.warn('Error disconnecting ResizeObserver:', err);
        }
        resizeObserverRef.current = null;
      }

      // Dispose xterm immediately
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose();
          console.log('Xterm disposed');
        } catch (err) {
          console.warn('Error disposing xterm:', err);
        }
        xtermRef.current = null;
      }

      // Destroy backend terminal
      if (terminalIdRef.current) {
        try {
          window.electronAPI.terminal.destroy(terminalIdRef.current);
          console.log('Backend terminal destroyed:', terminalIdRef.current);
        } catch (err) {
          console.warn('Error destroying terminal:', err);
        }
        terminalIdRef.current = null;
      }

      fitAddonRef.current = null;
    };
  }, [workspacePath]);

  // Handle visibility changes - fit when terminal becomes visible
  useEffect(() => {
    if (!isVisible || !isFitReadyRef.current) return;

    // Small delay to ensure layout is ready
    const timeoutId = setTimeout(() => {
      if (!fitAddonRef.current || !xtermRef.current) return;

      try {
        // Fit the terminal to container
        fitAddonRef.current.fit();

        // Scroll to bottom
        xtermRef.current.scrollToBottom();

        // Update backend with new size
        if (terminalIdRef.current) {
          window.electronAPI.terminal.resize(
            terminalIdRef.current,
            xtermRef.current.cols,
            xtermRef.current.rows
          );
        }

        console.log('Terminal resized on visibility change');
      } catch (err) {
        console.warn('Failed to resize terminal:', err);
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [isVisible]);

  return (
    <div ref={terminalRef} className="terminal-content" />
  );
};

export default Terminal;
