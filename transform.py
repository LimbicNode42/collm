fp=r"d:\\HobbyProjects\\collm\\apps\\web\\app\\nodes\\[id]\\page.tsx"
with open(fp,"r",encoding="utf-8") as f:c=f.read()
ok=[];fail=[]

## STEP 1: Add detectContested
old1="""// ---------------------------------------------------------------------------\n// Expandable contribution list item (4 lines at a time)\n// ---------------------------------------------------------------------------"""
