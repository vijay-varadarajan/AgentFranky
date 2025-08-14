import React, { useState, useRef, useEffect } from 'react';
import { Search, User, Bot, Send, CheckCircle, Edit, AlertCircle, X, Download, Github } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import API_BASE_URL from './config';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [error, setError] = useState(null);
  const [selectedAnalyst, setSelectedAnalyst] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [showModifyButton, setShowModifyButton] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (content, type, metadata = {}) => {
    const message = {
      id: Date.now(),
      content,
      type,
      timestamp: new Date(),
      ...metadata
    };
    setMessages(prev => [...prev, message]);
    return message;
  };

  const startResearch = async (topic) => {
    try {
      setIsLoading(true);
      setError(null);
      setIsApproved(false); // Reset approval state for new research
      setShowModifyButton(true); // Reset modify button visibility
      setSelectedAnalyst(null); // Reset selected analyst
      
      addMessage(topic, 'user');
      addMessage('🔍 Starting research on your topic...', 'assistant', { isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/api/research/start`, {
        topic: topic,
        max_analysts: 3
      });

      // Remove loading message
      setMessages(prev => prev.slice(0, -1));

      if (response.data.analysts) {
        setCurrentSession({
          id: response.data.session_id,
          topic: topic,
          analysts: response.data.analysts,
          state: 'awaiting_approval'
        });

        addMessage('👥 I\'ve created a team of AI analysts for your research topic:', 'assistant', {
          analysts: response.data.analysts,
          needsApproval: true
        });
      }
    } catch (error) {
      console.error('Error starting research:', error);
      setMessages(prev => prev.slice(0, -1));
      setError('Failed to start research. Please try again.');
      addMessage('❌ Sorry, there was an error starting the research. Please try again.', 'assistant', { isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const approveAnalysts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Add animation to approve button
      setIsApproved(true);
      setTimeout(() => setShowModifyButton(false), 300);

      addMessage('✅ Team approved! Starting in-depth research...', 'assistant', { isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/api/research/approve`, {
        session_id: currentSession.id
      });

      // Remove loading message
      setMessages(prev => prev.slice(0, -1));

      if (response.data.final_report) {
        addMessage('📋 Research complete! Here\'s your comprehensive report:', 'assistant', {
          report: response.data.final_report
        });
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Error approving analysts:', error);
      setMessages(prev => prev.slice(0, -1));
      setError('Failed to complete research. Please try again.');
      addMessage('❌ Sorry, there was an error completing the research. Please try again with a new topic.', 'assistant', { isError: true });
      setCurrentSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const modifyAnalysts = async (feedback) => {
    try {
      setIsLoading(true);
      setError(null);

      addMessage(`📝 Modifying analyst team based on your feedback: "${feedback}"`, 'assistant', { isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/api/research/modify`, {
        session_id: currentSession.id,
        feedback: feedback
      });

      // Remove loading message
      setMessages(prev => prev.slice(0, -1));

      if (response.data.analysts) {
        setCurrentSession(prev => ({
          ...prev,
          analysts: response.data.analysts
        }));

        addMessage('🔄 I\'ve updated the analyst team based on your feedback:', 'assistant', {
          analysts: response.data.analysts,
          needsApproval: true
        });
        
        // Reset approval state for new team
        setIsApproved(false);
        setShowModifyButton(true);
      }
    } catch (error) {
      console.error('Error modifying analysts:', error);
      setMessages(prev => prev.slice(0, -1));
      setError('Failed to modify analysts. Please try again.');
      addMessage('❌ Sorry, there was an error modifying the analysts. Please try again.', 'assistant', { isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const input = inputValue.trim();
    setInputValue('');

    if (currentSession?.state === 'awaiting_approval') {
      // This is feedback for modifying analysts
      modifyAnalysts(input);
    } else {
      // This is a new research topic
      startResearch(input);
    }
  };

  const downloadReportAsPDF = async (reportContent) => {
    try {
      // Create a temporary element to render the markdown
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.color = 'black';
      
      // Convert markdown to HTML (simple conversion)
      const htmlContent = reportContent
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n/gim, '<br>');
      
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);
      
      // Create PDF
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgWidth = 190;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;
      
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save('research-report.pdf');
      
      // Clean up
      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const AnalystModal = ({ analyst, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{analyst.name}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="role">{analyst.role}</div>
          <div className="affiliation">{analyst.affiliation}</div>
          <div className="description">{analyst.description}</div>
        </div>
      </div>
    </div>
  );

  const AnalystsDisplay = ({ analysts, needsApproval }) => (
    <div className="analysts-display">
      <h3><Bot size={20} /> AI Analyst Team</h3>
      <div className="analysts-grid">
        {analysts.map((analyst, index) => (
          <div 
            key={index} 
            className="analyst-card"
            onClick={() => setSelectedAnalyst(analyst)}
          >
            <h4>{analyst.name}</h4>
            <div className="role">{analyst.role}</div>
            <div className="affiliation">{analyst.affiliation}</div>
          </div>
        ))}
      </div>
      {needsApproval && (
        <div className="approval-buttons">
          <button 
            className={`btn btn-primary ${isApproved ? 'btn-approved' : ''}`}
            onClick={approveAnalysts}
            disabled={isLoading || isApproved}
          >
            <CheckCircle size={16} />
            <span className="btn-text">Approve Team</span>
          </button>
          {showModifyButton && (
            <button 
              className={`btn btn-secondary ${!showModifyButton ? 'btn-disappearing' : ''}`}
              onClick={() => {
                const feedback = prompt('How would you like me to modify the analyst team?');
                if (feedback) modifyAnalysts(feedback);
              }}
              disabled={isLoading}
            >
              <Edit size={16} />
              Modify Team
            </button>
          )}
        </div>
      )}
    </div>
  );

  const ReportDisplay = ({ report }) => (
    <div className="report-content" id="report-content">
      <div className="report-header">
        <h2>📋 Research Report</h2>
        <button 
          className="download-btn"
          onClick={() => downloadReportAsPDF(report)}
          title="Download as PDF"
        >
          <Download size={16} />
          Download PDF
        </button>
      </div>
      <ReactMarkdown>{report}</ReactMarkdown>
    </div>
  );

  const LoadingIndicator = () => (
    <div className="loading">
      <span>Processing</span>
      <div className="loading-dots">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
    </div>
  );

  const WelcomeMessage = () => (
    <div className="welcome-message">
      <h2>🔬 Welcome to AI Research Assistant</h2>
      <p>
        I can help you create comprehensive research reports on any topic. 
        Simply enter your research topic below and I'll create a team of AI analysts 
        to conduct in-depth research and provide you with a detailed report.
      </p>
      
      <div className="features-grid">
        <div className="feature-card">
          <h3>🎯 Targeted Analysis</h3>
          <p>I create specialized AI analysts for different aspects of your topic</p>
        </div>
        <div className="feature-card">
          <h3>📊 Comprehensive Reports</h3>
          <p>Get detailed reports with introduction, analysis, conclusion, and sources</p>
        </div>
        <div className="feature-card">
          <h3>🔄 Customizable Teams</h3>
          <p>Review and modify the analyst team before research begins</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <h1>
          <Search size={24} />
          AI Research Assistant
        </h1>
        <a 
          href="https://github.com/vijay-varadarajan/researchagent-v0" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
          aria-label="View source code on GitHub"
        >
          <Github size={24} />
        </a>
      </header>

      <main className="chat-container">
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-avatar">
                  {message.type === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="message-content">
                  {message.isLoading && <LoadingIndicator />}
                  {message.isError && (
                    <div className="error-message">
                      <AlertCircle size={16} />
                      {message.content}
                    </div>
                  )}
                  {!message.isLoading && !message.isError && (
                    <>
                      {message.content}
                      {message.analysts && (
                        <AnalystsDisplay 
                          analysts={message.analysts} 
                          needsApproval={message.needsApproval}
                        />
                      )}
                      {message.report && <ReportDisplay report={message.report} />}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="input-container">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              currentSession?.state === 'awaiting_approval' 
                ? "Provide feedback to modify the analyst team..." 
                : "Enter your research topic (e.g., 'Machine Learning in Healthcare')"
            }
            className="input-field"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={isLoading || !inputValue.trim()}
          >
            <Send size={18} />
            {currentSession?.state === 'awaiting_approval' ? 'Send Feedback' : 'Start Research'}
          </button>
        </form>
      </main>

      {selectedAnalyst && (
        <AnalystModal 
          analyst={selectedAnalyst} 
          onClose={() => setSelectedAnalyst(null)} 
        />
      )}
    </div>
  );
};

export default App;
