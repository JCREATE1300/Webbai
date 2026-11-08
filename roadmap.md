# Model download improvements
- [x] Track combined progress across all model files and handle download failures.
- [x] Show the model name and percentage to two decimal places.
- [x] Thirteen automated tests passed, including combined progress, download errors, interrupted streams, selection, uncapped library parsing, and exact versions.
- [x] Browse the live Ollama library without a curated-list limit, including model versions and exact names; live checks returned 270 families and 63 llama3.2 tags.
- [x] Check download failures and model selection; ignore stale searches and show library errors instead of a curated fallback.
- [x] Remove the welcome screen and open chat, preserving required sign-in; signed-out desktop/mobile opening verified.
- [ ] Verify a real model download in the Windows app (blocked: no Windows runtime in this sandbox).
- [ ] Verify signed-in opening and the model picker through the chat UI (blocked: no matching requesting-user account/session available).