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
      // Parse the report content to extract sections
      const sections = parseReportSections(reportContent);
      
      // Handle different ways jsPDF might be loaded
      let jsPDF;
      if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
      } else if (window.jsPDF) {
        jsPDF = window.jsPDF;
      } else {
        // Try to import if using ES modules
        try {
          const jsPDFModule = await import('jspdf');
          jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
        } catch (importError) {
          throw new Error('jsPDF library not found. Please ensure jsPDF is properly loaded.');
        }
      }
      
      // Create PDF with better formatting
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // PDF configuration
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin;
      
      // Color scheme
      const colors = {
        primary: [41, 128, 185], // Professional blue
        secondary: [52, 73, 94], // Dark gray
        text: [44, 62, 80], // Darker text
        light: [236, 240, 241], // Light background
        accent: [231, 76, 60] // Red for emphasis
      };
      
      // Helper function to add a new page if needed
      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };
      
      // Helper function to add text with proper wrapping
      const addText = (text, fontSize, fontStyle = 'normal', color = colors.text, maxWidth = contentWidth) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', fontStyle);
        pdf.setTextColor(...color);
        
        const lines = pdf.splitTextToSize(text, maxWidth);
        const lineHeight = fontSize * 0.4;
        
        checkPageBreak(lines.length * lineHeight);
        
        lines.forEach((line, index) => {
          pdf.text(line, margin, currentY + (index * lineHeight));
        });
        
        currentY += lines.length * lineHeight;
        return lines.length;
      };
      
      // Add header with company branding (optional)
      const addHeader = () => {
        // Add a subtle header line
        pdf.setDrawColor(...colors.primary);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 15, pageWidth - margin, 15);
        
        // Add page number
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        const pageNum = pdf.internal.getCurrentPageInfo().pageNumber;
        pdf.text(`Page ${pageNum}`, pageWidth - margin - 20, 12);
      };
      
      // Add footer
      const addFooter = () => {
        const footerY = pageHeight - 15;
        pdf.setDrawColor(...colors.light);
        pdf.setLineWidth(0.3);
        pdf.line(margin, footerY, pageWidth - margin, footerY);
        
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text('Generated on ' + new Date().toLocaleDateString(), margin, footerY + 5);
      };
      
      // 1. Title Page
      if (sections.title) {
        // Center the title
        pdf.setFontSize(28);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...colors.primary);
        
        const titleLines = pdf.splitTextToSize(sections.title, contentWidth);
        const titleHeight = titleLines.length * 12;
        const titleStartY = (pageHeight / 2) - (titleHeight / 2);
        
        titleLines.forEach((line, index) => {
          const textWidth = pdf.getTextWidth(line);
          const x = (pageWidth - textWidth) / 2;
          pdf.text(line, x, titleStartY + (index * 12));
        });
        
        // Add a decorative line under title
        pdf.setDrawColor(...colors.primary);
        pdf.setLineWidth(1);
        pdf.line(pageWidth/4, titleStartY + titleHeight + 10, 3*pageWidth/4, titleStartY + titleHeight + 10);
        
        // Add generation date
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...colors.secondary);
        const dateText = 'Generated on ' + new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const dateWidth = pdf.getTextWidth(dateText);
        pdf.text(dateText, (pageWidth - dateWidth) / 2, titleStartY + titleHeight + 30);
        
        // Start new page for content
        pdf.addPage();
        currentY = margin;
      }
      
      // Add headers and footers to all pages
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        if (i > 1) { // Skip header/footer on title page
          addHeader();
          addFooter();
        }
      }
      
      // Go to content page
      if (sections.title) {
        pdf.setPage(2);
        currentY = margin + 10; // Start below header
      }
      
      // 2. Table of Contents (if multiple sections)
      const hasSections = sections.introduction || sections.body || sections.conclusion;
      if (hasSections) {
        addText('Table of Contents', 18, 'bold', colors.primary);
        currentY += 5;
        
        // Add TOC entries
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...colors.text);
        
        const tocEntries = [];
        if (sections.introduction) tocEntries.push('Introduction');
        if (sections.body) tocEntries.push('Main Content');
        if (sections.conclusion) tocEntries.push('Conclusion');
        if (sections.sources) tocEntries.push('References');
        
        tocEntries.forEach((entry, index) => {
          checkPageBreak(8);
          pdf.text(`${index + 1}. ${entry}`, margin + 5, currentY);
          currentY += 8;
        });
        
        currentY += 15;
      }
      
      // 3. Introduction
      if (sections.introduction) {
        checkPageBreak(20);
        addText('Introduction', 16, 'bold', colors.primary);
        currentY += 8;
        
        addText(sections.introduction, 11, 'normal', colors.text);
        currentY += 12;
      }
      
      // 4. Main Body
      if (sections.body) {
        checkPageBreak(20);
        addText('Main Content', 16, 'bold', colors.primary);
        currentY += 8;
        
        // Process body content with better formatting
        const bodyParagraphs = sections.body.split('\n\n').filter(p => p.trim());
        
        bodyParagraphs.forEach((paragraph, index) => {
          // Check if it's a heading
          if (paragraph.startsWith('###')) {
            currentY += 5;
            addText(paragraph.replace('###', '').trim(), 13, 'bold', colors.secondary);
            currentY += 5;
          } else if (paragraph.startsWith('##')) {
            currentY += 8;
            addText(paragraph.replace('##', '').trim(), 14, 'bold', colors.primary);
            currentY += 6;
          } else {
            // Regular paragraph
            addText(paragraph.trim(), 11, 'normal', colors.text);
            currentY += 6; // Space between paragraphs
          }
        });
        
        currentY += 12;
      }
      
      // 5. Conclusion
      if (sections.conclusion) {
        checkPageBreak(20);
        addText('Conclusion', 16, 'bold', colors.primary);
        currentY += 8;
        
        addText(sections.conclusion, 11, 'normal', colors.text);
        currentY += 12;
      }
      
      // 6. Sources/References
      if (sections.sources) {
        checkPageBreak(20);
        addText('References', 16, 'bold', colors.primary);
        currentY += 8;
        
        // Format sources as a proper bibliography
        const sourcesList = sections.sources.split('\n').filter(s => s.trim());
        sourcesList.forEach((source, index) => {
          if (source.trim()) {
            checkPageBreak(12);
            const cleanSource = source.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '');
            addText(`${index + 1}. ${cleanSource}`, 10, 'normal', colors.text);
            currentY += 4;
          }
        });
      }
      
      // Final page numbering update
      const finalTotalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= finalTotalPages; i++) {
        pdf.setPage(i);
        if (i > 1) {
          // Update page numbers
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          // Clear previous page number
          pdf.setFillColor(255, 255, 255);
          pdf.rect(pageWidth - margin - 25, 8, 25, 8, 'F');
          // Add new page number
          pdf.text(`Page ${i} of ${finalTotalPages}`, pageWidth - margin - 24, 12);
        }
      }
      
      // Save the PDF
      const fileName = sections.title 
        ? `${sections.title.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
        : 'research-report.pdf';
      
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF. Please check your content and try again.');
    }
  };

  // Helper function to parse report sections
  const parseReportSections = (content) => {
    const sections = {};
    
    // Simple parsing - you may need to adjust based on your content structure
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent = '';
    
    for (const line of lines) {
      if (line.toLowerCase().includes('title') || line.startsWith('# ')) {
        if (currentSection) sections[currentSection] = currentContent.trim();
        currentSection = 'title';
        currentContent = line.replace(/^#\s*/, '').replace(/title:/i, '').trim();
      } else if (line.toLowerCase().includes('introduction') || line.startsWith('## Introduction')) {
        if (currentSection) sections[currentSection] = currentContent.trim();
        currentSection = 'introduction';
        currentContent = '';
      } else if (line.toLowerCase().includes('body') || line.toLowerCase().includes('main content') || line.startsWith('## ')) {
        if (currentSection && currentSection !== 'introduction') {
          if (currentSection) sections[currentSection] = currentContent.trim();
          currentSection = 'body';
          currentContent = line.startsWith('## ') ? '' : line;
        } else if (currentSection === 'introduction') {
          if (currentSection) sections[currentSection] = currentContent.trim();
          currentSection = 'body';
          currentContent = line;
        } else {
          currentContent += '\n' + line;
        }
      } else if (line.toLowerCase().includes('conclusion') || line.startsWith('## Conclusion')) {
        if (currentSection) sections[currentSection] = currentContent.trim();
        currentSection = 'conclusion';
        currentContent = '';
      } else if (line.toLowerCase().includes('sources') || line.toLowerCase().includes('references') || line.startsWith('## References')) {
        if (currentSection) sections[currentSection] = currentContent.trim();
        currentSection = 'sources';
        currentContent = '';
      } else {
        currentContent += '\n' + line;
      }
    }
    
    // Don't forget the last section
    if (currentSection) sections[currentSection] = currentContent.trim();
    
    return sections;
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
