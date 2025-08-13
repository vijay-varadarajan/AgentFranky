#!/usr/bin/env python3
"""
Simple script to run the Telegram research bot
"""

import sys
import os
from telegram_bot import TelegramResearchBot

def main():
    print("🔬 AI Research Assistant Telegram Bot")
    print("=" * 40)
    
    # Check environment variables
    required_vars = [
        'TELEGRAM_BOT_TOKEN',
        'GOOGLE_API_KEY', 
        'TAVILY_API_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("❌ Missing environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nPlease check your .env file")
        sys.exit(1)
    
    print("✅ Environment variables loaded")
    print("🚀 Starting bot...")
    
    try:
        bot = TelegramResearchBot()
        bot.run()
    except KeyboardInterrupt:
        print("\n👋 Bot stopped by user")
    except Exception as e:
        print(f"❌ Error running bot: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()