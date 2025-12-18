BTCA — ultra-concise
	•	Purpose: Ask questions grounded in a specific Git repo (code + docs).
	•	Install: bun add -g btca
	•	Add library: Add repo under repos in ~/.config/btca/btca.json
	•	Index/start: btca open
	•	Ask: btca ask -t <tech> -q "<question>" - This should ideally be your way of communicating with btca!! - first cd into our working directory since you will be in a sandboxed env. 
	•	Chat: btca chat -t <tech>
	•	API: btca serve -p <port>
	•	Rule: Answers must come only from the indexed repo; no speculation.