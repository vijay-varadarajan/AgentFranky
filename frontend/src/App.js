import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, User, Bot, Send, CheckCircle, Edit, AlertCircle, X, Download, Github } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
// import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas';
import { HelmetProvider } from 'react-helmet-async';
import API_BASE_URL from './config';
import SEOHead from './components/SEOHead';
import useWebSocket from './hooks/useWebSocket';
import MessageStatusIndicator from './components/MessageStatusIndicator';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [error, setError] = useState(null);
  const [selectedAnalyst, setSelectedAnalyst] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [showModifyButton, setShowModifyButton] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isUpdatingAnalysts, setIsUpdatingAnalysts] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState(null);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  const messagesEndRef = useRef(null);

  // WebSocket hook for real-time updates
  const { 
    isConnected, 
    statusUpdates, 
    currentStatus, 
    joinSession, 
    clearStatusUpdates 
  } = useWebSocket();

  // Update message content based on status updates
  useEffect(() => {
    if (currentStatus && messages.length > 0) {
      // Find the last assistant message to update
      const lastAssistantMessageIndex = messages.findIndex(
        (msg, index) => msg.type === 'assistant' && index === messages.length - 1
      );
      
      if (lastAssistantMessageIndex !== -1) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = { ...newMessages[lastAssistantMessageIndex] };
          
          // Update the message content with current status
          const stepName = formatStepName(currentStatus.step);
          lastMessage.currentStep = stepName;
          lastMessage.statusMessage = currentStatus.message;
          lastMessage.isLoading = true; // Keep loading state while processing
          
          newMessages[lastAssistantMessageIndex] = lastMessage;
          return newMessages;
        });
      }
    }
  }, [currentStatus]);

  // Handle research completion from WebSocket
  useEffect(() => {
    const completionUpdate = statusUpdates.find(update => update.step === 'RESEARCH_COMPLETED');
    if (completionUpdate && messages.length > 0) {
      // Find the last assistant message and finalize it
      const lastAssistantMessageIndex = messages.findIndex(
        (msg, index) => msg.type === 'assistant' && index === messages.length - 1
      );
      
      if (lastAssistantMessageIndex !== -1) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = { ...newMessages[lastAssistantMessageIndex] };
          
          // Clear loading state and status, add final report if available
          lastMessage.isLoading = false;
          lastMessage.currentStep = null;
          lastMessage.statusMessage = null;
          
          // Add final report content if available
          if (completionUpdate.final_report) {
            lastMessage.content = '🎉 Research completed successfully!';
            lastMessage.report = completionUpdate.final_report;
          }
          
          newMessages[lastAssistantMessageIndex] = lastMessage;
          return newMessages;
        });
        
        setIsLoading(false);
      }
    }
  }, [statusUpdates]);

  // Format step names for display
  const formatStepName = (step) => {
    if (!step) return 'Processing...';
    
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll when messages are added, not when they're updated
  useEffect(() => {
    // Only scroll if the number of messages increased (new message added)
    if (messages.length > prevMessageCount) {
      scrollToBottom();
    }
    setPrevMessageCount(messages.length);
  }, [messages.length, prevMessageCount]); // Only depend on length, not full messages array

  // Memoize the setSelectedAnalyst function to prevent unnecessary re-renders
  const handleAnalystSelect = useCallback((analyst) => {
    setSelectedAnalyst(analyst);
  }, []);

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
      
      // Clear previous status updates
      clearStatusUpdates();
      
      addMessage(topic, 'user');
      addMessage('🔍 Starting research on your topic...', 'assistant', { isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/api/research/start`, {
        topic: topic,
        max_analysts: 3
      });

      // Remove loading message
      setMessages(prev => prev.slice(0, -1));

      if (response.data.analysts) {
        const sessionData = {
          id: response.data.session_id,
          topic: topic,
          analysts: response.data.analysts,
          state: 'awaiting_approval'
        };
        
        setCurrentSession(sessionData);
        
        // Join the WebSocket session for real-time updates
        joinSession(response.data.session_id);

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

      // Add a message that will be updated with real-time status
      addMessage('✅ Team approved! Starting in-depth research...', 'assistant', { 
        isLoading: true,
        currentStep: 'Starting Research.',
        statusMessage: 'Beginning comprehensive analysis. Hold tight, this will take 2-3 mins...'
      });

      const response = await axios.post(`${API_BASE_URL}/api/research/approve`, {
        session_id: currentSession.id
      });

      // Note: The message will be updated by WebSocket events, 
      // so we don't remove the loading message here anymore
      // The completion will be handled by the WebSocket effect

    } catch (error) {
      console.error('Error approving analysts:', error);
      setMessages(prev => prev.slice(0, -1));
      setError('Failed to complete research. Please try again.');
      addMessage('❌ Sorry, there was an error completing the research. Please try again with a new topic.', 'assistant', { isError: true });
      setCurrentSession(null);
      setIsLoading(false);
    }
  };

  const modifyAnalysts = async (feedback) => {
    try {
      setIsLoading(true);
      setError(null);
      // Don't start animation here - only when we get response

      addMessage(`📝 Modifying analyst team based on your feedback: "${feedback}"`, 'assistant', { isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/api/research/modify`, {
        session_id: currentSession.id,
        feedback: feedback
      });

      // Remove loading message
      setMessages(prev => prev.slice(0, -1));

      if (response.data.analysts) {
        // Find the message that will be updated BEFORE starting animation
        const currentMessages = messages;
        const lastAnalystMessageIndex = currentMessages.findLastIndex(msg => 
          msg.type === 'assistant' && msg.analysts && msg.needsApproval
        );
        
        if (lastAnalystMessageIndex !== -1) {
          setUpdatingMessageId(currentMessages[lastAnalystMessageIndex].id);
        }
        
        // NOW start the animation since we have new analysts
        setIsUpdatingAnalysts(true);
        
        setCurrentSession(prev => ({
          ...prev,
          analysts: response.data.analysts
        }));

        // Wait for fade out animation to complete before updating
        setTimeout(() => {
          // Find and update the previous analyst team message instead of adding a new one
          setMessages(prev => {
            const newMessages = [...prev];
            
            // Find the last message that contains analysts (the previous team)
            const lastAnalystMessageIndex = newMessages.findLastIndex(msg => 
              msg.type === 'assistant' && msg.analysts && msg.needsApproval
            );
            
            if (lastAnalystMessageIndex !== -1) {
              // Update the existing analyst message with new team
              newMessages[lastAnalystMessageIndex] = {
                ...newMessages[lastAnalystMessageIndex],
                content: '🔄 I\'ve updated the analyst team based on your feedback:',
                analysts: response.data.analysts,
                needsApproval: true,
                isUpdated: true // Flag to trigger slide-in animation
              };
            } else {
              // Fallback: add new message if no previous analyst message found
              newMessages.push({
                id: Date.now(),
                content: '🔄 I\'ve updated the analyst team based on your feedback:',
                type: 'assistant',
                timestamp: new Date(),
                analysts: response.data.analysts,
                needsApproval: true,
                isUpdated: true
              });
            }
            
            return newMessages;
          });
          
          // End the updating state after a short delay
          setTimeout(() => {
            setIsUpdatingAnalysts(false);
            setUpdatingMessageId(null);
          }, 100);
          
          // Clear the isUpdated flag after animation completes
          setTimeout(() => {
            setMessages(prev => prev.map(msg => 
              msg.isUpdated ? { ...msg, isUpdated: false } : msg
            ));
          }, 600); // Match the animation duration
          
          // Reset approval state for new team
          setIsApproved(false);
          setShowModifyButton(true);
        }, 300); // Wait for fade out
      }
    } catch (error) {
      console.error('Error modifying analysts:', error);
      setMessages(prev => prev.slice(0, -1));
      setError('Failed to modify analysts. Please try again.');
      addMessage('❌ Sorry, there was an error modifying the analysts. Please try again.', 'assistant', { isError: true });
      setIsUpdatingAnalysts(false); // Reset animation state on error
      setUpdatingMessageId(null);
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
      let PDFConstructor;
      
      // Check if jsPDF is available globally (most common scenarios)
      if (typeof window !== 'undefined') {
        if (window.jsPDF) {
          PDFConstructor = window.jsPDF;
        } else if (window.jspdf && window.jspdf.jsPDF) {
          PDFConstructor = window.jspdf.jsPDF;
        }
      }
      
      // If not found globally, try dynamic import
      if (!PDFConstructor) {
        try {
          const jsPDFModule = await import('jspdf');
          PDFConstructor = jsPDFModule.jsPDF || jsPDFModule.default;
        } catch (importError) {
          throw new Error('jsPDF library not found. Please install jsPDF using: npm install jspdf');
        }
      }
      
      if (!PDFConstructor) {
        throw new Error('jsPDF constructor not available. Make sure jsPDF is properly loaded.');
      }
      
      // Create PDF with better formatting
      const pdf = new PDFConstructor({
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
    const lines = content.split('\n');
    
    // Find the title (first non-empty line)
    let titleFound = false;
    let currentSection = '';
    let currentContent = '';
    let introStarted = false;
    let bodyStarted = false;
    let conclusionStarted = false;
    let sourcesStarted = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines at the beginning
      if (!line && !titleFound) continue;
      
      // Get title (first non-empty line)
      if (!titleFound && line) {
        sections.title = line;
        titleFound = true;
        continue;
      }
      
      // Check for section headers
      if (line.toLowerCase() === 'introduction') {
        if (currentSection && currentContent.trim()) {
          sections[currentSection] = currentContent.trim();
        }
        currentSection = 'introduction';
        currentContent = '';
        introStarted = true;
        continue;
      }
      
      if (line.toLowerCase() === 'conclusion') {
        if (currentSection && currentContent.trim()) {
          sections[currentSection] = currentContent.trim();
        }
        currentSection = 'conclusion';
        currentContent = '';
        conclusionStarted = true;
        continue;
      }
      
      if (line.toLowerCase() === 'sources' || line.toLowerCase() === 'references') {
        if (currentSection && currentContent.trim()) {
          sections[currentSection] = currentContent.trim();
        }
        currentSection = 'sources';
        currentContent = '';
        sourcesStarted = true;
        continue;
      }
      
      // Handle content based on current state
      if (introStarted && !bodyStarted && !conclusionStarted && !sourcesStarted) {
        if (currentSection === 'introduction') {
          currentContent += (currentContent ? '\n' : '') + line;
        }
      } else if (introStarted && !conclusionStarted && !sourcesStarted) {
        // We're in the body section (between introduction and conclusion)
        if (currentSection !== 'body') {
          if (currentSection && currentContent.trim()) {
            sections[currentSection] = currentContent.trim();
          }
          currentSection = 'body';
          currentContent = '';
          bodyStarted = true;
        }
        currentContent += (currentContent ? '\n' : '') + line;
      } else if (conclusionStarted && !sourcesStarted) {
        if (currentSection === 'conclusion') {
          currentContent += (currentContent ? '\n' : '') + line;
        }
      } else if (sourcesStarted) {
        if (currentSection === 'sources') {
          currentContent += (currentContent ? '\n' : '') + line;
        }
      } else if (titleFound && !introStarted) {
        // This might be content before introduction section
        if (currentSection !== 'body') {
          currentSection = 'body';
          currentContent = '';
        }
        currentContent += (currentContent ? '\n' : '') + line;
      }
    }
    
    // Save the last section
    if (currentSection && currentContent.trim()) {
      sections[currentSection] = currentContent.trim();
    }
    
    // If no explicit sections found, treat everything after title as body
    if (!sections.introduction && !sections.conclusion && !sections.sources && sections.body) {
      const bodyContent = sections.body;
      const bodyLines = bodyContent.split('\n');
      
      // Try to identify sections within the body
      let tempIntro = '';
      // let tempBody = '';
      let tempConclusion = '';
      let tempSources = '';
      let currentTempSection = 'intro';
      
      for (const bodyLine of bodyLines) {
        const lowerLine = bodyLine.toLowerCase().trim();
        
        if (lowerLine.includes('conclusion') && bodyLine.trim().length < 50) {
          currentTempSection = 'conclusion';
          continue;
        }
        if (lowerLine.includes('sources') || lowerLine.includes('references')) {
          currentTempSection = 'sources';
          continue;
        }
        
        // Add content to appropriate section
        if (currentTempSection === 'intro') {
          tempIntro += (tempIntro ? '\n' : '') + bodyLine;
        } else if (currentTempSection === 'conclusion') {
          tempConclusion += (tempConclusion ? '\n' : '') + bodyLine;
        } else if (currentTempSection === 'sources') {
          tempSources += (tempSources ? '\n' : '') + bodyLine;
        }
      }
      
      // Split intro and body more intelligently
      const introLines = tempIntro.split('\n');
      let introEnd = Math.min(introLines.length, 3); // First few paragraphs as intro
      
      // Find a natural break point
      for (let i = 1; i < Math.min(introLines.length, 8); i++) {
        if (introLines[i].trim() === '' && introLines[i + 1] && introLines[i + 1].trim()) {
          introEnd = i;
          break;
        }
      }
      
      sections.introduction = introLines.slice(0, introEnd).join('\n').trim();
      sections.body = introLines.slice(introEnd).join('\n').trim();
      
      if (tempConclusion.trim()) {
        sections.conclusion = tempConclusion.trim();
      }
      if (tempSources.trim()) {
        sections.sources = tempSources.trim();
      }
    }
    
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

  const FeedbackModal = ({ isOpen, onClose, onSubmit }) => {
    const [localFeedbackText, setLocalFeedbackText] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (localFeedbackText.trim()) {
        onSubmit(localFeedbackText);
        setLocalFeedbackText('');
        onClose();
      }
    };

    const handleClose = () => {
      setLocalFeedbackText('');
      onClose();
    };

    if (!isOpen) return null;

    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">📝 Modify Analyst Team</h2>
            <button className="modal-close" onClick={handleClose}>
              <X size={20} color="red" strokeWidth={3} />
            </button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="feedback-form">
                <label htmlFor="feedback-input" className="feedback-label">
                  How would you like me to modify the analyst team?
                </label>
                <textarea
                  id="feedback-input"
                  value={localFeedbackText}
                  onChange={(e) => setLocalFeedbackText(e.target.value)}
                  placeholder="E.g., 'Add a cybersecurity expert', 'Replace the economist with a data scientist', 'Focus more on environmental aspects'..."
                  className="feedback-textarea"
                  rows={4}
                  required
                />
                <div className="feedback-buttons">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleClose}
                  >
                    Cancel <X size={20} color="red" strokeWidth={3} />
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!localFeedbackText.trim()}
                  >
                    <Edit size={16} />
                    Modify Team
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const AnalystsDisplay = React.memo(({ analysts, needsApproval, isUpdating = false, isUpdated = false, onAnalystSelect }) => {
    const [showCards, setShowCards] = useState(false);
    
    useEffect(() => {
      if (isUpdated) {
        // Trigger the slide-in animation for cards
        const timer = setTimeout(() => setShowCards(true), 100);
        return () => clearTimeout(timer);
      } else {
        setShowCards(true);
      }
    }, [isUpdated]);

    // Note: Removed the problematic setMessages call that was causing flickering
    // The isUpdated flag will be cleared by the parent component after animation

    return (
      <div className={`analysts-display ${isUpdating ? 'updating' : ''} ${isUpdated ? 'updated' : ''}`}>
        <h3><Bot size={20} /> AI Analyst Team</h3>
        <div className={`analysts-grid ${isUpdating ? 'updating' : ''}`}>
          {analysts.map((analyst, index) => (
            <div 
              key={`${analyst.name}-${index}`} // Use a more unique key to trigger re-render
              className="analyst-card"
              onClick={() => onAnalystSelect(analyst)}
              style={{
                animationDelay: isUpdated ? `${(index + 1) * 0.1}s` : '0s'
              }}
            >
              <h4>{analyst.name}</h4>
              <div className="role">{analyst.role}</div>
              <div className="affiliation">{analyst.affiliation}</div>
            </div>
          ))}
        </div>
        {needsApproval && (
          <div className={`approval-buttons ${isUpdated ? 'updated' : ''}`}>
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
                onClick={() => setShowFeedbackModal(true)}
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
  });

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

  // const LoadingIndicator = () => (
  //   <div className="loading">
  //     <span>Processing</span>
  //     <div className="loading-dots">
  //       <div className="loading-dot"></div>
  //       <div className="loading-dot"></div>
  //       <div className="loading-dot"></div>
  //     </div>
  //   </div>
  // );

  const WelcomeMessage = () => (
    <section className="welcome-message" role="main" aria-labelledby="main-heading">
      <header>
        <h1 id="main-heading">🔬 Welcome to Agent Franky</h1>
        <p className="hero-description">
          I provide frankly evidence-based research reports on any topic. 
          Simply enter your research topic below and I'll create a team of AI analysts 
          to conduct in-depth research and provide you with detailed, frank evidence-based insights.
        </p>
      </header>
      
      <section className="features-grid" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">Key Features</h2>
        <article className="feature-card">
          <h3>🎯 Targeted Analysis</h3>
          <p>I create specialized AI analysts for different aspects of your topic</p>
        </article>
        <article className="feature-card">
          <h3>📊 Frank Evidence-Based Reports</h3>
          <p>Get detailed reports with frank evidence-based analysis, conclusions, and sources</p>
        </article>
        <article className="feature-card">
          <h3>🔄 Customizable Teams</h3>
          <p>Review and modify the analyst team before research begins</p>
        </article>
      </section>
    </section>
  );

  return (
    <HelmetProvider>
      <div className="app">
        <SEOHead />
        
        <header className="header" role="banner">
          <div className="header-content">
            <h1>
              <Search size={24} aria-hidden="true" />
              <span>Agent Franky</span>
            </h1>
            <nav role="navigation" aria-label="External links">
              <a 
                href="https://github.com/vijay-varadarajan/researchagent-v0" 
                target="_blank" 
                rel="noopener noreferrer"
                className="github-link"
                aria-label="View Agent Franky source code on GitHub"
                title="View source code on GitHub"
              >
                <Github size={24} aria-hidden="true" />
                <span className="sr-only">GitHub Repository</span>
              </a>
            </nav>
          </div>
        </header>

        <main className="chat-container" role="main">{messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <section className="messages-container" aria-live="polite" aria-label="Research conversation">
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.type}`} role="group">
                <div className="message-avatar" aria-hidden="true">
                  {message.type === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="message-content">
                  {message.isLoading && <MessageStatusIndicator message={message} isConnected={isConnected} />}
                  {message.isError && (
                    <div className="error-message" role="alert">
                      <AlertCircle size={16} aria-hidden="true" />
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
                          isUpdating={isUpdatingAnalysts && message.id === updatingMessageId}
                          isUpdated={message.isUpdated}
                          onAnalystSelect={handleAnalystSelect}
                        />
                      )}
                      {message.report && <ReportDisplay report={message.report} />}
                    </>
                  )}
                </div>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </section>
        )}

        {error && (
          <div className="error-message" role="alert" aria-live="assertive">
            <AlertCircle size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Hide input section if awaiting approval */}
        {currentSession?.state !== 'awaiting_approval' && (
          <section className="input-section" aria-label="Research topic input">
            <form onSubmit={handleSubmit} className="input-container" role="search">
              <label htmlFor="research-input" className="sr-only">
                {currentSession?.state === 'awaiting_approval' 
                  ? "Provide feedback to modify the analyst team" 
                  : "Enter your research topic"}
              </label>
              <input
                id="research-input"
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
                aria-describedby="input-help"
              />
              <div id="input-help" className="sr-only">
                {currentSession?.state === 'awaiting_approval' 
                  ? "Enter feedback to modify the current analyst team based on your requirements"
                  : "Enter any research topic and Agent Franky will create a comprehensive evidence-based report"}
              </div>
              <button 
                type="submit" 
                className="send-button"
                disabled={isLoading || !inputValue.trim()}
                aria-label={currentSession?.state === 'awaiting_approval' ? 'Send feedback for analyst modification' : 'Start research on entered topic'}
              >
                <Send size={18} aria-hidden="true" />
                <span>{currentSession?.state === 'awaiting_approval' ? 'Send Feedback' : 'Start Research'}</span>
              </button>
            </form>
          </section>
        )}
      </main>

      {selectedAnalyst && (
        <AnalystModal 
          analyst={selectedAnalyst} 
          onClose={() => setSelectedAnalyst(null)} 
        />
      )}

      <FeedbackModal 
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={modifyAnalysts}
      />
      </div>
    </HelmetProvider>
  );
};

export default App;
