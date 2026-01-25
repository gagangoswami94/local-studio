import React, { useMemo } from 'react';
import useProblemsStore from '../../store/problemsStore';
import path from 'path-browserify';

const ProblemsPanel = () => {
  const { problems, getTotalCounts, getCountsForFile } = useProblemsStore();

  // Get total counts
  const { errors: totalErrors, warnings: totalWarnings } = getTotalCounts();

  // Get files with problems
  const filesWithProblems = useMemo(() => {
    return Object.keys(problems).filter(filePath => problems[filePath].length > 0);
  }, [problems]);

  /**
   * Get severity icon
   */
  const getSeverityIcon = (severity) => {
    return severity === 'error' ? '🔴' : '⚠️';
  };

  /**
   * Get filename from path
   */
  const getFileName = (filePath) => {
    return path.basename(filePath);
  };

  /**
   * Handle problem click - jump to line in editor
   * TODO: Implement editor jump functionality when Monaco is integrated
   */
  const handleProblemClick = (filePath, problem) => {
    console.log(`Jump to ${filePath}:${problem.line}:${problem.column}`);
    // TODO: Integrate with editor to jump to line
  };

  return (
    <div className="panel-content problems-panel">
      {/* Header with counts */}
      <div className="problems-header">
        <div className="problems-counts">
          {totalErrors > 0 && (
            <span className="problem-count error-count">
              🔴 {totalErrors} {totalErrors === 1 ? 'Error' : 'Errors'}
            </span>
          )}
          {totalWarnings > 0 && (
            <span className="problem-count warning-count">
              ⚠️ {totalWarnings} {totalWarnings === 1 ? 'Warning' : 'Warnings'}
            </span>
          )}
          {totalErrors === 0 && totalWarnings === 0 && (
            <span className="problem-count no-problems">
              ✓ No Problems
            </span>
          )}
        </div>
      </div>

      {/* Problems list */}
      <div className="problems-list">
        {filesWithProblems.length === 0 ? (
          <div className="problems-empty">
            <p>No problems detected</p>
            <p className="problems-hint">Problems will appear here as you edit files</p>
          </div>
        ) : (
          filesWithProblems.map((filePath) => {
            const fileProblems = problems[filePath];
            const { errors: fileErrors, warnings: fileWarnings } = getCountsForFile(filePath);

            return (
              <div key={filePath} className="problem-file-group">
                {/* File header */}
                <div className="problem-file-header">
                  <span className="problem-file-name">{getFileName(filePath)}</span>
                  <span className="problem-file-path">{filePath}</span>
                  <span className="problem-file-counts">
                    {fileErrors > 0 && <span className="file-error-count">🔴 {fileErrors}</span>}
                    {fileWarnings > 0 && <span className="file-warning-count">⚠️ {fileWarnings}</span>}
                  </span>
                </div>

                {/* File problems */}
                <div className="problem-file-items">
                  {fileProblems.map((problem, index) => (
                    <div
                      key={index}
                      className={`problem-item ${problem.severity}`}
                      onClick={() => handleProblemClick(filePath, problem)}
                      title="Click to jump to line"
                    >
                      <span className="problem-icon">{getSeverityIcon(problem.severity)}</span>
                      <span className="problem-location">
                        ({problem.line}:{problem.column})
                      </span>
                      <span className="problem-message">{problem.message}</span>
                      {problem.ruleId && (
                        <span className="problem-rule">[{problem.ruleId}]</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProblemsPanel;
