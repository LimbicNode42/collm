import sys
filepath = r"d:\\HobbyProjects\\collm\\apps\\web\\app\\nodes\\[id]\\page.tsx"
with open(filepath, "rb") as f:
    b = f.read()
crlf = b.count(b"\r\n")
out = r"d:\\HobbyProjects\\collm\\result.txt"
open(out,"w").write("binary_len=%d crlf=%d" % (len(b), crlf))