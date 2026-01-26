import React from 'react';
import Terminal from '../Terminal';
import useWorkspaceStore from '../../store/workspaceStore';

const TerminalPanel = ({ isVisible = true }) => {
  const { workspacePath } = useWorkspaceStore();

  return (
    <div className="panel-content">
      <Terminal workspacePath={workspacePath} isVisible={isVisible} />
    </div>
  );
};

export default TerminalPanel;
