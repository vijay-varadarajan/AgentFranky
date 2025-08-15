#!/usr/bin/env python3
"""
Render deployment script for Telegram research bot
"""

import sys
import os
import asyncio
from telegram_bot import TelegramResearchBot

def main():
    print("🔬 Agent Franky Telegram Bot - Render Deployment")
    print("=" * 50)
    
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
        print("\nPlease check your environment variables in Render dashboard")
        sys.exit(1)
    
    print("✅ Environment variables loaded")
    
    # Set environment flag for Render
    os.environ['RENDER'] = 'true'
    
    # Get webhook URL from environment or construct it
    if not os.getenv('WEBHOOK_URL'):
        render_service_name = os.getenv('RENDER_SERVICE_NAME', 'agentfranky')
        webhook_url = f"https://{render_service_name}.onrender.com/webhook"
        os.environ['WEBHOOK_URL'] = webhook_url
        print(f"🔗 Using constructed webhook URL: {webhook_url}")
    else:
        print(f"🔗 Using provided webhook URL: {os.getenv('WEBHOOK_URL')}")
    
    print("🚀 Starting bot in webhook mode...")
    
    try:
        bot = TelegramResearchBot()
        bot.run_webhook()
    except KeyboardInterrupt:
        print("\n👋 Bot stopped by user")
    except Exception as e:
        print(f"❌ Error running bot: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
