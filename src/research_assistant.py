from langchain_google_genai import ChatGoogleGenerativeAI
import json
from typing import Optional, Dict, Any, Callable

from dotenv import load_dotenv
load_dotenv()

# Status update mechanism
class StatusUpdater:
    """Class to handle sending status updates to the frontend"""
    
    def __init__(self, callback: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        self.callback = callback
    
    def update(self, step: str, step_number: int, additional_info: Dict[str, Any] = None):
        """Send a status update to the frontend and print to console"""
        message = f"{step_number}. STEP [{step}]"
        print(message)  # Still print to console for debugging
        
        # Create status update object
        status = {
            "step": step,
            "step_number": step_number,
            "message": message
        }
        
        # Add any additional info
        if additional_info:
            status.update(additional_info)
            
        # Send to frontend if callback is provided
        if self.callback:
            self.callback(message, status)

# Default status updater that just prints
status_updater = StatusUpdater()

# Set this function to connect the status updater to your frontend
def set_status_callback(callback: Callable[[str, Dict[str, Any]], None]):
    """Set the callback function that will receive status updates"""
    global status_updater
    status_updater = StatusUpdater(callback)

llm = ChatGoogleGenerativeAI(
    model = 'gemini-2.5-flash',
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=10,
)

import operator
from pydantic import BaseModel, Field
from typing import Annotated, List
from typing_extensions import TypedDict

from langchain_community.document_loaders import WikipediaLoader
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, get_buffer_string

from langgraph.constants import Send
from langgraph.graph import END, MessagesState, START, StateGraph

from schema import *

### Nodes and edges

analyst_instructions="""You are tasked with creating a set of AI analyst personas. Follow these instructions carefully:

1. First, review the research topic:
{topic}
        
2. Examine any editorial feedback that has been optionally provided to guide creation of the analysts: 
        
{human_analyst_feedback}
    
3. Determine the most interesting themes based upon documents and / or feedback above.
                    
4. Pick the top {max_analysts} themes.

5. Assign one analyst to each theme."""

def create_analysts(state: GenerateAnalystsState):
    status_updater.update("CREATE_ANALYSTS", 1)
    
    """ Create analysts """
    
    topic=state['topic']
    max_analysts=state['max_analysts']
    human_analyst_feedback=state.get('human_analyst_feedback', '')
        
    # Enforce structured output
    structured_llm = llm.with_structured_output(Perspectives)

    # System message
    system_message = analyst_instructions.format(topic=topic,
                                                            human_analyst_feedback=human_analyst_feedback, 
                                                            max_analysts=max_analysts)

    # Generate question 
    analysts = structured_llm.invoke([SystemMessage(content=system_message)]+[HumanMessage(content="Generate the set of analysts.")])
    
    # Write the list of analysis to state
    return {"analysts": analysts.analysts}

def human_feedback(state: GenerateAnalystsState):
    status_updater.update("HUMAN_FEEDBACK", 2)
    
    """ No-op node that should be interrupted on """
    # Check if we have human feedback
    human_feedback = state.get('human_analyst_feedback', '')
    if human_feedback.lower() == 'approve':
        status_updater.update("HUMAN_FEEDBACK", 2, {"detail": "Approved, continuing..."})
        return state
    elif human_feedback and human_feedback.lower() != 'approve':
        status_updater.update("HUMAN_FEEDBACK", 2, {"detail": f"Feedback: {human_feedback}, regenerating analysts..."})
        return state
    else:
        status_updater.update("HUMAN_FEEDBACK", 2, {"detail": "Waiting for human feedback..."})
        # This should trigger the interrupt
        return state

# Generate analyst question
question_instructions = """You are an analyst tasked with interviewing an expert to learn about a specific topic. 

Your goal is boil down to interesting and specific insights related to your topic.

1. Interesting: Insights that people will find surprising or non-obvious.
        
2. Specific: Insights that avoid generalities and include specific examples from the expert.

Here is your topic of focus and set of goals: {goals}
        
Begin by introducing yourself using a name that fits your persona, and then ask your question.

Continue to ask questions to drill down and refine your understanding of the topic.
        
When you are satisfied with your understanding, complete the interview with: "Thank you so much for your help!"

Remember to stay in character throughout your response, reflecting the persona and goals provided to you."""

def generate_question(state: InterviewState):
    status_updater.update("GENERATE_QUESTION", 3)
    
    """ Node to generate a question """

    # Get state
    analyst = state["analyst"]
    messages = state["messages"]

    # Generate question 
    system_message = question_instructions.format(goals=analyst.persona)
    question = llm.invoke([SystemMessage(content=system_message)]+messages)
        
    # Write messages to state
    return {"messages": [question]}

# Search query writing
search_instructions = SystemMessage(content=f"""You will be given a conversation between an analyst and an expert. 

Your goal is to generate a well-structured query for use in retrieval and / or web-search related to the conversation.
        
First, analyze the full conversation.

Pay particular attention to the final question posed by the analyst.

Convert this final question into a well-structured web search query""")

def search_web(state: InterviewState):
    status_updater.update("SEARCH_WEB", 4)
    
    """ Retrieve docs from web search """

    # Search
    tavily_search = TavilySearchResults(max_results=3)

    # Search query
    structured_llm = llm.with_structured_output(SearchQuery)
    search_query = structured_llm.invoke([search_instructions]+state['messages'])
    
    # Search
    search_docs = tavily_search.invoke(search_query.search_query)

     # Format
    formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document href="{doc["url"]}"/>\n{doc["content"]}\n</Document>'
            for doc in search_docs
        ]
    )

    return {"context": [formatted_search_docs]} 

def search_wikipedia(state: InterviewState):
    status_updater.update("SEARCH_WIKIPEDIA", 5)
    
    """ Retrieve docs from wikipedia """

    # Search query
    structured_llm = llm.with_structured_output(SearchQuery)
    search_query = structured_llm.invoke([search_instructions]+state['messages'])
    
    # Search
    search_docs = WikipediaLoader(query=search_query.search_query, 
                                  load_max_docs=2).load()

     # Format
    formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document source="{doc.metadata["source"]}" page="{doc.metadata.get("page", "")}"/>\n{doc.page_content}\n</Document>'
            for doc in search_docs
        ]
    )

    return {"context": [formatted_search_docs]} 

# Generate expert answer
answer_instructions = """You are an expert being interviewed by an analyst.

Here is analyst area of focus: {goals}. 
        
You goal is to answer a question posed by the interviewer.

To answer question, use this context:
        
{context}

When answering questions, follow these guidelines:
        
1. Use only the information provided in the context. 
        
2. Do not introduce external information or make assumptions beyond what is explicitly stated in the context.

3. The context contain sources at the topic of each individual document.

4. Include these sources your answer next to any relevant statements. For example, for source # 1 use [1]. 

5. List your sources in order at the bottom of your answer. [1] Source 1, [2] Source 2, etc
        
6. If the source is: <Document source="assistant/docs/llama3_1.pdf" page="7"/>' then just list: 
        
[1] assistant/docs/llama3_1.pdf, page 7 
        
And skip the addition of the brackets as well as the Document source preamble in your citation."""

def generate_answer(state: InterviewState):
    status_updater.update("GENERATE_ANSWER", 6)
    
    """ Node to answer a question """

    # Get state
    analyst = state["analyst"]
    messages = state["messages"]
    context = state["context"]

    # Answer question
    system_message = answer_instructions.format(goals=analyst.persona, context=context)
    answer = llm.invoke([SystemMessage(content=system_message)]+messages)
            
    # Name the message as coming from the expert
    answer.name = "expert"
    
    # Append it to state
    return {"messages": [answer]}

def save_interview(state: InterviewState):
    status_updater.update("SAVE_INTERVIEW", 7)
    
    """ Save interviews """

    # Get messages
    messages = state["messages"]
    
    # Convert interview to a string
    interview = get_buffer_string(messages)
    
    # Save to interviews key
    return {"interview": interview}

def route_messages(state: InterviewState, 
                   name: str = "expert"):
    status_updater.update("ROUTE_MESSAGES", 8)
    
    """ Route between question and answer """
    
    # Get messages
    messages = state["messages"]
    max_num_turns = state.get('max_num_turns',2)

    # Check the number of expert answers 
    num_responses = len(
        [m for m in messages if isinstance(m, AIMessage) and m.name == name]
    )

    # End if expert has answered more than the max turns
    if num_responses >= max_num_turns:
        status_updater.update("ROUTE_MESSAGES", 8, {"decision": "save_interview"})
        return 'save_interview'

    # This router is run after each question - answer pair 
    # Get the last question asked to check if it signals the end of discussion
    last_question = messages[-2]
    
    if "Thank you so much for your help" in last_question.content:
        status_updater.update("ROUTE_MESSAGES", 8, {"decision": "save_interview"})
        return 'save_interview'
    status_updater.update("ROUTE_MESSAGES", 8, {"decision": "ask_question"})
    return "ask_question"

# Write a summary (section of the final report) of the interview
section_writer_instructions = """You are an expert technical writer. 
            
Your task is to create a short, easily digestible section of a report based on a set of source documents.

1. Analyze the content of the source documents: 
- The name of each source document is at the start of the document, with the <Document tag.
        
2. Create a report structure using markdown formatting:
- Use ## for the section title
- Use ### for sub-section headers
        
3. Write the report following this structure:
a. Title (## header)
b. Summary (### header)
c. Sources (### header)

4. Make your title engaging based upon the focus area of the analyst: 
{focus}

5. For the summary section:
- Set up summary with general background / context related to the focus area of the analyst
- Emphasize what is novel, interesting, or surprising about insights gathered from the interview
- Create a numbered list of source documents, as you use them
- Do not mention the names of interviewers or experts
- Aim for approximately 400 words maximum
- Use numbered sources in your report (e.g., [1], [2]) based on information from source documents
        
6. In the Sources section:
- Include all sources used in your report
- Provide full links to relevant websites or specific document paths
- Separate each source by a newline. Use two spaces at the end of each line to create a newline in Markdown.
- It will look like:

### Sources
[1] Link or Document name
[2] Link or Document name

7. Be sure to combine sources. For example this is not correct:

[3] https://ai.meta.com/blog/meta-llama-3-1/
[4] https://ai.meta.com/blog/meta-llama-3-1/

There should be no redundant sources. It should simply be:

[3] https://ai.meta.com/blog/meta-llama-3-1/
        
8. Final review:
- Ensure the report follows the required structure
- Include no preamble before the title of the report
- Check that all guidelines have been followed"""

def write_section(state: InterviewState):
    status_updater.update("WRITE_SECTION", 9)
    
    """ Node to write a section """

    # Get state
    interview = state["interview"]
    context = state["context"]
    analyst = state["analyst"]
   
    # Write section using either the gathered source docs from interview (context) or the interview itself (interview)
    system_message = section_writer_instructions.format(focus=analyst.description)
    section = llm.invoke([SystemMessage(content=system_message)]+[HumanMessage(content=f"Use this source to write your section: {context}")]) 
                
    # Append it to state
    return {"sections": [section.content]}

# Add nodes and edges 
interview_builder = StateGraph(InterviewState)
interview_builder.add_node("ask_question", generate_question)
interview_builder.add_node("search_web", search_web)
interview_builder.add_node("search_wikipedia", search_wikipedia)
interview_builder.add_node("answer_question", generate_answer)
interview_builder.add_node("save_interview", save_interview)
interview_builder.add_node("write_section", write_section)

# Flow
interview_builder.add_edge(START, "ask_question")
interview_builder.add_edge("ask_question", "search_web")
interview_builder.add_edge("ask_question", "search_wikipedia")
interview_builder.add_edge("search_web", "answer_question")
interview_builder.add_edge("search_wikipedia", "answer_question")
interview_builder.add_conditional_edges("answer_question", route_messages,['ask_question','save_interview'])
interview_builder.add_edge("save_interview", "write_section")
interview_builder.add_edge("write_section", END)

def initiate_all_interviews(state: ResearchGraphState):
    status_updater.update("INITIATE_ALL_INTERVIEWS", 10)

    """ Conditional edge to initiate all interviews via Send() API or return to create_analysts """    

    # Check if human feedback
    human_analyst_feedback=state.get('human_analyst_feedback','approve')
    if human_analyst_feedback.lower() != 'approve':
        # Return to create_analysts
        status_updater.update("INITIATE_ALL_INTERVIEWS", 10, {"decision": "create_analysts"})
        return "create_analysts"

    # Otherwise kick off interviews in parallel via Send() API
    else:
        topic = state["topic"]
        status_updater.update("INITIATE_ALL_INTERVIEWS", 10, {"decision": "conduct_interview", "count": len(state["analysts"])})
        return [Send("conduct_interview", {"analyst": analyst,
                                           "messages": [HumanMessage(
                                               content=f"So you said you were writing an article on {topic}?"
                                           )
                                                       ]}) for analyst in state["analysts"]]

# Write a report based on the interviews
report_writer_instructions = """You are a technical writer creating a report on this overall topic: 

{topic}
    
You have a team of analysts. Each analyst has done two things: 

1. They conducted an interview with an expert on a specific sub-topic.
2. They write up their finding into a memo.

Your task: 

1. You will be given a collection of memos from your analysts.
2. Think carefully about the insights from each memo.
3. Consolidate these into a crisp overall summary that ties together the central ideas from all of the memos. 
4. Summarize the central points in each memo into a cohesive single narrative.

To format your report:
 
1. Use markdown formatting. 
2. Include no pre-amble for the report.
3. Use no sub-heading. 
4. Start your report with a single title header: ## Insights
5. Do not mention any analyst names in your report.
6. Preserve any citations in the memos, which will be annotated in brackets, for example [1] or [2].
7. Create a final, consolidated list of sources and add to a Sources section with the `## Sources` header.
8. List your sources in order and do not repeat.

[1] Source 1
[2] Source 2

Here are the memos from your analysts to build your report from: 

{context}"""

def write_report(state: ResearchGraphState):
    status_updater.update("WRITE_REPORT", 11)

    """ Node to write the final report body """

    # Full set of sections
    sections = state.get("sections", [])
    topic = state.get("topic", "Unknown Topic")
    
    if not sections:
        status_updater.update("WRITE_REPORT", 11, {"warning": "No sections found in state"})
        return {"content": "No sections available for report generation"}

    status_updater.update("WRITE_REPORT", 11, {"sections_count": len(sections)})

    # Concat all sections together
    formatted_str_sections = "\n\n".join([f"{section}" for section in sections])
    
    # Summarize the sections into a final report
    system_message = report_writer_instructions.format(topic=topic, context=formatted_str_sections)    
    report = llm.invoke([SystemMessage(content=system_message)]+[HumanMessage(content=f"Write a report based upon these memos.")]) 
    
    status_updater.update("WRITE_REPORT", 11, {"content_length": len(report.content)})
    return {"content": report.content}

# Write the introduction or conclusion
intro_conclusion_instructions = """You are a technical writer finishing a report on {topic}

You will be given all of the sections of the report.

You job is to write a crisp and compelling introduction or conclusion section.

The user will instruct you whether to write the introduction or conclusion.

Include no pre-amble for either section.

Target around 100 words, crisply previewing (for introduction) or recapping (for conclusion) all of the sections of the report.

Use markdown formatting. 

For your introduction, create a compelling title and use the # header for the title.

For your introduction, use ## Introduction as the section header. 

For your conclusion, use ## Conclusion as the section header.

Here are the sections to reflect on for writing: {formatted_str_sections}"""

def write_introduction(state: ResearchGraphState):
    status_updater.update("WRITE_INTRODUCTION", 12)

    """ Node to write the introduction """

    # Full set of sections
    sections = state.get("sections", [])
    topic = state.get("topic", "Unknown Topic")
    
    if not sections:
        status_updater.update("WRITE_INTRODUCTION", 12, {"warning": "No sections found for introduction"})
        sections = ["No sections available"]

    # Concat all sections together
    formatted_str_sections = "\n\n".join([f"{section}" for section in sections])
    
    # Summarize the sections into a final report
    instructions = intro_conclusion_instructions.format(topic=topic, formatted_str_sections=formatted_str_sections)    
    intro = llm.invoke([SystemMessage(content=instructions)]+[HumanMessage(content=f"Write the report introduction")]) 
    
    status_updater.update("WRITE_INTRODUCTION", 12, {"content_length": len(intro.content)})
    return {"introduction": intro.content}

def write_conclusion(state: ResearchGraphState):
    status_updater.update("WRITE_CONCLUSION", 13)

    """ Node to write the conclusion """

    # Full set of sections
    sections = state.get("sections", [])
    topic = state.get("topic", "Unknown Topic")
    
    if not sections:
        status_updater.update("WRITE_CONCLUSION", 13, {"warning": "No sections found for conclusion"})
        sections = ["No sections available"]

    # Concat all sections together
    formatted_str_sections = "\n\n".join([f"{section}" for section in sections])
    
    # Summarize the sections into a final report
    instructions = intro_conclusion_instructions.format(topic=topic, formatted_str_sections=formatted_str_sections)    
    conclusion = llm.invoke([SystemMessage(content=instructions)]+[HumanMessage(content=f"Write the report conclusion")]) 
    
    status_updater.update("WRITE_CONCLUSION", 13, {"content_length": len(conclusion.content)})
    return {"conclusion": conclusion.content}

def finalize_report(state: ResearchGraphState):
    status_updater.update("FINALIZE_REPORT", 14)

    """ The is the "reduce" step where we gather all the sections, combine them, and reflect on them to write the intro/conclusion """

    # Save full final report
    content = state.get("content", "")
    introduction = state.get("introduction", "")
    conclusion = state.get("conclusion", "")
    
    if not content:
        status_updater.update("FINALIZE_REPORT", 14, {"warning": "No content found in state"})
        content = "No content available"
    
    if not introduction:
        status_updater.update("FINALIZE_REPORT", 14, {"warning": "No introduction found in state"})
        introduction = "# Research Report\n\n## Introduction\n\nIntroduction not available"
    
    if not conclusion:
        status_updater.update("FINALIZE_REPORT", 14, {"warning": "No conclusion found in state"})
        conclusion = "## Conclusion\n\nConclusion not available"
    
    # Clean up content formatting
    if content.startswith("## Insights"):
        content = content.replace("## Insights", "", 1).strip()
    
    sources = None
    if "## Sources" in content:
        try:
            content_parts = content.split("\n## Sources\n", 1)
            if len(content_parts) == 2:
                content, sources = content_parts
        except Exception as e:
            status_updater.update("FINALIZE_REPORT", 14, {"error": f"Error parsing sources: {str(e)}"})
            sources = None

    # Combine all parts
    final_report = introduction + "\n\n---\n\n" + content + "\n\n---\n\n" + conclusion
    if sources is not None:
        final_report += "\n\n## Sources\n" + sources
    
    status_updater.update("FINALIZE_REPORT", 14, {"report_length": len(final_report)})
    return {"final_report": final_report}

# Add nodes and edges 
builder = StateGraph(ResearchGraphState)
builder.add_node("create_analysts", create_analysts)
builder.add_node("human_feedback", human_feedback)
builder.add_node("conduct_interview", interview_builder.compile())
builder.add_node("write_report",write_report)
builder.add_node("write_introduction",write_introduction)
builder.add_node("write_conclusion",write_conclusion)
builder.add_node("finalize_report",finalize_report)

# Logic
builder.add_edge(START, "create_analysts")
builder.add_edge("create_analysts", "human_feedback")
builder.add_conditional_edges("human_feedback", initiate_all_interviews, ["create_analysts", "conduct_interview"])
builder.add_edge("conduct_interview", "write_report")
builder.add_edge("write_report", "write_introduction")
builder.add_edge("write_introduction", "write_conclusion")
builder.add_edge("write_conclusion", "finalize_report")
builder.add_edge("finalize_report", END)

# Compile two versions of the graph
graph = builder.compile(interrupt_before=['human_feedback'])

# Version without interrupts for direct execution
builder_no_interrupt = StateGraph(ResearchGraphState)
builder_no_interrupt.add_node("create_analysts", create_analysts)
builder_no_interrupt.add_node("conduct_interview", interview_builder.compile())
builder_no_interrupt.add_node("write_report", write_report)
builder_no_interrupt.add_node("write_introduction", write_introduction)
builder_no_interrupt.add_node("write_conclusion", write_conclusion)
builder_no_interrupt.add_node("finalize_report", finalize_report)

# Direct flow without human feedback
def initiate_all_interviews_direct(state: ResearchGraphState):
    status_updater.update("INITIATE_ALL_INTERVIEWS_DIRECT", 15)
    
    """ Conditional edge to initiate all interviews via Send() API """
    topic = state["topic"]
    status_updater.update("INITIATE_ALL_INTERVIEWS_DIRECT", 15, {"count": len(state["analysts"])})
    return [Send("conduct_interview", {"analyst": analyst,
                                       "messages": [HumanMessage(
                                           content=f"So you said you were writing an article on {topic}?"
                                       )]}) for analyst in state["analysts"]]

builder_no_interrupt.add_edge(START, "create_analysts")
builder_no_interrupt.add_conditional_edges("create_analysts", initiate_all_interviews_direct, ["conduct_interview"])
builder_no_interrupt.add_edge("conduct_interview", "write_report")
builder_no_interrupt.add_edge("write_report", "write_introduction")
builder_no_interrupt.add_edge("write_introduction", "write_conclusion")
builder_no_interrupt.add_edge("write_conclusion", "finalize_report")
builder_no_interrupt.add_edge("finalize_report", END)

graph_no_interrupt = builder_no_interrupt.compile()