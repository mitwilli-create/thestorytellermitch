import re

with open('writing.html', 'r') as f:
    content = f.read()

bad_p = r'<p>This was a strategy and brainstorming document\. It outlines the creative direction, animation transitions, and core themes the video should touch on to help new hires navigate internal systems\. Ensure the context reflects that this was a strategic planning asset, not a verbatim speech script\.</p>'
good_p = '<p>This was a strategy and brainstorming document, acting as a creative direction memo for the onboarding video. It outlines the animation transitions and core themes the video should touch on to help new hires navigate internal systems. It was built as a strategic planning asset, not a verbatim speech script.</p>'
content = re.sub(bad_p, good_p, content)

with open('writing.html', 'w') as f:
    f.write(content)

print("Updated writing.html again")
