#!/usr/bin/env python3
"""
Test script to debug the graph execution
"""

from research_assistant import graph, graph_no_interrupt
from schema import ResearchGraphState

def test_full_flow():
    print("Testing full graph flow...")
    
    # Create initial state
    initial_state = {
        'topic': 'Machine learning in drug discovery',
        'max_analysts': 2,  # Smaller number for testing
        'human_analyst_feedback': ''
    }
    
    print("Step 1: Creating analysts...")
    # Run until human feedback
    result = graph.invoke(initial_state, {"recursion_limit": 10})
    print(f"After analyst creation: {result.keys()}")
    print(f"Analysts: {len(result.get('analysts', []))}")
    
    print("\nStep 2: Running full research with approved analysts...")
    
    # Use the no-interrupt graph with approved analysts
    research_state = {
        'topic': result['topic'],
        'max_analysts': len(result['analysts']),
        'analysts': result['analysts'],
        'human_analyst_feedback': 'approve'
    }
    
    # Run the complete research process
    final_result = graph_no_interrupt.invoke(research_state, {"recursion_limit": 100})
    print(f"Final result keys: {final_result.keys()}")
    
    for key in ['sections', 'content', 'introduction', 'conclusion', 'final_report']:
        if key in final_result:
            if isinstance(final_result[key], str):
                print(f"{key}: {len(final_result[key])} chars")
            elif isinstance(final_result[key], list):
                print(f"{key}: {len(final_result[key])} items")
            else:
                print(f"{key}: {type(final_result[key])}")
        else:
            print(f"{key}: NOT FOUND")

if __name__ == '__main__':
    test_full_flow()

if __name__ == '__main__':
    test_full_flow()
