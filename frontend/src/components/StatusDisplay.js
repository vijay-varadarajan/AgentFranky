import React from 'react';
import { Clock, CheckCircle, AlertCircle, Loader, User, FileText, Search, Edit } from 'lucide-react';

const StatusDisplay = ({ statusUpdates, currentStatus, isConnected }) => {
  const getStepIcon = (step, type) => {
    const stepLower = step?.toLowerCase() || '';
    
    if (type === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (type === 'completion') return <CheckCircle className="w-4 h-4 text-green-500" />;
    
    if (stepLower.includes('create_analysts') || stepLower.includes('session_started')) {
      return <User className="w-4 h-4 text-blue-500" />;
    }
    if (stepLower.includes('interview') || stepLower.includes('question') || stepLower.includes('answer')) {
      return <Search className="w-4 h-4 text-purple-500" />;
    }
    if (stepLower.includes('write') || stepLower.includes('report') || stepLower.includes('section')) {
      return <FileText className="w-4 h-4 text-green-500" />;
    }
    if (stepLower.includes('modification') || stepLower.includes('modified')) {
      return <Edit className="w-4 h-4 text-orange-500" />;
    }
    
    return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
  };

  const getStepColor = (step, type) => {
    if (type === 'error') return 'border-red-200 bg-red-50';
    if (type === 'completion') return 'border-green-200 bg-green-50';
    if (type === 'approval') return 'border-blue-200 bg-blue-50';
    if (type === 'modification') return 'border-orange-200 bg-orange-50';
    if (type === 'session') return 'border-purple-200 bg-purple-50';
    
    return 'border-gray-200 bg-gray-50';
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatStepName = (step) => {
    if (!step) return 'Processing...';
    
    // Convert step names to more readable format
    const stepMap = {
      'CREATE_ANALYSTS': 'Creating Analyst Team',
      'INITIATE_ALL_INTERVIEWS': 'Starting Interviews',
      'ASK_QUESTION': 'Asking Research Questions',
      'SEARCH_WEB': 'Searching the Web',
      'SEARCH_WIKIPEDIA': 'Searching Wikipedia',
      'GENERATE_ANSWER': 'Generating Expert Answers',
      'SAVE_INTERVIEW': 'Saving Interview',
      'WRITE_SECTION': 'Writing Report Section',
      'WRITE_REPORT': 'Compiling Research Report',
      'WRITE_INTRODUCTION': 'Writing Introduction',
      'WRITE_CONCLUSION': 'Writing Conclusion',
      'FINALIZE_REPORT': 'Finalizing Report',
      'SESSION_STARTED': 'Session Started',
      'RESEARCH_APPROVED': 'Research Approved',
      'RESEARCH_COMPLETED': 'Research Completed',
      'MODIFICATION_STARTED': 'Modifying Analysts',
      'ANALYSTS_MODIFIED': 'Analysts Updated',
      'ERROR': 'Error Occurred'
    };

    return stepMap[step] || step.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!statusUpdates.length && !currentStatus) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <h3 className="text-lg font-semibold text-gray-900">Research Progress</h3>
        </div>
        <p className="text-gray-600 mt-2">
          {isConnected ? 'Connected and ready to track research progress...' : 'Connecting to server...'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <h3 className="text-lg font-semibold text-gray-900">Research Progress</h3>
        </div>
        <span className="text-sm text-gray-500">
          {statusUpdates.length} step{statusUpdates.length !== 1 ? 's' : ''} completed
        </span>
      </div>
      
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {statusUpdates.map((update, index) => (
          <div
            key={update.id || index}
            className={`flex items-start space-x-3 p-3 rounded-lg border ${getStepColor(update.step, update.type)}`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStepIcon(update.step, update.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {formatStepName(update.step)}
                </p>
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(update.timestamp)}
                </span>
              </div>
              {update.message && (
                <p className="text-sm text-gray-600 mt-1">{update.message}</p>
              )}
              {update.step_number && (
                <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mt-1">
                  Step {update.step_number}
                </span>
              )}
              {update.additional_info && Object.keys(update.additional_info).length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {Object.entries(update.additional_info).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {currentStatus && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Loader className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-blue-900">
              Current: {formatStepName(currentStatus.step)}
            </span>
          </div>
          {currentStatus.message && (
            <p className="text-sm text-blue-700 mt-1">{currentStatus.message}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;
