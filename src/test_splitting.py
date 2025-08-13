#!/usr/bin/env python3
"""
Test script to test the report splitting functionality
"""

import asyncio
from telegram_bot import TelegramResearchBot

def test_report_splitting():
    bot = TelegramResearchBot()
    
    # Create a long test report
    long_report = """# Test Research Report

## Introduction
This is a very long introduction that contains multiple sentences and paragraphs to test the splitting functionality of the telegram bot. """ + "This is additional content. " * 100 + """

## Section 1: First Topic
This section contains detailed information about the first topic. """ + "More detailed content here. " * 150 + """

## Section 2: Second Topic  
This section contains detailed information about the second topic. """ + "Even more detailed content here. " * 150 + """

## Conclusion
This is the conclusion of the research report. """ + "Final thoughts and summary. " * 50 + """

## Sources
[1] Source 1
[2] Source 2
[3] Source 3"""

    print(f"Test report length: {len(long_report)} characters")
    
    # Test the splitting function
    sections = bot._split_report_intelligently(long_report, 4000)
    
    print(f"Split into {len(sections)} sections:")
    for i, section in enumerate(sections, 1):
        print(f"Section {i}: {len(section)} characters")
        print(f"Preview: {section[:100]}...")
        print("---")

if __name__ == '__main__':
    test_report_splitting()
