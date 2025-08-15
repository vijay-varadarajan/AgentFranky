import os
import asyncio
import logging
from typing import Dict, Any
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
from dotenv import load_dotenv
from research_assistant import graph, graph_no_interrupt
from schema import ResearchGraphState

# Load environment variables
load_dotenv()

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Store user sessions
user_sessions: Dict[int, Dict[str, Any]] = {}

class TelegramResearchBot:
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        if not self.bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN not found in environment variables")
        
        # Initialize the application once during bot creation
        self.application = None

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Send a message when the command /start is issued."""
        welcome_text = """
🔬 Welcome to the AgentFranky!

I can help you create comprehensive research reports on any topic.

**How it works:**
1. Send me a research topic (e.g., "Artificial Intelligence in Healthcare")
2. I'll create a team of AI analysts for different aspects
3. You can approve or modify the analyst team
4. I'll conduct in-depth research and create a detailed report

**Commands:**
/start - Show this welcome message
/new - Start a new research project
/help - Get help

Send me a topic to begin!
        """
        await update.message.reply_text(welcome_text, parse_mode='Markdown')

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Send a message when the command /help is issued."""
        help_text = """
**How to use the Research Assistant:**

1. **Start Research**: Send any message with your research topic
   Example: "Climate change impacts on agriculture"

2. **Review Analysts**: I'll show you the AI analyst team I've created
   - You can approve by clicking "Approve"
   - Or provide feedback to modify the team

3. **Get Results**: Once approved, I'll conduct research and send you a comprehensive report

**Tips:**
- Be specific with your topics for better results
- You can research any academic, business, or general topic
- Reports include sources and citations
- Each report takes 2-3 minutes to complete

**Commands:**
/new - Start a fresh research project
/start - Show welcome message
        """
        await update.message.reply_text(help_text, parse_mode='Markdown')

    async def new_research(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Start a new research project."""
        user_id = update.effective_user.id
        if user_id in user_sessions:
            del user_sessions[user_id]
        
        await update.message.reply_text(
            "🆕 Starting a new research project!\n\n"
            "Please send me your research topic. For example:\n"
            "• 'Machine Learning in Drug Discovery'\n"
            "• 'Sustainable Energy Solutions'\n"
            "• 'Future of Remote Work'\n\n"
            "What would you like to research?"
        )

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle incoming messages."""
        user_id = update.effective_user.id
        message_text = update.message.text

        # Check if user has an active session
        if user_id not in user_sessions:
            # Start new research with the message as topic
            await self.start_research(update, message_text)
        else:
            session = user_sessions[user_id]
            if session.get('waiting_for_feedback'):
                # User is providing feedback on analysts
                await self.handle_analyst_feedback(update, message_text)
            else:
                # Start new research with the message as topic
                await self.start_research(update, message_text)

    async def start_research(self, update: Update, topic: str) -> None:
        """Start the research process."""
        user_id = update.effective_user.id
        
        # Initialize user session
        user_sessions[user_id] = {
            'topic': topic,
            'state': 'creating_analysts',
            'waiting_for_feedback': False
        }

        # Send initial message
        await update.message.reply_text(
            f"🔍 Starting research on: **{topic}**\n\n"
            "Creating AI analyst team... This may take a moment.",
            parse_mode='Markdown'
        )

        try:
            # Create initial state
            initial_state = {
                'topic': topic,
                'max_analysts': 3,  # Limit to 3 for Telegram
                'human_analyst_feedback': ''
            }

            # Run the graph until human feedback is needed
            result = await asyncio.to_thread(
                lambda: graph.invoke(initial_state, {"recursion_limit": 10})
            )

            # Store the state and analysts
            user_sessions[user_id]['graph_state'] = result
            user_sessions[user_id]['waiting_for_feedback'] = True

            # Show analysts to user
            await self.show_analysts(update, result['analysts'])

        except Exception as e:
            logger.error(f"Error starting research: {e}")
            await update.message.reply_text(
                "❌ Sorry, there was an error starting the research. Please try again with /new"
            )
            if user_id in user_sessions:
                del user_sessions[user_id]

    async def show_analysts(self, update: Update, analysts) -> None:
        """Show the generated analysts to the user."""
        analysts_text = "👥 **AI Analyst Team Created:**\n\n"
        
        for i, analyst in enumerate(analysts, 1):
            analysts_text += f"**{i}. {analyst.name}**\n"
            analysts_text += f"Role: {analyst.role}\n"
            analysts_text += f"Affiliation: {analyst.affiliation}\n"
            analysts_text += f"Focus: {analyst.description}\n\n"

        analysts_text += "Do you approve this team, or would you like me to modify it?"

        # Create inline keyboard
        keyboard = [
            [InlineKeyboardButton("✅ Approve Team", callback_data="approve")],
            [InlineKeyboardButton("🔄 Modify Team", callback_data="modify")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            analysts_text, 
            parse_mode='Markdown',
            reply_markup=reply_markup
        )

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle callback queries from inline keyboards."""
        query = update.callback_query
        await query.answer()

        user_id = query.from_user.id
        
        if user_id not in user_sessions:
            await query.edit_message_text("❌ Session expired. Please start a new research with /new")
            return

        if query.data == "approve":
            await self.approve_analysts(query)
        elif query.data == "modify":
            await self.request_modification(query)

    async def approve_analysts(self, query) -> None:
        """User approved the analysts, continue with research."""
        user_id = query.from_user.id
        session = user_sessions[user_id]

        await query.edit_message_text(
            "✅ **Team Approved!**\n\n"
            "🔬 Starting in-depth research...\n"
            "📝 Conducting expert interviews...\n"
            "📊 Analyzing findings...\n\n"
            "This will take 2-3 minutes. I'll send you the complete report when ready!",
            parse_mode='Markdown'
        )

        try:
            # Use the approved analysts to run the full graph
            analysts = session['graph_state']['analysts']
            topic = session['graph_state']['topic']
            
            logger.info(f"Running full research with approved analysts")
            logger.info(f"Topic: {topic}")
            logger.info(f"Number of analysts: {len(analysts)}")

            # Create state for the no-interrupt graph
            research_state = {
                'topic': topic,
                'max_analysts': len(analysts),
                'analysts': analysts,
                'human_analyst_feedback': 'approve'
            }

            # Run the complete research process
            loop = asyncio.get_event_loop()
            final_result = await loop.run_in_executor(
                None,
                lambda: graph_no_interrupt.invoke(research_state, {"recursion_limit": 100})
            )
            
            print(f"[DEBUG] Final result keys: {final_result.keys()}")
            print(f"[DEBUG] Sections available: {len(final_result.get('sections', []))}")
            if 'sections' in final_result:
                print(f"[DEBUG] Section types: {[type(s) for s in final_result['sections']]}")
            
            # Check if final_report exists and construct it properly
            final_report = None
            if 'final_report' in final_result and final_result['final_report']:
                final_report = final_result['final_report']
                print("[DEBUG] Using final_report from result")
            else:
                print("[DEBUG] final_report not found, constructing from available parts...")
                print(f"[DEBUG] Available keys: {list(final_result.keys())}")
                
                # Try to construct report from available parts
                report_parts = []
                if 'introduction' in final_result and final_result['introduction']:
                    report_parts.append(final_result['introduction'])
                    print("[DEBUG] Added introduction")
                if 'content' in final_result and final_result['content']:
                    report_parts.append(final_result['content'])
                    print("[DEBUG] Added content")
                if 'conclusion' in final_result and final_result['conclusion']:
                    report_parts.append(final_result['conclusion'])
                    print("[DEBUG] Added conclusion")
                
                if report_parts:
                    final_report = "\n\n---\n\n".join(report_parts)
                    print(f"[DEBUG] Constructed report from {len(report_parts)} parts")
                else:
                    # Fallback: use sections if available
                    sections = final_result.get('sections', [])
                    print(f"[DEBUG] Checking sections: {len(sections)} found")
                    if sections:
                        # Convert sections to strings and join them
                        section_strings = []
                        for i, section in enumerate(sections):
                            if hasattr(section, 'content'):
                                section_strings.append(section.content)
                            elif isinstance(section, str):
                                section_strings.append(section)
                            else:
                                section_strings.append(str(section))
                            print(f"[DEBUG] Section {i+1}: {len(section_strings[-1])} chars")
                        
                        if section_strings:
                            final_report = "\n\n".join(section_strings)
                            print(f"[DEBUG] Constructed report from {len(sections)} sections")
                        else:
                            print("[DEBUG] Sections exist but couldn't extract content")
                            raise Exception("Sections found but content extraction failed")
                    else:
                        print("[DEBUG] No sections found either")
                        raise Exception("No report content generated - no final_report, parts, or sections found")

            if not final_report:
                raise Exception("Final report is empty or None")

            print(f"[DEBUG] Report length: {len(final_report)}")

            # Send the final report
            await self.send_report(query, final_report)

        except Exception as e:
            logger.error(f"Error completing research: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            await query.message.reply_text(
                f"❌ Sorry, there was an error completing the research: {str(e)}\n\nPlease try again with /new"
            )
        finally:
            # Clean up session
            if user_id in user_sessions:
                del user_sessions[user_id]

    async def request_modification(self, query) -> None:
        """Request user feedback for modifying analysts."""
        user_id = query.from_user.id
        
        await query.edit_message_text(
            "🔄 **Modify Analyst Team**\n\n"
            "Please describe how you'd like me to modify the analyst team. For example:\n"
            "• 'Focus more on economic impacts'\n"
            "• 'Add a technical expert'\n"
            "• 'Include environmental perspective'\n\n"
            "Send your feedback as a message:",
            parse_mode='Markdown'
        )

    async def handle_analyst_feedback(self, update: Update, feedback: str) -> None:
        """Handle user feedback for analyst modification."""
        user_id = update.effective_user.id
        session = user_sessions[user_id]

        await update.message.reply_text(
            f"📝 **Feedback received:** {feedback}\n\n"
            "Creating modified analyst team...",
            parse_mode='Markdown'
        )

        try:
            # Update state with feedback and regenerate analysts
            current_state = session['graph_state']
            current_state['human_analyst_feedback'] = feedback

            # Run graph to regenerate analysts
            result = await asyncio.to_thread(
                lambda: graph.invoke(current_state, {"recursion_limit": 10})
            )

            # Update session and show new analysts
            user_sessions[user_id]['graph_state'] = result
            await self.show_analysts(update, result['analysts'])

        except Exception as e:
            logger.error(f"Error modifying analysts: {e}")
            await update.message.reply_text(
                "❌ Sorry, there was an error modifying the analysts. Please try again with /new"
            )

    async def send_report(self, query, report: str) -> None:
        """Send the final report to the user."""
        if not report or report.strip() == "":
            await query.message.reply_text(
                "❌ The generated report is empty. Please try again with /new"
            )
            return
            
        max_length = 4000
        print(f"[DEBUG] Report length: {len(report)} chars")
        
        if len(report) <= max_length:
            # Send as single message
            try:
                logger.info("Sending report as single message")
                await query.message.reply_text(
                    f"📋 **Research Report Complete!**\n\n{report}",
                    parse_mode='Markdown'
                )
            except Exception as e:
                # Fallback without markdown if there are parsing issues
                logger.error(f"Error sending with markdown: {e}")
                await query.message.reply_text(
                    f"📋 Research Report Complete!\n\n{report}"
                )
        else:
            # Split into multiple messages
            logger.info(f"Splitting long report ({len(report)} chars) into multiple messages")
            
            # First, send the header message
            await query.message.reply_text(
                "📋 **Research Report Complete!**\n\nSending in multiple parts due to length...",
                parse_mode='Markdown'
            )
            
            # Split the report into logical sections if possible
            sections = self._split_report_intelligently(report, max_length)
            logger.info(f"Split report into {len(sections)} sections")
            
            for i, section in enumerate(sections, 1):
                try:
                    # Add part indicator
                    part_header = f"**Part {i}/{len(sections)}:**\n\n"
                    message_content = part_header + section
                    
                    logger.info(f"Sending part {i}/{len(sections)} ({len(message_content)} chars)")
                    
                    await query.message.reply_text(
                        message_content,
                        parse_mode='Markdown'
                    )
                    
                    logger.info(f"Successfully sent part {i}/{len(sections)}")
                    
                    # Small delay between messages to avoid rate limiting
                    await asyncio.sleep(1.0)
                    
                except Exception as e:
                    # Fallback without markdown
                    logger.error(f"Error sending part {i} with markdown: {e}")
                    try:
                        await query.message.reply_text(
                            f"Part {i}/{len(sections)}:\n\n{section}"
                        )
                        logger.info(f"Successfully sent part {i}/{len(sections)} (no markdown)")
                    except Exception as e2:
                        logger.error(f"Failed to send part {i} even without markdown: {e2}")
                    await asyncio.sleep(1.0)

    def _split_report_intelligently(self, report: str, max_length: int) -> list:
        """Split report into chunks, trying to preserve logical sections."""
        # Account for part header overhead (about 50 chars)
        effective_max = max_length - 100
        
        # Try to split on section boundaries first
        sections = []
        
        # Look for markdown headers as natural break points
        import re
        header_pattern = r'\n(#{1,3}\s+.*?)\n'
        parts = re.split(header_pattern, report)
        
        current_chunk = ""
        
        for part in parts:
            # If adding this part would exceed the limit
            if len(current_chunk + part) > effective_max and current_chunk:
                # Save current chunk and start new one
                sections.append(current_chunk.strip())
                current_chunk = part
            else:
                current_chunk += part
        
        # Add the last chunk
        if current_chunk:
            sections.append(current_chunk.strip())
        
        # If no good section breaks found, split by length
        if len(sections) == 1 and len(sections[0]) > effective_max:
            sections = self._split_by_length(sections[0], effective_max)
        
        # Ensure no section is too long
        final_sections = []
        for section in sections:
            if len(section) > effective_max:
                final_sections.extend(self._split_by_length(section, effective_max))
            else:
                final_sections.append(section)
        
        return final_sections

    def _split_by_length(self, text: str, max_length: int) -> list:
        """Split text by length, trying to break at sentence boundaries."""
        chunks = []
        current_chunk = ""
        
        # Split by sentences
        sentences = text.split('. ')
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # Add period back if it was removed by split (except for last sentence)
            if not sentence.endswith('.') and not sentence.endswith('!') and not sentence.endswith('?'):
                sentence += '.'
            
            # If adding this sentence would exceed the limit
            if len(current_chunk + ' ' + sentence) > max_length and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                if current_chunk:
                    current_chunk += ' ' + sentence
                else:
                    current_chunk = sentence
        
        # Add the last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks

    def run(self):
        """Run the bot."""
        # Create application
        self.application = Application.builder().token(self.bot_token).build()

        # Add handlers
        self.application.add_handler(CommandHandler("start", self.start))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("new", self.new_research))
        self.application.add_handler(CallbackQueryHandler(self.handle_callback))
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

        # Run the bot
        print("🤖 Bot starting...")
        
        # Check if running on Render or in production
        if os.getenv('RENDER') or os.getenv('RAILWAY') or os.getenv('HEROKU') or os.getenv('PORT'):
            print("🌐 Running in production mode with webhook...")
            # For production, we'll use webhook mode instead of polling
            self.run_webhook()
        else:
            print("🔄 Running in polling mode...")
            self.application.run_polling()
    
    def run_webhook(self):
        """Run bot with webhook for production deployment."""
        from flask import Flask, request
        import json
        import asyncio
        
        # Create a simple Flask app to receive webhooks
        app = Flask(__name__)
        
        @app.route('/webhook', methods=['POST'])
        def webhook():
            """Handle incoming webhook from Telegram."""
            try:
                print(f"[DEBUG] Webhook called: {request.method}")
                
                update_dict = request.get_json()
                if not update_dict:
                    print("[DEBUG] No update data received")
                    return 'NO_DATA', 400
                
                print(f"[DEBUG] Processing update: {update_dict.get('update_id', 'unknown')}")
                update = Update.de_json(update_dict, self.application.bot)
                
                # Instead of asyncio.run(...) — schedule on existing loop
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                
                loop.create_task(self.application.process_update(update))
                print("[DEBUG] Update scheduled successfully")
                
                return 'OK', 200
                
            except Exception as e:
                print(f"[DEBUG] Webhook error: {e}")
                import traceback
                print(f"[DEBUG] Webhook traceback: {traceback.format_exc()}")
                return 'ERROR', 500


        @app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint for Render."""
            return {'status': 'healthy', 'service': 'telegram-bot'}, 200
        
        @app.route('/', methods=['GET'])
        def home():
            """Home endpoint."""
            return {'message': 'Agent Franky Telegram Bot is running!', 'status': 'active'}, 200
        
        @app.route('/debug', methods=['GET'])
        def debug():
            """Debug endpoint to check webhook status."""
            return {
                'webhook_url': os.getenv('WEBHOOK_URL'),
                'port': os.getenv('PORT'),
                'render_service': os.getenv('RENDER_SERVICE_NAME'),
                'bot_initialized': self.application is not None,
                'status': 'webhook_mode'
            }, 200
        
        # Set up webhook with proper initialization
        print("🔧 Initializing application...")
        
        async def setup_webhook_and_app():
            try:
                # Initialize the application properly
                await self.application.initialize()
                print("✅ Application initialized successfully")
                
                # Set up webhook
                webhook_url = os.getenv('WEBHOOK_URL')
                if not webhook_url:
                    render_service_name = os.getenv('RENDER_SERVICE_NAME', 'agentfranky')
                    webhook_url = f"https://{render_service_name}.onrender.com/webhook"
                    print(f"🔗 Using constructed webhook URL: {webhook_url}")
                else:
                    print(f"🔗 Using provided webhook URL: {webhook_url}")
                
                print("🗑️ Removing existing webhook...")
                await self.application.bot.delete_webhook(drop_pending_updates=True)
                await asyncio.sleep(2)
                
                print("🔗 Setting new webhook...")
                result = await self.application.bot.set_webhook(url=webhook_url)
                if result:
                    print("✅ Webhook set successfully")
                else:
                    print("❌ Failed to set webhook")
                    
                # Verify webhook
                webhook_info = await self.application.bot.get_webhook_info()
                print(f"📋 Webhook info: {webhook_info.url}")
                print(f"📊 Pending updates: {webhook_info.pending_update_count}")
                
            except Exception as e:
                logger.error(f"Error setting up webhook: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
        
        # Run webhook setup
        print("🚀 Setting up webhook...")
        asyncio.run(setup_webhook_and_app())
        
        # Get port from environment (Render sets this)
        port = int(os.getenv('PORT', 5000))
        print(f"🚀 Starting Flask server on port {port}")
        
        # Run Flask app
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)

if __name__ == '__main__':
    bot = TelegramResearchBot()
    bot.run()