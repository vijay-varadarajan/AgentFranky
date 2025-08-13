import os
import asyncio
import logging
from typing import Dict, Any
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
from dotenv import load_dotenv
from research_assistant import graph
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

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Send a message when the command /start is issued."""
        welcome_text = """
🔬 Welcome to the AI Research Assistant!

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
        await update.message.reply_text(welcome_text)

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
        await update.message.reply_text(help_text)

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
            # Continue the graph with approval
            current_state = session['graph_state']
            current_state['human_analyst_feedback'] = 'approve'
            
            logger.info(f"Continuing graph with approval and current state: {current_state}")

            # Run the rest of the graph
            # final_result = await asyncio.to_thread(
            #     lambda: graph.invoke(current_state, {"recursion_limit": 50})
            # )

            # Run the rest of the graph with higher recursion limit
            loop = asyncio.get_event_loop()
            final_result = await loop.run_in_executor(
                None,
                lambda: graph.invoke(current_state, {"recursion_limit": 100})
            )
            
            print(f"[DEBUG] Final result keys: {final_result.keys()}")
            
            # Check if final_report exists
            if 'final_report' not in final_result:
                print("[DEBUG] final_report not found, checking other keys...")
                print(f"[DEBUG] Available keys: {list(final_result.keys())}")
                
                # Try to construct report from available parts
                report_parts = []
                if 'introduction' in final_result:
                    report_parts.append(final_result['introduction'])
                if 'content' in final_result:
                    report_parts.append(final_result['content'])
                if 'conclusion' in final_result:
                    report_parts.append(final_result['conclusion'])
                
                if report_parts:
                    final_report = "\n\n---\n\n".join(report_parts)
                else:
                    # Fallback: use sections if available
                    sections = final_result.get('sections', [])
                    if sections:
                        final_report = "\n\n".join(sections)
                    else:
                        raise Exception("No report content generated")
            else:
                final_report = final_result['final_report']

            print(f"[DEBUG] Report length: {len(final_report)}")


            # Send the final report
            await self.send_report(query, final_result['final_report'])

        except Exception as e:
            logger.error(f"Error completing research: {e}")
            await query.message.reply_text(
                "❌ Sorry, there was an error completing the research. Please try again with /new"
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
        # Split report if it's too long for Telegram (4096 char limit)
        max_length = 4000
        print(report[:10])
        report = report[:max_length-1]

        if len(report) <= max_length:
            logger.info("Sending report")
            await query.message.reply_text(
                f"📋 **Research Report Complete!**\n\n{report}"
            )
        else:
            # Split the report into chunks
            await query.message.reply_text(
                "📋 **Research Report Complete!**\n\nSending in multiple parts due to length...",
                parse_mode='Markdown'
            )
            
            chunks = [report[i:i+max_length] for i in range(0, len(report), max_length)]
            
            for i, chunk in enumerate(chunks, 1):
                await query.message.reply_text(
                    f"**Part {i}/{len(chunks)}:**\n\n{chunk}",
                    parse_mode='Markdown'
                )

    def run(self):
        """Run the bot."""
        # Create application
        application = Application.builder().token(self.bot_token).build()

        # Add handlers
        application.add_handler(CommandHandler("start", self.start))
        application.add_handler(CommandHandler("help", self.help_command))
        application.add_handler(CommandHandler("new", self.new_research))
        application.add_handler(CallbackQueryHandler(self.handle_callback))
        application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

        # Run the bot
        print("🤖 Bot starting...")
        application.run_polling()

if __name__ == '__main__':
    bot = TelegramResearchBot()
    bot.run()