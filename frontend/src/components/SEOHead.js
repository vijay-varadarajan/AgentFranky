import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEOHead = ({ 
  title = "Agent Franky - Frank Evidence-Based Research Reports",
  description = "Agent Franky provides frankly evidence-based research reports on any topic. Get comprehensive AI-powered research with multiple analyst perspectives, citations, and actionable insights in minutes.",
  keywords = "AI research assistant, evidence-based research, research reports, academic research, AI analysts, comprehensive research, Agent Franky, research automation, data analysis, scientific research",
  url = "https://agentfranky.com/",
  image = "/og-image.png",
  type = "website"
}) => {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://agentfranky.com/#website",
        "url": "https://agentfranky.com/",
        "name": "Agent Franky",
        "description": description,
        "potentialAction": [
          {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://agentfranky.com/?q={search_term_string}"
            },
            "query-input": "required name=search_term_string"
          }
        ],
        "inLanguage": "en-US"
      },
      {
        "@type": "Organization",
        "@id": "https://agentfranky.com/#organization",
        "name": "Agent Franky",
        "url": "https://agentfranky.com/",
        "logo": {
          "@type": "ImageObject",
          "inLanguage": "en-US",
          "@id": "https://agentfranky.com/#/schema/logo/image/",
          "url": "https://agentfranky.com/logo.png",
          "contentUrl": "https://agentfranky.com/logo.png",
          "width": 512,
          "height": 512,
          "caption": "Agent Franky"
        },
        "image": {
          "@id": "https://agentfranky.com/#/schema/logo/image/"
        },
        "sameAs": [
          "https://twitter.com/agentfranky",
          "https://github.com/vijay-varadarajan/researchagent-v0"
        ],
        "description": "AI-powered research assistant providing frankly evidence-based research reports."
      },
      {
        "@type": "WebPage",
        "@id": url + "#webpage",
        "url": url,
        "name": title,
        "isPartOf": {
          "@id": "https://agentfranky.com/#website"
        },
        "about": {
          "@id": "https://agentfranky.com/#organization"
        },
        "description": description,
        "inLanguage": "en-US"
      },
      {
        "@type": "SoftwareApplication",
        "name": "Agent Franky",
        "description": "AI-powered research assistant that provides frankly evidence-based research reports on any topic with multiple analyst perspectives and comprehensive citations.",
        "url": "https://agentfranky.com",
        "applicationCategory": "ProductivityApplication",
        "operatingSystem": "Web Browser",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "creator": {
          "@type": "Organization",
          "name": "Agent Franky Team"
        },
        "featureList": [
          "AI-powered research analysis",
          "Multi-analyst perspectives", 
          "Evidence-based reporting",
          "Comprehensive citations",
          "Real-time research generation",
          "PDF export functionality",
          "Customizable analyst teams"
        ],
        "screenshot": "https://agentfranky.com/screenshot.png",
        "softwareVersion": "1.0.0",
        "datePublished": "2025-08-15",
        "browserRequirements": "Requires JavaScript. Requires HTML5.",
        "permissions": "none",
        "storageRequirements": "1MB"
      }
    ]
  };

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`https://agentfranky.com${image}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Agent Franky" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`https://agentfranky.com${image}`} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default SEOHead;
