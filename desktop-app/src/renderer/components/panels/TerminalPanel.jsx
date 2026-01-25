import React from 'react';
import Terminal from '../Terminal';
import useWorkspaceStore from '../../store/workspaceStore';

const TerminalPanel = () => {
  const { workspacePath } = useWorkspaceStore();

  return (
    <div className="panel-content">
      <Terminal workspacePath={workspacePath} />
    </div>
  );
};

export default TerminalPanel;
