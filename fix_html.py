import re

with open('writing.html', 'r') as f:
    content = f.read()

# Fix the name
content = re.sub(r'Suzanne\s+Timmons\s+·\s+Director,\s+Corporate\s+Engineering', 'Director, Corporate Engineering', content)
content = re.sub(r'Suzanne\s+Timmons', 'Director', content)
content = re.sub(r'Suzanne', 'the Director', content)

# Fix framing
content = re.sub(r'<span class="lead-role">Operational communications · behavior change</span>', '<span class="lead-role">Strategy and Creative Direction</span>', content)
content = re.sub(r'<h3>Teach 75,000 new hires how Google works\.</h3>', '<h3>Strategic Planning for Onboarding Content.</h3>', content)

old_p = r'<p>This was not a keynote\. It was operational writing: turn unfamiliar internal systems into steps a new hire could complete without a specialist beside them\. I wrote the Day-One orientation, credential-setup scripts, TechStop self-help videos, and recurring communications\.</p>'
new_p = '<p>This was a strategy and brainstorming document. It outlines the creative direction, animation transitions, and core themes the video should touch on to help new hires navigate internal systems. Ensure the context reflects that this was a strategic planning asset, not a verbatim speech script.</p>'
content = re.sub(old_p, new_p, content)

# Fix small tag
content = re.sub(r'retained orientation script', 'creative direction memo', content)

# Remove any em-dashes (—) or replace with something else if I added any, but I didn't. 
# Also check for existing em-dashes in the replaced text.
# The prompt says: "Do not use em-dashes in any of your outward prose or edits."
# I didn't use any em dashes in my new text.

with open('writing.html', 'w') as f:
    f.write(content)

print("Updated writing.html")
